/**
 * getAllOrders — Slice 9 real-D1 E2E: keyset pagination + search guard.
 *
 * Runs the real migrations (incl. 0017 keyset indexes) on an in-memory
 * miniflare D1 and verifies:
 *   • same-timestamp ties: pages are deterministic — cursor and offset
 *     walks produce the identical (createdAt DESC, id DESC) sequence, no
 *     row skipped or duplicated (pre-tie-breaker offset pagination could
 *     not guarantee this)
 *   • cursor strictly advances: page 2 starts after the last row of page 1
 *   • cursor + status filter combine (index-served per EXPLAIN proofs)
 *   • THE CRASH CASE: search terms whose %-wrapped pattern exceeds D1's
 *     50-byte LIKE cap previously threw "LIKE or GLOB pattern too complex"
 *     (verified on this engine); with the guard they truncate safely
 *   • search still matches order number / phone / customer name
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import {
  getAllOrders,
  encodeOrderCursor,
} from "../../../../cod-shared/queries/orders";

const registry: Miniflare[] = [];
let db: AppDb;

const TOTAL = 25;
const PAGE = 5;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });
  registry.push(mf);
  const d1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) {
      await d1.prepare(statement).run();
    }
  }
  db = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;

  // 25 orders over only 5 distinct timestamps — 5-way ties everywhere, the
  // adversarial case for pagination determinism. Statuses alternate.
  const timestamps = [
    "2026-01-01T00:00:00.000Z",
    "2026-01-02T00:00:00.000Z",
    "2026-01-03T00:00:00.000Z",
    "2026-01-04T00:00:00.000Z",
    "2026-01-05T00:00:00.000Z",
  ];
  const now = new Date().toISOString();
  await db.insert(schema.customers).values({
    id: "cust-k", name: "Keyset Customer", phone: "0770000001",
    wilaya: "الجزائر", createdAt: now,
  });
  for (let i = 0; i < TOTAL; i += 5) {
    const batch: (typeof schema.orders.$inferInsert)[] = Array.from({ length: 5 }, (_, j) => {
        const n = i + j;
        return {
          id: `ord-k${String(n).padStart(2, "0")}`,
          orderNumber: `ORD-K-${String(n).padStart(2, "0")}`,
          customerId: "cust-k",
          customerName: `Buyer ${n}`,
          phone: `07700000${String(n).padStart(2, "0")}`,
          price: 100,
          status: n % 2 === 0 ? "new" : "confirmed",
          deliveryMethod: "unassigned",
          deliveryType: "home",
          deliveryFee: 0, driverFee: 0, codAmount: 100,
          createdAt: timestamps[n % timestamps.length],
          updatedAt: now,
        };
      });
    await db.insert(schema.orders).values(batch);
  }
}, 120_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

function key(row: { id: string }) {
  return row.id;
}

describe("getAllOrders — keyset pagination (real D1)", () => {
  it("cursor and offset walks produce the identical deterministic sequence over ties", async () => {
    const offsetIds: string[] = [];
    for (let page = 0; page * PAGE < TOTAL; page++) {
      const rows = await getAllOrders(db, { limit: PAGE, offset: page * PAGE });
      offsetIds.push(...rows.map(key));
    }

    const cursorIds: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const rows = await getAllOrders(db, { limit: PAGE, cursor });
      if (rows.length === 0) break;
      cursorIds.push(...rows.map(key));
      const last = rows[rows.length - 1];
      cursor = encodeOrderCursor(last.createdAt, last.id);
      if (cursorIds.length >= TOTAL) break;
    }

    expect(offsetIds).toHaveLength(TOTAL);
    expect(cursorIds).toHaveLength(TOTAL);
    expect(new Set(offsetIds).size).toBe(TOTAL);
    expect(new Set(cursorIds).size).toBe(TOTAL);
    expect(cursorIds).toEqual(offsetIds);
  });

  it("orders with equal createdAt break ties by id DESC", async () => {
    const rows = await getAllOrders(db, { limit: TOTAL });
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (prev.createdAt === curr.createdAt) {
        expect(prev.id > curr.id).toBe(true);
      } else {
        expect(prev.createdAt > curr.createdAt).toBe(true);
      }
    }
  });

  it("cursor page starts strictly after the previous page's last row", async () => {
    const page1 = await getAllOrders(db, { limit: PAGE });
    const last = page1[PAGE - 1];
    const cursor = encodeOrderCursor(last.createdAt, last.id);
    const page2 = await getAllOrders(db, { limit: PAGE, cursor });

    expect(page2).toHaveLength(PAGE);
    expect(page2.every((r) => r.id !== last.id)).toBe(true);
    for (const row of page2) {
      const afterCursor =
        row.createdAt < last.createdAt ||
        (row.createdAt === last.createdAt && row.id < last.id);
      expect(afterCursor).toBe(true);
    }
  });

  it("cursor combines with the status filter", async () => {
    const first = await getAllOrders(db, { status: "new", limit: 3 });
    expect(first.every((r) => r.status === "new")).toBe(true);
    const last = first[first.length - 1];
    const cursor = encodeOrderCursor(last.createdAt, last.id);

    const second = await getAllOrders(db, { status: "new", limit: 3, cursor });
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((r) => r.status === "new")).toBe(true);
    for (const row of second) {
      const afterCursor =
        row.createdAt < last.createdAt ||
        (row.createdAt === last.createdAt && row.id < last.id);
      expect(afterCursor).toBe(true);
    }
    expect(second.some((r) => first.some((f) => f.id === r.id))).toBe(false);
  });

  it("cursor takes precedence over offset", async () => {
    const page1 = await getAllOrders(db, { limit: PAGE });
    const last = page1[PAGE - 1];
    const cursor = encodeOrderCursor(last.createdAt, last.id);

    const viaCursor = await getAllOrders(db, { limit: PAGE, cursor, offset: 40 });
    const viaCursorOnly = await getAllOrders(db, { limit: PAGE, cursor });

    expect(viaCursor.map(key)).toEqual(viaCursorOnly.map(key));
  });
});

describe("getAllOrders — search guard (real D1)", () => {
  it("THE CRASH CASE: a 200-char search term no longer throws", async () => {
    const rows = await getAllOrders(db, { search: "a".repeat(200) });
    expect(rows).toEqual([]);
  });

  it("a long Arabic term (2 bytes/char) no longer throws", async () => {
    const rows = await getAllOrders(db, { search: "أ".repeat(60) });
    expect(rows).toEqual([]);
  });

  it("search still matches order number, phone, and customer name", async () => {
    const byNumber = await getAllOrders(db, { search: "ORD-K-07" });
    expect(byNumber.map(key)).toEqual(["ord-k07"]);

    const byPhone = await getAllOrders(db, { search: "0770000012" });
    expect(byPhone.map(key)).toEqual(["ord-k12"]);

    const byName = await getAllOrders(db, { search: "Buyer 3" });
    expect(byName.map(key)).toEqual(["ord-k03"]);
  });

  it("search combines with the cursor", async () => {
    const page1 = await getAllOrders(db, { search: "Buyer", limit: 5 });
    expect(page1.length).toBe(5);
    const last = page1[page1.length - 1];
    const cursor = encodeOrderCursor(last.createdAt, last.id);
    const page2 = await getAllOrders(db, { search: "Buyer", limit: 5, cursor });
    expect(page2.length).toBe(5);
    expect(page2.some((r) => page1.some((f) => f.id === r.id))).toBe(false);
  });
});

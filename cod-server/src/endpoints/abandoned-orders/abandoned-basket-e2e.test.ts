/**
 * Abandoned baskets — real-D1 E2E.
 *
 * The whole point of this table is the callback: a merchant rings someone who
 * walked away and needs to say what they were buying. With the cart shipped,
 * "what they were buying" can be five things, and an abandoned record that
 * only remembers one of them makes that call useless.
 *
 * These run against a real D1 with the real migrations applied — including
 * 0028 — because the safety argument for that migration is entirely about what
 * the columns actually hold afterwards, and a mock cannot show that.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import storeAbandonedRouter from "./store-routes";
import {
  listAbandonedOrders,
  getAbandonedOrderStats,
} from "../../../../cod-shared/queries/abandoned-orders";

const registry: Miniflare[] = [];
let db: AppDb;

vi.mock("@/db", () => ({ getDb: () => db }));

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "abandoned-basket-db" },
  });
  registry.push(mf);
  const d1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  const prepared: D1PreparedStatement[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) prepared.push(d1.prepare(statement));
  }
  for (let i = 0; i < prepared.length; i += 50) {
    await d1.batch(prepared.slice(i, i + 50));
  }
  db = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;
});

beforeEach(async () => {
  await db.delete(schema.abandonedOrders);
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

function makeApp() {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {} } as any;
    c.set("storeId", "store-1");
    await next();
  });
  app.onError(errorHandler);
  app.route("/store", storeAbandonedRouter);
  return app;
}

async function track(body: Record<string, unknown>) {
  const res = await makeApp().request("/store/abandoned", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

function shopper(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: crypto.randomUUID(),
    customerName: "Ahmed Benali",
    phone: "0551234567",
    wilayaId: 16,
    ...overrides,
  };
}

const hoodie = {
  productId: "p1",
  productName: "Hoodie Classic",
  variantId: "v-black-l",
  variantLabel: "Noir / L",
  quantity: 2,
  unitPrice: 2400,
};
const tshirt = {
  productId: "p2",
  productName: "Street Fighter 45",
  quantity: 1,
  unitPrice: 1000,
};

async function rowFor(sessionId: string) {
  return db
    .select()
    .from(schema.abandonedOrders)
    .where(eq(schema.abandonedOrders.sessionId, sessionId))
    .get();
}

// ─────────────────────────────────────────────────────────────────────────────

describe("a single-product checkout is stored exactly as before", () => {
  it("writes the flat columns and no basket", async () => {
    const sessionId = crypto.randomUUID();

    const res = await track(
      shopper({
        sessionId,
        productId: "p1",
        productName: "Hoodie Classic",
        variantLabel: "Noir / L",
        price: 2400,
      }),
    );

    expect(res.status).toBe(200);
    const row = await rowFor(sessionId);
    expect(row).toMatchObject({
      productId: "p1",
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
      price: 2400,
      itemsJson: null,
      itemCount: null,
    });
  });

  it("still records a shopper who only typed a phone number", async () => {
    // The most common capture of all: contact details before anything else.
    const sessionId = crypto.randomUUID();

    const res = await track(shopper({ sessionId }));

    expect(res.status).toBe(200);
    const row = await rowFor(sessionId);
    expect(row?.customerName).toBe("Ahmed Benali");
    expect(row?.productId).toBeNull();
  });
});

describe("a basket checkout", () => {
  it("stores every line", async () => {
    const sessionId = crypto.randomUUID();

    await track(shopper({ sessionId, items: [hoodie, tshirt] }));

    const { rows } = await listAbandonedOrders(db, {});
    expect(rows[0].items).toHaveLength(2);
    expect(rows[0].items?.[0]).toMatchObject({
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
      quantity: 2,
    });
    expect(rows[0].itemCount).toBe(2);
  });

  it("keeps the flat product columns filled from the first line", async () => {
    // This is what makes migration 0028 safe: the dashboard's product column
    // and the customer search read these and were never changed.
    const sessionId = crypto.randomUUID();

    await track(shopper({ sessionId, items: [hoodie, tshirt] }));

    const row = await rowFor(sessionId);
    expect(row).toMatchObject({
      productId: "p1",
      productName: "Hoodie Classic",
      variantId: "v-black-l",
      variantLabel: "Noir / L",
    });
  });

  it("records the basket subtotal so lost revenue stays honest", async () => {
    const sessionId = crypto.randomUUID();

    await track(shopper({ sessionId, items: [hoodie, tshirt] }));
    // 2 × 2400 + 1 × 1000
    expect((await rowFor(sessionId))?.price).toBe(5800);

    await db
      .update(schema.abandonedOrders)
      .set({ status: "abandoned" })
      .where(eq(schema.abandonedOrders.sessionId, sessionId));

    const stats = await getAbandonedOrderStats(db);
    expect(stats.estimatedLostRevenue).toBe(5800);
  });

  it("replaces the basket as the shopper edits it, without duplicating the row", async () => {
    // One row per tab: the shopper removing a line must shrink the record,
    // not leave the merchant reading a basket that no longer exists.
    const sessionId = crypto.randomUUID();

    await track(shopper({ sessionId, items: [hoodie, tshirt] }));
    await track(shopper({ sessionId, items: [tshirt] }));

    const { rows, total } = await listAbandonedOrders(db, {});
    expect(total).toBe(1);
    expect(rows[0].items).toHaveLength(1);
    expect(rows[0].itemCount).toBe(1);
    expect(rows[0].price).toBe(1000);
  });

  it("lets the basket win over flat fields sent alongside it", async () => {
    const sessionId = crypto.randomUUID();

    await track(
      shopper({ sessionId, items: [tshirt], productId: "stale", productName: "Stale", price: 99 }),
    );

    const row = await rowFor(sessionId);
    expect(row?.productId).toBe("p2");
    expect(row?.price).toBe(1000);
  });
});

describe("the basket is bounded like an order's", () => {
  it("refuses more lines than an order could carry", async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      productId: `p${i}`,
      productName: `Product ${i}`,
      quantity: 1,
      unitPrice: 100,
    }));

    const res = await track(shopper({ items }));

    expect(res.status).toBe(400);
  });

  it("accepts a basket at the cap", async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      productId: `p${i}`,
      productName: `Product ${i}`,
      quantity: 1,
      unitPrice: 100,
    }));
    const sessionId = crypto.randomUUID();

    const res = await track(shopper({ sessionId, items }));

    expect(res.status).toBe(200);
    expect((await rowFor(sessionId))?.itemCount).toBe(20);
  });

  it("refuses a line quantity an order could not carry", async () => {
    const res = await track(
      shopper({ items: [{ ...tshirt, quantity: 101 }] }),
    );

    expect(res.status).toBe(400);
  });

  it("refuses an empty basket rather than storing one", async () => {
    // `items: []` means the shape was sent but says nothing; the flat fields
    // are the record in that case, and an empty array must not masquerade.
    const res = await track(shopper({ items: [] }));

    expect(res.status).toBe(400);
  });
});

describe("reading records back", () => {
  it("hands the dashboard a basket, not a string to decode", async () => {
    await track(shopper({ items: [hoodie] }));

    const { rows } = await listAbandonedOrders(db, {});
    expect(Array.isArray(rows[0].items)).toBe(true);
    expect(rows[0]).not.toHaveProperty("itemsJson");
  });

  it("reports no basket for a single-product record", async () => {
    await track(shopper({ productId: "p1", productName: "Hoodie", price: 2400 }));

    const { rows } = await listAbandonedOrders(db, {});
    expect(rows[0].items).toBeNull();
    expect(rows[0].productName).toBe("Hoodie");
  });

  it("still lists a record whose basket column is unreadable", async () => {
    // Written by a future shape, or hand-edited. The row must not disappear
    // from the merchant's list — the phone number is the valuable part.
    const sessionId = crypto.randomUUID();
    await track(shopper({ sessionId, items: [hoodie] }));
    await db
      .update(schema.abandonedOrders)
      .set({ itemsJson: "{not json" })
      .where(eq(schema.abandonedOrders.sessionId, sessionId));

    const { rows } = await listAbandonedOrders(db, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toBeNull();
    expect(rows[0].productName).toBe("Hoodie Classic");
  });

  it("finds a basket record by the shopper's phone", async () => {
    await track(shopper({ items: [hoodie], phone: "0770001122" }));

    const { rows } = await listAbandonedOrders(db, { search: "0770001122" });
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(1);
  });
});

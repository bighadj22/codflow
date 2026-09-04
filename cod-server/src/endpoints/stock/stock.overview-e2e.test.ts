/**
 * getStockOverview + getStockAlerts — Slice 6 real-D1 E2E.
 *
 * Runs the real migrations on an in-memory miniflare D1 and verifies the
 * SQL UNION replicates the original JS semantics EXACTLY, including the
 * edge cases:
 *   • negative inventory → out-of-stock bucket
 *   • threshold = 0 → alerts disabled (in-stock items never low)
 *   • inventory == threshold → low-stock (<= boundary)
 *   • untracked / soft-deleted products excluded
 *   • inactive variants excluded; variants of non-variant products excluded
 *   • DRAFT status still included (no status filter — original behavior)
 *   • variant parent with no variants contributes no SKUs
 *   • ordering: out-of-stock first, then inventory ascending
 *   • pagination: limit/offset, page beyond the end, total stays correct
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { getStockOverview, getStockAlerts } from "../../../../cod-shared/queries/stock";

const registry: Miniflare[] = [];
let db: AppDb;

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

  const now = new Date().toISOString();
  const mk = (
    id: string,
    overrides: Partial<typeof schema.products.$inferInsert> = {},
  ): typeof schema.products.$inferInsert => ({
    id,
    name: `Product ${id}`,
    handle: `h-${id}`,
    price: 100,
    hasVariants: false,
    inventory: 10,
    trackInventory: true,
    lowStockThreshold: 5,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  const fixtures = [
    mk("simple-ok", { price: 100, inventory: 50 }),
    mk("simple-low", { price: 200, inventory: 3 }),
    mk("simple-out", { price: 300, inventory: 0 }),
    mk("simple-neg", { price: 100, inventory: -2 }),
    mk("thr-zero", { price: 100, inventory: 3, lowStockThreshold: 0 }),
    mk("thr-boundary", { price: 100, inventory: 5, lowStockThreshold: 5 }),
    mk("untracked", { price: 100, inventory: 0, trackInventory: false }),
    mk("soft-deleted", { price: 100, inventory: 0, deletedAt: now }),
    mk("draft-tracked", { price: 100, inventory: 4, status: "DRAFT" }),
    mk("variant-parent", { hasVariants: true, price: 100 }),
    mk("variant-parent-untracked", { hasVariants: true, trackInventory: false }),
    mk("variant-parent-deleted", { hasVariants: true, deletedAt: now }),
    mk("no-variant-parent", { hasVariants: true, price: 100 }),
    mk("simple-with-stray-variant", { hasVariants: false, price: 100, inventory: 8 }),
  ];
  for (let i = 0; i < fixtures.length; i += 5) {
    await db.insert(schema.products).values(fixtures.slice(i, i + 5));
  }

  const variantFixtures = [
    { id: "vp-a", productId: "variant-parent", sku: "SKU-VP-A", variations: '{"Color":"Red"}', price: 150, inventory: 4, lowStockThreshold: 5, active: true, position: 1, createdAt: now, updatedAt: now },
    { id: "vp-b", productId: "variant-parent", sku: "SKU-VP-B", variations: '{"Color":"Blue"}', price: 160, inventory: 0, lowStockThreshold: 5, active: true, position: 2, createdAt: now, updatedAt: now },
    { id: "vp-c", productId: "variant-parent", sku: "SKU-VP-C", variations: '{"Color":"Green"}', price: 170, inventory: 0, lowStockThreshold: 5, active: false, position: 3, createdAt: now, updatedAt: now },
    { id: "vp-d", productId: "variant-parent", sku: "SKU-VP-D", variations: '{"Color":"Black"}', price: 180, inventory: 60, lowStockThreshold: 5, active: true, position: 4, createdAt: now, updatedAt: now },
    { id: "u-1", productId: "variant-parent-untracked", sku: "SKU-U-1", variations: '{"Color":"Grey"}', price: 100, inventory: 0, lowStockThreshold: 5, active: true, position: 1, createdAt: now, updatedAt: now },
    { id: "d-1", productId: "variant-parent-deleted", sku: "SKU-D-1", variations: '{"Color":"White"}', price: 100, inventory: 0, lowStockThreshold: 5, active: true, position: 1, createdAt: now, updatedAt: now },
    { id: "stray-1", productId: "simple-with-stray-variant", sku: "SKU-STRAY", variations: '{"Color":"Pink"}', price: 100, inventory: 0, lowStockThreshold: 5, active: true, position: 1, createdAt: now, updatedAt: now },
  ];
  for (let i = 0; i < variantFixtures.length; i += 6) {
    await db.insert(schema.productVariants).values(variantFixtures.slice(i, i + 6));
  }
}, 120_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("getStockOverview — real D1", () => {
  it("replicates the original bucketing and totals exactly", async () => {
    const overview = await getStockOverview(db);

    const ids = (list: typeof overview.allItems) =>
      list.map((i) => i.variantId ?? i.productId).sort();

    expect(overview.totalSkus).toBe(11);
    expect(ids(overview.allItems)).toEqual([
      "simple-ok", "simple-low", "simple-out", "simple-neg",
      "thr-zero", "thr-boundary", "draft-tracked",
      "simple-with-stray-variant",
      "vp-a", "vp-b", "vp-d",
    ].sort());

    expect(ids(overview.outOfStockItems)).toEqual(["simple-out", "simple-neg", "vp-b"].sort());
    expect(ids(overview.lowStockItems)).toEqual(
      ["simple-low", "thr-boundary", "draft-tracked", "vp-a"].sort(),
    );

    expect(overview.totalInventoryValue).toBe(
      50 * 100 + 3 * 200 + 0 * 300 + -2 * 100 +
      3 * 100 + 5 * 100 + 4 * 100 + 8 * 100 +
      4 * 150 + 0 * 160 + 60 * 180,
    );

    expect(overview.currency).toBe("DZD");

    const stray = overview.allItems.find((i) => i.variantId === "stray-1");
    expect(stray).toBeUndefined();
    expect(overview.allItems.find((i) => i.variantId === "vp-c")).toBeUndefined();
    expect(overview.allItems.find((i) => i.variantId === "u-1")).toBeUndefined();
    expect(overview.allItems.find((i) => i.variantId === "d-1")).toBeUndefined();
    expect(overview.allItems.find((i) => i.productId === "no-variant-parent")).toBeUndefined();
    expect(overview.allItems.find((i) => i.productId === "untracked")).toBeUndefined();
    expect(overview.allItems.find((i) => i.productId === "soft-deleted")).toBeUndefined();
  });

  it("threshold=0 disables low-stock for in-stock items (not out-of-stock)", async () => {
    const overview = await getStockOverview(db);

    const thrZero = overview.allItems.find((i) => i.productId === "thr-zero")!;
    expect(thrZero.inventory).toBe(3);
    expect(thrZero.lowStockThreshold).toBe(0);
    expect(overview.lowStockItems.find((i) => i.productId === "thr-zero")).toBeUndefined();
  });

  it("negative inventory counts as out-of-stock", async () => {
    const overview = await getStockOverview(db);
    const neg = overview.allItems.find((i) => i.productId === "simple-neg")!;
    expect(neg.isOutOfStock).toBe(true);
  });

  it("orders allItems: out-of-stock first, then inventory ascending", async () => {
    const overview = await getStockOverview(db);

    const inventories = overview.allItems.map((i) => i.inventory);
    const firstInStock = inventories.findIndex((inv) => inv > 0);
    expect(inventories.slice(0, firstInStock).every((inv) => inv <= 0)).toBe(true);
    expect(inventories.slice(firstInStock)).toEqual(
      [...inventories.slice(firstInStock)].sort((a, b) => a - b),
    );
  });

  it("maps variant labels from variations JSON", async () => {
    const overview = await getStockOverview(db);
    const vp = overview.allItems.find((i) => i.variantId === "vp-a")!;
    expect(vp.variantLabel).toBe("Red");
    expect(vp.productName).toBe("Product variant-parent");

    const simple = overview.allItems.find((i) => i.productId === "simple-ok")!;
    expect(simple.variantLabel).toBeNull();
    expect(simple.variantId).toBeNull();
  });

  it("returns zeros for an empty catalog", async () => {
    const mf = new Miniflare({
      script: "export default { fetch() { return new Response('ok'); } }",
      modules: true,
      d1Databases: { DB: "empty-db" },
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
    const emptyDb = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;

    const overview = await getStockOverview(emptyDb);
    expect(overview).toMatchObject({
      totalSkus: 0, outOfStockCount: 0, lowStockCount: 0,
      totalInventoryValue: 0, currency: "DZD",
    });
    expect(overview.allItems).toEqual([]);

    const alerts = await getStockAlerts(emptyDb, { limit: 50, offset: 0 });
    expect(alerts).toEqual({ items: [], total: 0 });
  }, 120_000);
});

describe("getStockAlerts — real D1", () => {
  it("returns only alert SKUs, ordered, with the exact total", async () => {
    const result = await getStockAlerts(db, { limit: 100, offset: 0 });

    expect(result.total).toBe(7);
    const keys = result.items.map((i) => i.variantId ?? i.productId);
    expect(keys.sort()).toEqual(
      ["simple-out", "simple-neg", "simple-low", "thr-boundary", "draft-tracked", "vp-a", "vp-b"].sort(),
    );

    const inventories = result.items.map((i) => i.inventory);
    const firstInStock = inventories.findIndex((inv) => inv > 0);
    expect(inventories.slice(0, firstInStock).every((inv) => inv <= 0)).toBe(true);
    expect(inventories.slice(firstInStock)).toEqual(
      [...inventories.slice(firstInStock)].sort((a, b) => a - b),
    );
  });

  it("excludes threshold=0 in-stock items from alerts", async () => {
    const result = await getStockAlerts(db, { limit: 100, offset: 0 });
    expect(result.items.find((i) => i.productId === "thr-zero")).toBeUndefined();
  });

  it("paginates consecutively and keeps the total stable across pages", async () => {
    const pages = await Promise.all([
      getStockAlerts(db, { limit: 2, offset: 0 }),
      getStockAlerts(db, { limit: 2, offset: 2 }),
      getStockAlerts(db, { limit: 2, offset: 4 }),
      getStockAlerts(db, { limit: 2, offset: 6 }),
    ]);

    expect(pages.every((p) => p.total === 7)).toBe(true);
    expect(pages.map((p) => p.items.length)).toEqual([2, 2, 2, 1]);

    const full = await getStockAlerts(db, { limit: 100, offset: 0 });
    const concatenated = pages.flatMap((p) => p.items.map((i) => i.variantId ?? i.productId));
    expect(concatenated).toEqual(full.items.map((i) => i.variantId ?? i.productId));

    const beyond = await getStockAlerts(db, { limit: 50, offset: 500 });
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(7);
  });
});

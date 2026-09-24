/**
 * Stock gate × offers — real-D1 E2E (SECTION E, extracted from offers.test.ts).
 *
 * The stock gate and offer selection are deliberately independent: an offer
 * that would fire must never talk the engine past a stock shortfall. These
 * cases pin that separation.
 *
 * They lived in offers.test.ts against the mock-queue db, which maps fixture
 * rows positionally by select-clause order. checkStoreOrderStock is now one
 * batched, id-keyed lookup, so a positional fixture would be asserting a query
 * plan rather than behaviour. Same cases, same names, real migrations.
 *
 * offers.test.ts keeps its mock-based selectApplicableOffer coverage — that
 * function is unchanged and its query shape is exactly what those tests pin.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import {
  loadCatalogSnapshot,
  findStockShortfall,
} from "../../../../cod-shared/queries/catalog-snapshot";
import { normalizeOrderLines } from "../../../../cod-shared/queries/cart";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";

const registry: Miniflare[] = [];
let db: AppDb;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "offers-stock-db" },
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
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

const now = () => new Date().toISOString();

/** The offer's trigger product — variant-bearing, so stock lives per variant. */
async function seedProduct(id = "prod-001") {
  await db.insert(schema.products).values({
    id,
    name: "Offer Product",
    handle: `handle-${id}`,
    price: 1000,
    sku: null,
    hasVariants: true,
    inventory: 0,
    trackInventory: true,
    lowStockThreshold: 2,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    storeFeatured: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

async function seedVariant(id: string, inventory: number, productId = "prod-001") {
  await db.insert(schema.productVariants).values({
    id,
    productId,
    variations: JSON.stringify({ Size: id }),
    price: 1000,
    sku: `VSKU-${id}`,
    inventory,
    lowStockThreshold: 2,
    isDefault: false,
    active: true,
    position: 1,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

/**
 * Load the catalog rows the basket touches, then ask the pure question. This
 * is exactly the sequence the storefront handler runs, so these cases exercise
 * the real loader against the real schema rather than a hand-built snapshot.
 */
async function check(params: Record<string, unknown>) {
  const lines = normalizeOrderLines({
    productId: "prod-001",
    productName: "P",
    variantId: null,
    variantSelections: [],
    quantity: 1,
    ...params,
  } as any);
  const snapshot = await loadCatalogSnapshot(db, lines, new Date().toISOString());
  return findStockShortfall(snapshot, lines);
}

// ─── SECTION E: stock × offer interaction ────────────────────────────────────

describe("checkStoreOrderStock — stock × offer", () => {
  it("E1: variant in stock, offer would fire → stock gate passes", async () => {
    // variant has 5 in stock, ordering 2 — stock check passes (offer selection is separate)
    await seedProduct();
    await seedVariant("var-001-1", 5);
    expect(await check({ variantId: "var-001-1", quantity: 2 })).toBeNull();
  });

  it("E2: variant OOS, offer would fire → stock gate blocks before offer", async () => {
    await seedProduct();
    await seedVariant("var-001-1", 0);
    const error = await check({ variantId: "var-001-1", quantity: 2 });
    expect(error).not.toBeNull();
    expect(typeof error).toBe("string");
  });

  it("E3: qty exactly equals variant stock → passes (stock gate uses >=, not >)", async () => {
    // stock=2, qty=2 — exactly at cap, should pass
    await seedProduct();
    await seedVariant("var-001-1", 2);
    expect(await check({ variantId: "var-001-1", quantity: 2 })).toBeNull();
  });

  it("E4: qty exceeds variant stock → stock gate blocks", async () => {
    // stock=2, qty=3 — over cap
    await seedProduct();
    await seedVariant("var-001-1", 2);
    expect(await check({ variantId: "var-001-1", quantity: 3 })).not.toBeNull();
  });

  it("E5: offer tier (variantSelections) — qty satisfies offer, all variants in stock → passes", async () => {
    // Offer tier: 2 units selected (var_a ×1, var_b ×1), both in stock
    await seedProduct();
    await seedVariant("var_a", 5);
    await seedVariant("var_b", 8);
    expect(
      await check({
        variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      }),
    ).toBeNull();
  });

  it("E6: offer tier — one selection OOS, offer should not be allowed through stock gate", async () => {
    await seedProduct();
    await seedVariant("var_a", 5);
    await seedVariant("var_b", 0);
    expect(
      await check({
        variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      }),
    ).not.toBeNull();
  });

  it("E7: offer tier — same variant repeated, cumulative qty exceeds stock → blocked", async () => {
    // Customer picks var_a ×3 via offer tier, but only 2 in stock
    await seedProduct();
    await seedVariant("var_a", 2);
    expect(
      await check({
        variantSelections: [
          { variantId: "var_a" },
          { variantId: "var_a" },
          { variantId: "var_a" },
        ],
      }),
    ).not.toBeNull();
  });

  it("E8: a reward-bearing basket is gated on the trigger product's own stock", async () => {
    // Two products in one basket, each with its own offer. The gate must judge
    // each line on its own stock, not on the basket's total.
    await seedProduct("prod-001");
    await seedVariant("var-001-1", 10, "prod-001");
    await seedProduct("prod-002");
    await seedVariant("var-002-1", 1, "prod-002");

    expect(
      await check({
        items: [
          { productId: "prod-001", productName: "A", variantId: "var-001-1", quantity: 2 },
          { productId: "prod-002", productName: "B", variantId: "var-002-1", quantity: 2 },
        ],
      }),
    ).not.toBeNull();
  });
});

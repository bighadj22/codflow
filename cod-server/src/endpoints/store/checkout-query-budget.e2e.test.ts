/**
 * Checkout query budget — real-D1 E2E.
 *
 * D1 is a single-threaded Durable Object and bills by rows read, so a
 * duplicated row read is paid for twice and serialises the store's throughput
 * for its duration. The checkout path used to read the same `products` row up
 * to five times per order and the same `product_variants` row up to five times
 * when an offer fired.
 *
 * These tests count the SELECTs a real order placement issues, per table, and
 * cap them. They are a ratchet: the caps may come down as the path improves,
 * never up without a deliberate edit and a reason.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import {
  createStoreOrder,
  findOrCreateCustomer,
} from "../../../../cod-shared/queries/store";

const registry: Miniflare[] = [];
let rawD1: D1Database;
let db: AppDb;
let sqlLog: string[] = [];

const WILAYA = 16;

/**
 * Wraps the D1 binding so every prepared statement is recorded. Drizzle
 * prepares each statement it sends, including the ones inside a batch, so this
 * sees the full traffic without changing any behaviour.
 */
function recordingD1(d1: D1Database, log: string[]): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "prepare") {
        return (query: string) => {
          log.push(query);
          return (value as D1Database["prepare"]).call(target, query);
        };
      }
      return typeof value === "function" ? (value as Function).bind(target) : value;
    },
  }) as D1Database;
}

/** SELECTs issued against one table. Writes are excluded. */
function selectsAgainst(table: string): string[] {
  const pattern = new RegExp(`\\bfrom\\s+"${table}"`, "i");
  return sqlLog.filter((q) => /^\s*select\b/i.test(q) && pattern.test(q));
}

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "budget-db" },
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
  rawD1 = d1 as unknown as D1Database;
  db = drizzle(recordingD1(rawD1, sqlLog), { schema }) as unknown as AppDb;
});

// Child rows first: order lines and stock movements hold FKs onto products.
beforeEach(async () => {
  await db.delete(schema.orderProducts);
  await db.delete(schema.stockMovements);
  await db.delete(schema.orderStatusHistory);
  await db.delete(schema.orders);
  await db.delete(schema.offers);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
  sqlLog.length = 0;
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

async function seedProduct(overrides: Partial<typeof schema.products.$inferInsert> = {}) {
  const id = uid("prod");
  await db.insert(schema.products).values({
    id,
    name: "Budget Fixture",
    handle: `handle-${id}`,
    price: 1500,
    sku: `SKU-${id}`,
    hasVariants: false,
    inventory: 100,
    trackInventory: true,
    lowStockThreshold: 2,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    storeFeatured: false,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  });
  return id;
}

async function seedVariant(productId: string, overrides: Partial<typeof schema.productVariants.$inferInsert> = {}) {
  const id = uid("var");
  await db.insert(schema.productVariants).values({
    id,
    productId,
    variations: JSON.stringify({ Size: "M" }),
    price: 1800,
    sku: `VSKU-${id}`,
    inventory: 100,
    lowStockThreshold: 2,
    isDefault: true,
    active: true,
    position: 1,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  });
  return id;
}

async function placeOrder(extra: Record<string, unknown>) {
  const customer = await findOrCreateCustomer(db, {
    phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
    name: "Budget Buyer",
    wilayaId: WILAYA,
  });
  sqlLog.length = 0; // measure the order placement only
  return createStoreOrder(db, {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    phone: customer.phone,
    wilayaId: WILAYA,
    communeId: null,
    deliveryType: "home",
    deliveryFee: 600,
    quantity: 1,
    pricePerUnit: 1500,
    ...extra,
  } as any);
}

describe("createStoreOrder — query budget", () => {
  it("reads the products row once for a simple product", async () => {
    const productId = await seedProduct();

    await placeOrder({ productId, productName: "Budget Fixture", quantity: 2 });

    const reads = selectsAgainst("products");
    expect(
      reads.length,
      `products SELECTs:\n${reads.join("\n")}`,
    ).toBeLessThanOrEqual(1);
  });

  it("reads the variant row at most twice for a variant product", async () => {
    const productId = await seedProduct({ hasVariants: true, sku: null });
    const variantId = await seedVariant(productId);

    await placeOrder({
      productId,
      productName: "Budget Fixture",
      variantId,
      variantLabel: "M",
      quantity: 2,
    });

    const reads = selectsAgainst("product_variants");
    expect(
      reads.length,
      `product_variants SELECTs:\n${reads.join("\n")}`,
    ).toBeLessThanOrEqual(2);
  });

  it("does not re-read the reward product once per field when an offer fires", async () => {
    const productId = await seedProduct();
    await db.insert(schema.offers).values({
      id: uid("offer"),
      name: "Buy 2 get 1 free",
      triggerProductId: productId,
      triggerQuantity: 2,
      rewardProductId: productId,
      rewardQuantity: 1,
      discountType: "free",
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    });

    await placeOrder({ productId, productName: "Budget Fixture", quantity: 2 });

    // Same product is both trigger and reward: name, inventory and sku must
    // come from one read, not three.
    const reads = selectsAgainst("products");
    expect(
      reads.length,
      `products SELECTs:\n${reads.join("\n")}`,
    ).toBeLessThanOrEqual(1);
  });
});

// ─── End-to-end read budget across the whole checkout path ────────────────────
//
// The handler calls validateOrderSkus, then checkStoreOrderStock, then
// createStoreOrder. Each batches internally, but they do not share what they
// loaded — so the same catalog rows are fetched more than once per checkout.
// This measures the real total the way the handler actually spends it.

import {
  loadCatalogSnapshot,
  findMissingSku,
  findStockShortfall,
} from "../../../../cod-shared/queries/catalog-snapshot";
import { normalizeOrderLines } from "../../../../cod-shared/queries/cart";

describe("checkout path — total catalog reads per order", () => {
  async function runHandlerSequence(items: Array<{ productId: string; productName: string; variantId?: string; quantity: number }>) {
    const customer = await findOrCreateCustomer(db, {
      phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      name: "Budget Buyer",
      wilayaId: WILAYA,
    });
    sqlLog.length = 0; // measure the checkout only, not the customer upsert

    // Exactly what the handler does: normalise, load ONCE, then ask each
    // question of that one snapshot and hand it to the engine.
    const lines = normalizeOrderLines({
      productId: items[0].productId,
      productName: items[0].productName,
      quantity: 1,
      items,
    } as any);
    const snapshot = await loadCatalogSnapshot(db, lines, new Date().toISOString());
    findMissingSku(snapshot, lines);
    findStockShortfall(snapshot, lines);
    await createStoreOrder(db, {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      wilayaId: WILAYA,
      communeId: null,
      deliveryType: "home",
      deliveryFee: 600,
      productId: items[0].productId,
      productName: items[0].productName,
      quantity: 1,
      pricePerUnit: 1,
      items,
    } as any, snapshot);
  }

  it("reads the products table ONCE for a one-product checkout", async () => {
    const p = await seedProduct();
    await runHandlerSequence([{ productId: p, productName: "P", quantity: 2 }]);

    const reads = selectsAgainst("products");
    expect(reads.length, `products SELECTs:\n${reads.join("\n")}`).toBeLessThanOrEqual(1);
  });

  it("reads the products table ONCE for a three-product basket", async () => {
    const a = await seedProduct();
    const b = await seedProduct();
    const c = await seedProduct();
    await runHandlerSequence([
      { productId: a, productName: "A", quantity: 1 },
      { productId: b, productName: "B", quantity: 1 },
      { productId: c, productName: "C", quantity: 1 },
    ]);

    // Batched: basket size must not change the number of round trips.
    const reads = selectsAgainst("products");
    expect(reads.length, `products SELECTs:\n${reads.join("\n")}`).toBeLessThanOrEqual(1);
  });
});

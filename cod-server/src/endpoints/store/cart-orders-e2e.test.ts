/**
 * Multi-line storefront orders — real-D1 E2E.
 *
 * Runs the actual migrations on Miniflare D1 and proves the reshaped order
 * engine end to end: a basket becomes N order lines, priced from the catalog,
 * deducted per line, committed atomically — and refused whole when any line
 * cannot be satisfied.
 *
 * The legacy single-product and variantSelections request shapes are asserted
 * alongside, because the point of the reshape is that they keep behaving
 * exactly as they did.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import {
  createStoreOrder,
  findOrCreateCustomer,
} from "../../../../cod-shared/queries/store";
import { CartValidationError } from "../../../../cod-shared/queries/cart";

const registry: Miniflare[] = [];
let db: AppDb;

const WILAYA = 16;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "cart-db" },
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
  await db.delete(schema.orderProducts);
  await db.delete(schema.stockMovements);
  await db.delete(schema.orderStatusHistory);
  await db.delete(schema.orders);
  await db.delete(schema.offers);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

async function seedProduct(opts: {
  price: number;
  inventory?: number;
  trackInventory?: boolean;
  hasVariants?: boolean;
  name?: string;
}) {
  const id = uid("prod");
  await db.insert(schema.products).values({
    id,
    name: opts.name ?? "Product",
    handle: `handle-${id}`,
    price: opts.price,
    sku: `SKU-${id}`,
    hasVariants: opts.hasVariants ?? false,
    inventory: opts.inventory ?? 100,
    trackInventory: opts.trackInventory ?? true,
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

async function seedVariant(
  productId: string,
  opts: { price: number; inventory?: number; label?: string },
) {
  const id = uid("var");
  await db.insert(schema.productVariants).values({
    id,
    productId,
    variations: JSON.stringify({ Color: opts.label ?? "Red" }),
    price: opts.price,
    sku: `VSKU-${id}`,
    inventory: opts.inventory ?? 100,
    lowStockThreshold: 2,
    isDefault: false,
    active: true,
    position: 1,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

let phoneSeq = 0;
async function seedCustomer() {
  phoneSeq += 1;
  return findOrCreateCustomer(db, {
    phone: `066${String(1000000 + phoneSeq).slice(0, 7)}`,
    name: "Cart Buyer",
    wilayaId: WILAYA,
  });
}

async function place(extra: Record<string, unknown>) {
  const customer = await seedCustomer();
  return createStoreOrder(db, {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    wilayaId: WILAYA,
    communeId: "c-16-001",
    deliveryType: "home",
    deliveryFee: 600,
    productId: "unused",
    productName: "unused",
    quantity: 1,
    pricePerUnit: 1,
    ...extra,
  } as any);
}

const linesOf = (orderId: string) =>
  db.select().from(schema.orderProducts).where(eq(schema.orderProducts.orderId, orderId)).all();

const inventoryOf = async (productId: string) =>
  (await db.select().from(schema.products).where(eq(schema.products.id, productId)).get())!
    .inventory;

const variantInventoryOf = async (variantId: string) =>
  (
    await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId))
      .get()
  )!.inventory;

// ─── Multi-product baskets ────────────────────────────────────────────────────

describe("createStoreOrder — multi-product basket", () => {
  it("writes one order line per product with catalog prices", async () => {
    const a = await seedProduct({ price: 1500, name: "T-Shirt" });
    const b = await seedProduct({ price: 900, name: "Mug" });

    const order = await place({
      items: [
        { productId: a, productName: "T-Shirt", quantity: 2 },
        { productId: b, productName: "Mug", quantity: 3 },
      ],
    });

    // 2 x 1500 + 3 x 900 = 5700 — exact, not approximate.
    expect(order.price).toBe(5700);

    const lines = await linesOf(order.id);
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.productId === a)).toMatchObject({
      quantity: 2,
      pricePerUnit: 1500,
      lineTotal: 3000,
    });
    expect(lines.find((l) => l.productId === b)).toMatchObject({
      quantity: 3,
      pricePerUnit: 900,
      lineTotal: 2700,
    });
  });

  it("sets codAmount to basket total plus delivery", async () => {
    const a = await seedProduct({ price: 1000 });
    const order = await place({
      items: [{ productId: a, productName: "P", quantity: 2 }],
    });

    const row = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)).get();
    expect(row).toMatchObject({ price: 2000, deliveryFee: 600, codAmount: 2600 });
  });

  it("ignores the client's price entirely — the catalog is authoritative", async () => {
    const a = await seedProduct({ price: 5000 });

    const order = await place({
      items: [{ productId: a, productName: "P", quantity: 1, pricePerUnit: 1 }],
    });

    // The client claimed 1 DZD. It is charged 5000.
    expect(order.price).toBe(5000);
  });

  it("keeps two variants of one product as separate lines, priced per variant", async () => {
    const p = await seedProduct({ price: 1000, hasVariants: true });
    const red = await seedVariant(p, { price: 1200, label: "Red" });
    const blue = await seedVariant(p, { price: 1500, label: "Blue" });

    const order = await place({
      items: [
        { productId: p, productName: "P", variantId: red, variantLabel: "Red", quantity: 2 },
        { productId: p, productName: "P", variantId: blue, variantLabel: "Blue", quantity: 1 },
      ],
    });

    expect(order.price).toBe(1200 * 2 + 1500);
    expect(await linesOf(order.id)).toHaveLength(2);
  });

  it("merges the same product+variant sent twice into one line", async () => {
    const p = await seedProduct({ price: 1000 });

    const order = await place({
      items: [
        { productId: p, productName: "P", quantity: 2 },
        { productId: p, productName: "P", quantity: 3 },
      ],
    });

    const lines = await linesOf(order.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 5, lineTotal: 5000 });
  });

  it("deducts stock per line and logs a movement for each", async () => {
    const a = await seedProduct({ price: 1000, inventory: 10 });
    const b = await seedProduct({ price: 2000, inventory: 5 });

    const order = await place({
      items: [
        { productId: a, productName: "A", quantity: 3 },
        { productId: b, productName: "B", quantity: 2 },
      ],
    });

    expect(await inventoryOf(a)).toBe(7);
    expect(await inventoryOf(b)).toBe(3);

    const movements = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.reference, order.id))
      .all();
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.type === "ORDER_DEDUCTED")).toBe(true);
  });

  it("skips deduction for a product with tracking off, while still deducting the other", async () => {
    const tracked = await seedProduct({ price: 1000, inventory: 10 });
    const untracked = await seedProduct({ price: 1000, inventory: 10, trackInventory: false });

    const order = await place({
      items: [
        { productId: tracked, productName: "T", quantity: 2 },
        { productId: untracked, productName: "U", quantity: 4 },
      ],
    });

    expect(await inventoryOf(tracked)).toBe(8);
    expect(await inventoryOf(untracked)).toBe(10);
    expect(await linesOf(order.id)).toHaveLength(2);
  });
});

// ─── All-or-nothing: the failure paths ────────────────────────────────────────

describe("createStoreOrder — a basket is all or nothing", () => {
  it("rolls the WHOLE order back when one line lacks stock", async () => {
    const ok = await seedProduct({ price: 1000, inventory: 100 });
    const short = await seedProduct({ price: 1000, inventory: 1 });

    await expect(
      place({
        items: [
          { productId: ok, productName: "OK", quantity: 1 },
          { productId: short, productName: "SHORT", quantity: 5 },
        ],
      }),
    ).rejects.toThrow();

    // Nothing at all may survive: no order, no lines, no movements, and the
    // healthy product's stock must be untouched.
    expect(await db.select().from(schema.orders).all()).toHaveLength(0);
    expect(await db.select().from(schema.orderProducts).all()).toHaveLength(0);
    expect(await db.select().from(schema.stockMovements).all()).toHaveLength(0);
    expect(await inventoryOf(ok)).toBe(100);
    expect(await inventoryOf(short)).toBe(1);
  });

  it("does not bump customer stats when the order is rejected", async () => {
    const short = await seedProduct({ price: 1000, inventory: 0 });
    const customer = await seedCustomer();

    await expect(
      createStoreOrder(db, {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        wilayaId: WILAYA,
        communeId: "c-16-001",
        deliveryType: "home",
        deliveryFee: 600,
        productId: short,
        productName: "SHORT",
        quantity: 1,
        pricePerUnit: 1000,
      } as any),
    ).rejects.toThrow();

    const after = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, customer.id))
      .get();
    expect(after).toMatchObject({ totalOrders: 0, totalSpent: 0 });
  });

  it("refuses a basket over the line cap before touching the database", async () => {
    const p = await seedProduct({ price: 1000 });
    const items = Array.from({ length: 21 }, (_, i) => ({
      productId: i === 0 ? p : `prod_${i}`,
      productName: `P${i}`,
      quantity: 1,
    }));

    await expect(place({ items })).rejects.toBeInstanceOf(CartValidationError);
    expect(await db.select().from(schema.orders).all()).toHaveLength(0);
  });

  it("refuses when merged duplicates exceed the per-line quantity cap", async () => {
    const p = await seedProduct({ price: 10, inventory: 100000 });

    await expect(
      place({
        items: [
          { productId: p, productName: "P", quantity: 60 },
          { productId: p, productName: "P", quantity: 60 },
        ],
      }),
    ).rejects.toBeInstanceOf(CartValidationError);
    expect(await db.select().from(schema.orders).all()).toHaveLength(0);
  });
});

// ─── Legacy shapes keep working ───────────────────────────────────────────────

describe("createStoreOrder — legacy request shapes are unchanged", () => {
  it("flat single product behaves exactly as before", async () => {
    const p = await seedProduct({ price: 1500, inventory: 10 });

    const order = await place({
      productId: p,
      productName: "T-Shirt",
      quantity: 2,
      pricePerUnit: 1500,
    });

    expect(order.price).toBe(3000);
    expect(order.deliveryFee).toBe(600);
    expect(await linesOf(order.id)).toHaveLength(1);
    expect(await inventoryOf(p)).toBe(8);
  });

  it("variantSelections groups per-unit picks into lines", async () => {
    const p = await seedProduct({ price: 1000, hasVariants: true });
    const red = await seedVariant(p, { price: 1200, inventory: 10, label: "Red" });
    const blue = await seedVariant(p, { price: 1500, inventory: 10, label: "Blue" });

    const order = await place({
      productId: p,
      productName: "P",
      quantity: 3,
      pricePerUnit: 1200,
      variantSelections: [
        { variantId: red, variantLabel: "Red" },
        { variantId: red, variantLabel: "Red" },
        { variantId: blue, variantLabel: "Blue" },
      ],
    });

    // Sum of the LINES (2x1200 + 1x1500), never quantity x unit price.
    expect(order.price).toBe(3900);
    expect(await linesOf(order.id)).toHaveLength(2);
    expect(await variantInventoryOf(red)).toBe(8);
    expect(await variantInventoryOf(blue)).toBe(9);
  });
});

// ─── Offers across a basket ───────────────────────────────────────────────────

async function seedOffer(opts: {
  triggerProductId: string;
  triggerQuantity: number;
  rewardProductId?: string | null;
  rewardQuantity?: number;
  discountType?: "free" | "free_shipping";
}) {
  const id = uid("offer");
  await db.insert(schema.offers).values({
    id,
    name: "Offer",
    triggerProductId: opts.triggerProductId,
    triggerQuantity: opts.triggerQuantity,
    rewardProductId: opts.rewardProductId ?? null,
    rewardQuantity: opts.rewardQuantity ?? 1,
    discountType: opts.discountType ?? "free",
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

describe("createStoreOrder — offers in a basket", () => {
  it("adds a free reward line at zero price without changing the total", async () => {
    const p = await seedProduct({ price: 1000, inventory: 10 });
    await seedOffer({ triggerProductId: p, triggerQuantity: 2, rewardProductId: p });

    const order = await place({
      items: [{ productId: p, productName: "P", quantity: 2 }],
    });

    expect(order.price).toBe(2000);
    const lines = await linesOf(order.id);
    expect(lines).toHaveLength(2);
    const reward = lines.find((l) => l.pricePerUnit === 0)!;
    expect(reward).toMatchObject({ lineTotal: 0, quantity: 1 });
    // 2 sold + 1 free = 3 units off the shelf.
    expect(await inventoryOf(p)).toBe(7);
  });

  it("counts a product across its variants when testing the trigger", async () => {
    const p = await seedProduct({ price: 1000, hasVariants: true, inventory: 10 });
    const red = await seedVariant(p, { price: 1000, inventory: 10, label: "Red" });
    const blue = await seedVariant(p, { price: 1000, inventory: 10, label: "Blue" });
    await seedOffer({ triggerProductId: p, triggerQuantity: 3, rewardProductId: p });

    // 2 red + 1 blue = three of that product, so a "buy 3" offer must fire.
    const order = await place({
      items: [
        { productId: p, productName: "P", variantId: red, quantity: 2 },
        { productId: p, productName: "P", variantId: blue, quantity: 1 },
      ],
    });

    const lines = await linesOf(order.id);
    expect(lines.filter((l) => l.pricePerUnit === 0)).toHaveLength(1);
  });

  it("skips the reward when its stock cannot cover it, and still places the order", async () => {
    const p = await seedProduct({ price: 1000, inventory: 10 });
    const reward = await seedProduct({ price: 500, inventory: 0 });
    await seedOffer({ triggerProductId: p, triggerQuantity: 2, rewardProductId: reward });

    const order = await place({
      items: [{ productId: p, productName: "P", quantity: 2 }],
    });

    expect(order.price).toBe(2000);
    expect(await linesOf(order.id)).toHaveLength(1);
  });

  it("does not let a reward line trigger another offer", async () => {
    const p = await seedProduct({ price: 1000, inventory: 100 });
    // Buy 2 get 1 free. The free unit must NOT count towards the next trigger.
    await seedOffer({ triggerProductId: p, triggerQuantity: 2, rewardProductId: p });

    const order = await place({
      items: [{ productId: p, productName: "P", quantity: 2 }],
    });

    const lines = await linesOf(order.id);
    expect(lines.filter((l) => l.pricePerUnit === 0)).toHaveLength(1);
    expect(await inventoryOf(p)).toBe(97);
  });

  it("free shipping applies when the basket holds ONE product", async () => {
    const p = await seedProduct({ price: 1000, inventory: 10 });
    await seedOffer({
      triggerProductId: p,
      triggerQuantity: 2,
      discountType: "free_shipping",
      rewardProductId: null,
      rewardQuantity: 0,
    });

    const order = await place({
      items: [{ productId: p, productName: "P", quantity: 2 }],
    });

    expect(order.deliveryFee).toBe(0);
  });

  it("free shipping does NOT apply to a multi-product basket (Q2)", async () => {
    const cheap = await seedProduct({ price: 200, inventory: 10 });
    const pricey = await seedProduct({ price: 50000, inventory: 10 });
    await seedOffer({
      triggerProductId: cheap,
      triggerQuantity: 2,
      discountType: "free_shipping",
      rewardProductId: null,
      rewardQuantity: 0,
    });

    const order = await place({
      items: [
        { productId: cheap, productName: "Case", quantity: 2 },
        { productId: pricey, productName: "TV", quantity: 1 },
      ],
    });

    // The loophole: a 400 DZD trigger must not ship a 50400 DZD basket free.
    expect(order.deliveryFee).toBe(600);
    expect(order.price).toBe(50400);
  });

  it("ignores an offerId the shopper did not actually earn", async () => {
    const p = await seedProduct({ price: 1000, inventory: 10 });
    const offerId = await seedOffer({
      triggerProductId: p,
      triggerQuantity: 5,
      rewardProductId: p,
    });

    // Claims the "buy 5" tier while ordering 1.
    const order = await place({
      items: [{ productId: p, productName: "P", quantity: 1, offerId }],
    });

    expect(await linesOf(order.id)).toHaveLength(1);
    expect(order.price).toBe(1000);
  });

  it("picks the highest tier the basket actually satisfies", async () => {
    const p = await seedProduct({ price: 1000, inventory: 100 });
    await seedOffer({ triggerProductId: p, triggerQuantity: 2, rewardProductId: p, rewardQuantity: 1 });
    await seedOffer({ triggerProductId: p, triggerQuantity: 4, rewardProductId: p, rewardQuantity: 3 });

    const order = await place({
      items: [{ productId: p, productName: "P", quantity: 5 }],
    });

    const reward = (await linesOf(order.id)).find((l) => l.pricePerUnit === 0)!;
    expect(reward.quantity).toBe(3); // the "buy 4" tier, not "buy 2"
  });

  it("does not apply an offer whose schedule has passed", async () => {
    const p = await seedProduct({ price: 1000, inventory: 10 });
    const id = uid("offer");
    await db.insert(schema.offers).values({
      id,
      name: "Expired",
      triggerProductId: p,
      triggerQuantity: 2,
      rewardProductId: p,
      rewardQuantity: 1,
      discountType: "free",
      status: "active",
      startsAt: "2020-01-01T00:00:00.000Z",
      endsAt: "2020-02-01T00:00:00.000Z",
      createdAt: now(),
      updatedAt: now(),
    });

    const order = await place({
      items: [{ productId: p, productName: "P", quantity: 2 }],
    });

    expect(await linesOf(order.id)).toHaveLength(1);
  });

  it("fires offers on two different products in the same basket", async () => {
    const a = await seedProduct({ price: 1000, inventory: 100 });
    const b = await seedProduct({ price: 2000, inventory: 100 });
    await seedOffer({ triggerProductId: a, triggerQuantity: 2, rewardProductId: a });
    await seedOffer({ triggerProductId: b, triggerQuantity: 2, rewardProductId: b });

    const order = await place({
      items: [
        { productId: a, productName: "A", quantity: 2 },
        { productId: b, productName: "B", quantity: 2 },
      ],
    });

    const lines = await linesOf(order.id);
    expect(lines.filter((l) => l.pricePerUnit === 0)).toHaveLength(2);
    expect(order.price).toBe(2000 + 4000);
  });
});

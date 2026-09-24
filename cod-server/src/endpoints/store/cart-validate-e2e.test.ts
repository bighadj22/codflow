/**
 * POST /store/cart/validate — real-D1 E2E.
 *
 * This endpoint exists so the cart drawer can tell the truth before a shopper
 * commits. Its whole value is that it answers from the same snapshot, the same
 * pricing function and the same offer rules the order engine uses, so the
 * total shown and the total charged cannot drift.
 *
 * The cases below weight the unhappy paths deliberately: a basket that has
 * gone stale in a browser tab is the normal case, not the exception.
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
import storeRouter from "./routes";

const registry: Miniflare[] = [];
let db: AppDb;
let storeId: string;

vi.mock("@/db", () => ({ getDb: () => db }));

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "cart-validate-db" },
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
  await db.delete(schema.offers);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
  await db.delete(schema.stores);
  storeId = `store-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(schema.stores).values({
    id: storeId,
    name: "Validate Store",
    createdAt: now(),
    updatedAt: now(),
  });
});

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

function makeApp() {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {} } as any;
    c.set("storeId", storeId);
    await next();
  });
  app.onError(errorHandler);
  app.route("/store", storeRouter);
  return app;
}

async function validate(items: unknown) {
  const res = await makeApp().request("/store/cart/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function seedProduct(opts: {
  price: number;
  inventory?: number;
  trackInventory?: boolean;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  showInStore?: boolean;
  visibility?: boolean;
  deletedAt?: string | null;
  name?: string;
}) {
  const id = uid("prod");
  await db.insert(schema.products).values({
    id,
    name: opts.name ?? "Product",
    handle: `handle-${id}`,
    price: opts.price,
    sku: `SKU-${id}`,
    hasVariants: false,
    inventory: opts.inventory ?? 10,
    trackInventory: opts.trackInventory ?? true,
    lowStockThreshold: 2,
    status: opts.status ?? "ACTIVE",
    visibility: opts.visibility ?? true,
    showInStore: opts.showInStore ?? true,
    storeFeatured: false,
    deletedAt: opts.deletedAt ?? null,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

// ─── Pricing truth ────────────────────────────────────────────────────────────

describe("POST /store/cart/validate — pricing", () => {
  it("prices every line from the catalog and sums the subtotal", async () => {
    const a = await seedProduct({ price: 1500, name: "Shirt" });
    const b = await seedProduct({ price: 900, name: "Mug" });

    const { status, body } = await validate([
      { productId: a, productName: "Shirt", quantity: 2 },
      { productId: b, productName: "Mug", quantity: 3 },
    ]);

    expect(status).toBe(200);
    expect(body.data.subtotal).toBe(1500 * 2 + 900 * 3);
    expect(body.data.lines).toHaveLength(2);
    expect(body.data.lines[0]).toMatchObject({
      unitPrice: 1500,
      lineTotal: 3000,
      blocker: null,
    });
  });

  it("returns the CURRENT price, not the one the browser remembered", async () => {
    // A tab left open overnight is the normal case for a cart.
    const id = await seedProduct({ price: 2000 });

    const { body } = await validate([
      { productId: id, productName: "Stale", quantity: 1, pricePerUnit: 1 },
    ]);

    expect(body.data.lines[0].unitPrice).toBe(2000);
  });

  it("returns the catalog's product name, not the browser's copy", async () => {
    const id = await seedProduct({ price: 1000, name: "Renamed In Catalog" });

    const { body } = await validate([
      { productId: id, productName: "Old Name From Cart", quantity: 1 },
    ]);

    expect(body.data.lines[0].productName).toBe("Renamed In Catalog");
  });

  it("merges duplicate lines for the same product", async () => {
    const id = await seedProduct({ price: 1000 });

    const { body } = await validate([
      { productId: id, productName: "P", quantity: 2 },
      { productId: id, productName: "P", quantity: 1 },
    ]);

    expect(body.data.lines).toHaveLength(1);
    expect(body.data.lines[0]).toMatchObject({ quantity: 3, lineTotal: 3000 });
  });
});

// ─── Availability — the unhappy paths ─────────────────────────────────────────

describe("POST /store/cart/validate — blocked lines", () => {
  it("flags a product that no longer exists", async () => {
    const { body } = await validate([
      { productId: "prod-vanished", productName: "Ghost", quantity: 1 },
    ]);

    expect(body.data.lines[0].blocker).toBe("missing");
  });

  it("flags a product the merchant has hidden", async () => {
    const id = await seedProduct({ price: 1000, showInStore: false });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 1 }]);

    expect(body.data.lines[0].blocker).toBe("unlisted");
  });

  it("flags a draft product", async () => {
    const id = await seedProduct({ price: 1000, status: "DRAFT" });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 1 }]);

    expect(body.data.lines[0].blocker).toBe("unlisted");
  });

  it("flags a soft-deleted product", async () => {
    const id = await seedProduct({ price: 1000, deletedAt: now() });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 1 }]);

    expect(body.data.lines[0].blocker).toBe("unlisted");
  });

  it("does not distinguish hidden from draft, so the catalog state does not leak", async () => {
    const hidden = await seedProduct({ price: 1000, showInStore: false });
    const draft = await seedProduct({ price: 1000, status: "DRAFT" });

    const { body } = await validate([
      { productId: hidden, productName: "A", quantity: 1 },
      { productId: draft, productName: "B", quantity: 1 },
    ]);

    expect(body.data.lines[0].blocker).toBe(body.data.lines[1].blocker);
  });

  it("flags a line asking for more units than exist, and reports the cap", async () => {
    const id = await seedProduct({ price: 1000, inventory: 3 });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 5 }]);

    expect(body.data.lines[0]).toMatchObject({
      blocker: "out_of_stock",
      maxQuantity: 3,
    });
  });

  it("allows exactly the available quantity", async () => {
    const id = await seedProduct({ price: 1000, inventory: 3 });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 3 }]);

    expect(body.data.lines[0].blocker).toBeNull();
  });

  it("reports no cap for a product that is not stock-tracked", async () => {
    const id = await seedProduct({ price: 1000, trackInventory: false, inventory: 0 });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 99 }]);

    expect(body.data.lines[0]).toMatchObject({ blocker: null, maxQuantity: null });
  });

  it("excludes a blocked line from the subtotal", async () => {
    // A basket must never promise a total built on something unbuyable.
    const good = await seedProduct({ price: 1000 });
    const gone = await seedProduct({ price: 50_000, showInStore: false });

    const { body } = await validate([
      { productId: good, productName: "Good", quantity: 2 },
      { productId: gone, productName: "Gone", quantity: 1 },
    ]);

    expect(body.data.subtotal).toBe(2000);
    expect(body.data.lines).toHaveLength(2); // still reported, so the UI can show it
  });
});

// ─── Offers and free delivery ─────────────────────────────────────────────────

describe("POST /store/cart/validate — offers and free delivery", () => {
  async function seedOffer(opts: {
    triggerProductId: string;
    triggerQuantity: number;
    rewardProductId?: string | null;
    discountType?: "free" | "free_shipping";
  }) {
    const id = uid("offer");
    await db.insert(schema.offers).values({
      id,
      name: "Offer",
      triggerProductId: opts.triggerProductId,
      triggerQuantity: opts.triggerQuantity,
      rewardProductId: opts.rewardProductId ?? null,
      rewardQuantity: opts.discountType === "free_shipping" ? 0 : 1,
      discountType: opts.discountType ?? "free",
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    });
    return id;
  }

  it("reports the reward a basket has earned", async () => {
    const id = await seedProduct({ price: 1000, name: "Shirt" });
    await seedOffer({ triggerProductId: id, triggerQuantity: 2, rewardProductId: id });

    const { body } = await validate([{ productId: id, productName: "Shirt", quantity: 2 }]);

    expect(body.data.rewards).toHaveLength(1);
    expect(body.data.rewards[0]).toMatchObject({ productName: "Shirt", quantity: 1 });
  });

  it("reports no reward below the trigger", async () => {
    const id = await seedProduct({ price: 1000 });
    await seedOffer({ triggerProductId: id, triggerQuantity: 3, rewardProductId: id });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 2 }]);

    expect(body.data.rewards).toHaveLength(0);
  });

  it("does not let a blocked line earn a reward", async () => {
    const id = await seedProduct({ price: 1000, inventory: 1 });
    await seedOffer({ triggerProductId: id, triggerQuantity: 2, rewardProductId: id });

    // Asking for 2 when 1 exists: the line is blocked, so nothing is earned.
    const { body } = await validate([{ productId: id, productName: "P", quantity: 2 }]);

    expect(body.data.lines[0].blocker).toBe("out_of_stock");
    expect(body.data.rewards).toHaveLength(0);
  });

  it("reports free delivery from a single-product offer", async () => {
    const id = await seedProduct({ price: 1000 });
    await seedOffer({
      triggerProductId: id,
      triggerQuantity: 2,
      discountType: "free_shipping",
      rewardProductId: null,
    });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 2 }]);

    expect(body.data.freeDelivery.fromOffer).toBe(true);
  });

  it("does NOT report offer free delivery once a second product joins", async () => {
    const cheap = await seedProduct({ price: 200 });
    const pricey = await seedProduct({ price: 50_000 });
    await seedOffer({
      triggerProductId: cheap,
      triggerQuantity: 2,
      discountType: "free_shipping",
      rewardProductId: null,
    });

    const { body } = await validate([
      { productId: cheap, productName: "Case", quantity: 2 },
      { productId: pricey, productName: "TV", quantity: 1 },
    ]);

    expect(body.data.freeDelivery.fromOffer).toBe(false);
  });

  it("tells the shopper how much more to spend to earn free delivery", async () => {
    await db.update(schema.stores).set({ freeShippingThreshold: 10_000 });
    const id = await seedProduct({ price: 1000 });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 3 }]);

    expect(body.data.freeDelivery).toMatchObject({
      threshold: 10_000,
      qualified: false,
      remaining: 7_000,
    });
  });

  it("reports qualified with nothing remaining once the threshold is met", async () => {
    await db.update(schema.stores).set({ freeShippingThreshold: 3_000 });
    const id = await seedProduct({ price: 1000 });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 3 }]);

    expect(body.data.freeDelivery).toMatchObject({
      qualified: true,
      remaining: 0,
    });
  });

  it("reports the threshold inactive when the merchant has not set one", async () => {
    const id = await seedProduct({ price: 1000 });

    const { body } = await validate([{ productId: id, productName: "P", quantity: 1 }]);

    expect(body.data.freeDelivery).toMatchObject({
      threshold: null,
      qualified: false,
      remaining: 0,
    });
  });

  it("does not count a blocked line toward the free-delivery threshold", async () => {
    // Otherwise the drawer promises free delivery the checkout will not honour.
    await db.update(schema.stores).set({ freeShippingThreshold: 10_000 });
    const good = await seedProduct({ price: 1000 });
    const gone = await seedProduct({ price: 50_000, showInStore: false });

    const { body } = await validate([
      { productId: good, productName: "Good", quantity: 1 },
      { productId: gone, productName: "Gone", quantity: 1 },
    ]);

    expect(body.data.freeDelivery.qualified).toBe(false);
    expect(body.data.freeDelivery.remaining).toBe(9_000);
  });
});

// ─── Request bounds ───────────────────────────────────────────────────────────

describe("POST /store/cart/validate — bounds", () => {
  it("rejects an empty basket", async () => {
    const { status } = await validate([]);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it("rejects more than 20 lines", async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      productId: `prod_${i}`,
      productName: `P${i}`,
      quantity: 1,
    }));
    const { status } = await validate(items);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it("rejects a line over the quantity cap", async () => {
    const id = await seedProduct({ price: 1000 });
    const { status } = await validate([
      { productId: id, productName: "P", quantity: 101 },
    ]);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it("writes nothing — it is read-only", async () => {
    const id = await seedProduct({ price: 1000, inventory: 10 });

    await validate([{ productId: id, productName: "P", quantity: 5 }]);

    const after = await db
      .select({ inventory: schema.products.inventory })
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .get();
    expect(after!.inventory).toBe(10); // no stock reserved
    expect(await db.select().from(schema.orders).all()).toHaveLength(0);
  });
});

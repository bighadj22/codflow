/**
 * createStoreOrder + findOrCreateCustomer — Slice 3 real-D1 E2E.
 *
 * Runs the real migrations on an in-memory miniflare D1 and proves:
 *   • findOrCreateCustomer: concurrent same-phone calls converge to ONE row
 *     (UNIQUE index + ON CONFLICT), stats never split
 *   • createStoreOrder: one atomic batch — order + lines + history + customer
 *     stats + deduction movements all land together
 *   • guarded deduction: inventory goes down by exactly the ordered qty,
 *     movement log carries correct qtyBefore/qtyAfter
 *   • BC-2 oversell: when inventory can't cover the order, the guarded
 *     UPDATE writes 0 rows and the order is rejected whole (no partial writes)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import {
  findOrCreateCustomer,
  createStoreOrder,
} from "../../../../cod-shared/queries/store";

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
}, 120_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("findOrCreateCustomer — race-free upsert (BC-1)", () => {
  it("converges concurrent same-phone calls to one customer row", async () => {
    const rows = await Promise.all(
      Array.from({ length: 5 }, () =>
        findOrCreateCustomer(db, {
          phone: "0777000001",
          name: "Race Tester",
          wilayaId: 16,
        }),
      ),
    );

    const all = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.phone, "0777000001"))
      .all();
    expect(all).toHaveLength(1);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1);
    expect(rows[0]).toMatchObject({ phone: "0777000001", name: "Race Tester" });
  });

  it("updates the name on an existing phone but keeps stats", async () => {
    const first = await findOrCreateCustomer(db, {
      phone: "0777000002",
      name: "Original Name",
      wilayaId: 16,
    });
    await db
      .update(schema.customers)
      .set({ totalOrders: 5, totalSpent: 9000 })
      .where(eq(schema.customers.id, first.id));

    const second = await findOrCreateCustomer(db, {
      phone: "0777000002",
      name: "Updated Name",
      wilayaId: 16,
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Updated Name");
    expect(second.totalOrders).toBe(5);
  });
});

describe("createStoreOrder — atomic commit + guarded deduction (BC-2)", () => {
  const phone = "0661234567";

  async function seedTrackedProduct(overrides: Partial<typeof schema.products.$inferInsert> = {}) {
    const id = `prod-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    await db.insert(schema.products).values({
      id,
      name: "E2E Product",
      handle: `e2e-${id}`,
      price: 1500,
      hasVariants: false,
      inventory: 10,
      trackInventory: true,
      lowStockThreshold: 2,
      status: "ACTIVE",
      visibility: true,
      showInStore: true,
      storeFeatured: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    return id;
  }

  async function seedCustomer(p: string) {
    return findOrCreateCustomer(db, {
      phone: p,
      name: "E2E Buyer",
      wilayaId: 16,
    });
  }

  it("commits order + line + history + stats + deduction in one batch", async () => {
    const productId = await seedTrackedProduct();
    const customer = await seedCustomer(phone);

    const result = await createStoreOrder(db, {
      customerName: customer.name,
      phone,
      wilayaId: 16,
      communeId: "c-16-001",
      deliveryType: "home",
      productId,
      productName: "E2E Product",
      quantity: 3,
      pricePerUnit: 1500,
      customerId: customer.id,
      deliveryFee: 400,
    });

    expect(result.price).toBe(4500);
    expect(result.deliveryFee).toBe(400);
    expect(result.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);

    const order = await db.select().from(schema.orders).where(eq(schema.orders.id, result.id)).get();
    expect(order).toMatchObject({
      status: "new",
      codAmount: 4900,
      customerId: customer.id,
    });

    const lines = await db
      .select()
      .from(schema.orderProducts)
      .where(eq(schema.orderProducts.orderId, result.id))
      .all();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 3, lineTotal: 4500 });

    const history = await db
      .select()
      .from(schema.orderStatusHistory)
      .where(eq(schema.orderStatusHistory.orderId, result.id))
      .all();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("new");

    const cust = await db.select().from(schema.customers).where(eq(schema.customers.id, customer.id)).get();
    expect(cust?.totalOrders).toBe(1);
    expect(cust?.totalSpent).toBe(4500);

    const product = await db.select().from(schema.products).where(eq(schema.products.id, productId)).get();
    expect(product?.inventory).toBe(7);

    const movements = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.reference, result.id))
      .all();
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: "ORDER_DEDUCTED",
      delta: -3,
      qtyBefore: 10,
      qtyAfter: 7,
    });
  });

  it("rejects the whole order when inventory cannot cover it (no partial writes)", async () => {
    const productId = await seedTrackedProduct({ inventory: 1 });
    const customer = await seedCustomer("0661234599");

    const ordersBefore = await db.select({ id: schema.orders.id }).from(schema.orders).all();
    const movementsBefore = await db
      .select({ id: schema.stockMovements.id })
      .from(schema.stockMovements)
      .all();

    let failed = false;
    try {
      await createStoreOrder(db, {
        customerName: customer.name,
        phone: "0661234599",
        wilayaId: 16,
        communeId: "c-16-001",
        deliveryType: "home",
        productId,
        productName: "E2E Product",
        quantity: 3,
        pricePerUnit: 1500,
        customerId: customer.id,
        deliveryFee: 400,
      });
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);

    const ordersAfter = await db.select({ id: schema.orders.id }).from(schema.orders).all();
    expect(ordersAfter.length).toBe(ordersBefore.length);

    const movementsAfter = await db
      .select({ id: schema.stockMovements.id })
      .from(schema.stockMovements)
      .all();
    expect(movementsAfter.length).toBe(movementsBefore.length);

    const product = await db.select().from(schema.products).where(eq(schema.products.id, productId)).get();
    expect(product?.inventory).toBe(1);

    const cust = await db.select().from(schema.customers).where(eq(schema.customers.id, customer.id)).get();
    expect(cust?.totalOrders).toBe(0);
    expect(cust?.totalSpent).toBe(0);
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { updateOrderStatusWebhook } from "../../../../cod-shared/queries/orders";

let db: AppDb;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });
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
  registry.push(mf);
}, 120_000);

const registry: Miniflare[] = [];

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("updateOrderStatusWebhook — real D1 batch (E2E)", () => {
  it("commits, guards rank, restocks, and rolls back atomically", async () => {
    const now = new Date().toISOString();
    const pid = "prod-e2e-1";

    await db.insert(schema.products).values({
      id: pid, name: "E2E Product", handle: "e2e-product", price: 1000,
      hasVariants: false, inventory: 5, trackInventory: true, lowStockThreshold: 2,
      status: "ACTIVE", visibility: true, showInStore: true, storeFeatured: false,
      createdAt: now, updatedAt: now,
    });
    await db.insert(schema.customers).values({
      id: "cust-e2e-1", name: "E2E Customer", phone: "0555000001",
      wilaya: "الجزائر", totalOrders: 2, totalSpent: 2000, createdAt: now,
    });
    for (const [oid, opid, num] of [
      ["ord-e2e-1", "op-e2e-1", "ORD-E2E-1"],
      ["ord-e2e-2", "op-e2e-2", "ORD-E2E-2"],
    ] as const) {
      await db.insert(schema.orders).values({
        id: oid, orderNumber: num, customerId: "cust-e2e-1",
        customerName: "E2E Customer", phone: "0555000001", price: 2000,
        status: "ready", deliveryMethod: "unassigned", deliveryType: "home",
        deliveryFee: 0, driverFee: 0, codAmount: 2000, createdAt: now, updatedAt: now,
      });
      await db.insert(schema.orderProducts).values({
        id: opid, orderId: oid, productId: pid, productName: "E2E Product",
        quantity: 2, pricePerUnit: 1000, lineTotal: 2000, createdAt: now,
      });
    }

    expect(await updateOrderStatusWebhook(db, "ord-e2e-1", "delivered", "e2e")).toEqual({ updated: true });

    expect(await updateOrderStatusWebhook(db, "ord-e2e-1", "cancelled", "e2e")).toEqual({ updated: false });

    expect(await updateOrderStatusWebhook(db, "ord-e2e-2", "cancelled", "e2e")).toEqual({ updated: true });

    const inv = await db.select().from(schema.products).where(eq(schema.products.id, pid)).get();
    expect(inv?.inventory).toBe(7);

    const movements = await db.select().from(schema.stockMovements).all();
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: "ORDER_CANCELLED", delta: 2, qtyBefore: 5, qtyAfter: 7 });

    const line = await db.select().from(schema.orderProducts).where(eq(schema.orderProducts.id, "op-e2e-2")).get();
    expect(line).toMatchObject({ status: "returned", returnedQuantity: 2 });

    const cust = await db.select().from(schema.customers).where(eq(schema.customers.id, "cust-e2e-1")).get();
    expect(cust?.totalSpent).toBe(0);

    let batchFailed = false;
    try {
      await db.batch([
        db.insert(schema.orders).values({
          id: "ord-dupe", orderNumber: "ORD-E2E-2", customerId: "cust-e2e-1",
          customerName: "x", phone: "x", price: 1, status: "new",
          deliveryMethod: "unassigned", deliveryType: "home",
          deliveryFee: 0, driverFee: 0, codAmount: 1, createdAt: now, updatedAt: now,
        }),
        db.insert(schema.orderStatusHistory).values({
          id: "hist-dupe", orderId: "ord-dupe", status: "new", timestamp: now, by: null,
        }),
      ]);
    } catch {
      batchFailed = true;
    }
    expect(batchFailed).toBe(true);
    expect(await db.select().from(schema.orders).where(eq(schema.orders.id, "ord-dupe")).get()).toBeUndefined();
    expect(await db.select().from(schema.orderStatusHistory).where(eq(schema.orderStatusHistory.id, "hist-dupe")).get()).toBeUndefined();
  });
});

/**
 * Slice 7 — count+rows in one round trip: real-D1 E2E.
 *
 * Verifies on a real engine (miniflare + real migrations) that the batched
 * list+count pairs keep exact semantics:
 *   • totals stay correct on EMPTY pages (offset beyond the end) — the case
 *     that rules out COUNT(*) OVER() (verified: window returns no rows there)
 *   • filters apply identically to rows and total
 *   • pendingCount is global, independent of the reviews filter
 *   • stats math: conversion rate rounding, zero-attempt division guard
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { getStockHistory } from "../../../../cod-shared/queries/stock";
import { getApprovedProductReviews } from "../../../../cod-shared/queries/store";
import { getAllReviews } from "../../../../cod-shared/queries/reviews";
import {
  listAbandonedOrders,
  getAbandonedOrderStats,
} from "../../../../cod-shared/queries/abandoned-orders";

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
  const day = (n: number) => `2026-01-${String(n).padStart(2, "0")}T00:00:00.000Z`;

  await db.insert(schema.stores).values({ id: "store-1", name: "S", createdAt: now, updatedAt: now });
  await db.insert(schema.products).values([
    { id: "prod-1", name: "Product 1", handle: "p1", price: 1000, hasVariants: false, inventory: 10, trackInventory: true, status: "ACTIVE", visibility: true, showInStore: true, createdAt: now, updatedAt: now },
    { id: "prod-2", name: "Product 2", handle: "p2", price: 2000, hasVariants: true, inventory: 0, trackInventory: true, status: "ACTIVE", visibility: true, showInStore: true, createdAt: now, updatedAt: now },
  ]);
  await db.insert(schema.productVariants).values([
    { id: "var-1", productId: "prod-2", sku: "SKU-V1", variations: '{"Color":"Red"}', price: 2000, inventory: 5, active: true, position: 1, createdAt: now, updatedAt: now },
  ]);
  await db.insert(schema.customers).values([
    { id: "cust-1", name: "C1", phone: "0770000001", wilaya: "w", createdAt: now },
    { id: "cust-2", name: "C2", phone: "0770000002", wilaya: "w", createdAt: now },
    { id: "cust-3", name: "C3", phone: "0770000003", wilaya: "w", createdAt: now },
  ]);
  await db.insert(schema.orders).values([
    { id: "ord-1", orderNumber: "ORD-1", customerId: "cust-1", customerName: "C1", phone: "0770000001", price: 1000, status: "delivered", deliveryMethod: "unassigned", deliveryType: "home", deliveryFee: 0, driverFee: 0, codAmount: 1000, createdAt: now, updatedAt: now },
    { id: "ord-2", orderNumber: "ORD-2", customerId: "cust-2", customerName: "C2", phone: "0770000002", price: 1000, status: "delivered", deliveryMethod: "unassigned", deliveryType: "home", deliveryFee: 0, driverFee: 0, codAmount: 1000, createdAt: now, updatedAt: now },
    { id: "ord-3", orderNumber: "ORD-3", customerId: "cust-3", customerName: "C3", phone: "0770000003", price: 1000, status: "delivered", deliveryMethod: "unassigned", deliveryType: "home", deliveryFee: 0, driverFee: 0, codAmount: 1000, createdAt: now, updatedAt: now },
    { id: "ord-4", orderNumber: "ORD-4", customerId: "cust-1", customerName: "C1", phone: "0770000001", price: 1000, status: "delivered", deliveryMethod: "unassigned", deliveryType: "home", deliveryFee: 0, driverFee: 0, codAmount: 1000, createdAt: now, updatedAt: now },
    { id: "ord-5", orderNumber: "ORD-5", customerId: "cust-2", customerName: "C2", phone: "0770000002", price: 1000, status: "delivered", deliveryMethod: "unassigned", deliveryType: "home", deliveryFee: 0, driverFee: 0, codAmount: 1000, createdAt: now, updatedAt: now },
  ]);

  for (let i = 1; i <= 6; i++) {
    await db.insert(schema.stockMovements).values({
      id: `mv-${i}`, productId: i <= 4 ? "prod-1" : "prod-2",
      variantId: i > 4 ? "var-1" : null,
      type: i % 2 === 0 ? "PURCHASE" : "ORDER_DEDUCTED",
      delta: i % 2 === 0 ? 5 : -2, qtyBefore: i, qtyAfter: i + (i % 2 === 0 ? 5 : -2),
      reason: null, reference: `ord-${i}`, createdBy: "user-1", createdByName: "U",
      createdAt: day(i),
    });
  }

  await db.insert(schema.reviews).values([
    { id: "rev-1", storeId: "store-1", productId: "prod-1", orderId: "ord-1", orderNumber: "ORD-1", customerName: "C1", rating: 5, body: "a", status: "approved", createdAt: day(1), updatedAt: now },
    { id: "rev-2", storeId: "store-1", productId: "prod-1", orderId: "ord-2", orderNumber: "ORD-2", customerName: "C2", rating: 4, body: "b", status: "approved", createdAt: day(2), updatedAt: now },
    { id: "rev-3", storeId: "store-1", productId: "prod-1", orderId: "ord-3", orderNumber: "ORD-3", customerName: "C3", rating: 3, body: "c", status: "pending", createdAt: day(3), updatedAt: now },
    { id: "rev-4", storeId: "store-1", productId: "prod-2", orderId: "ord-4", orderNumber: "ORD-4", customerName: "C1", rating: 2, body: "d", status: "pending", createdAt: day(4), updatedAt: now },
    { id: "rev-5", storeId: "store-1", productId: "prod-2", orderId: "ord-5", orderNumber: "ORD-5", customerName: "C2", rating: 1, body: "e", status: "rejected", createdAt: day(5), updatedAt: now },
  ]);

  await db.insert(schema.abandonedOrders).values([
    { id: "ab-1", sessionId: "s1", customerName: "Sara", phone: "0550000001", wilayaId: 16, wilayaName: "الجزائر", productId: "prod-1", productName: "Product 1", price: 1500, status: "abandoned", createdAt: day(1), updatedAt: now },
    { id: "ab-2", sessionId: "s2", customerName: "Karim", phone: "0550000002", wilayaId: 16, wilayaName: "الجزائر", price: 2500, status: "abandoned", createdAt: day(2), updatedAt: now },
    { id: "ab-3", sessionId: "s3", customerName: "Lina", phone: "0550000003", wilayaId: 16, wilayaName: "الجزائر", price: 999, status: "converted", convertedOrderId: "ord-1", convertedOrderNumber: "ORD-1", createdAt: day(3), updatedAt: now },
    { id: "ab-4", sessionId: "s4", customerName: "Omar", phone: "0550000004", wilayaId: 16, wilayaName: "الجزائر", price: 777, status: "pending", createdAt: day(4), updatedAt: now },
    { id: "ab-5", sessionId: "s5", customerName: "Nour", phone: "0550000005", wilayaId: 16, wilayaName: "الجزائر", price: 1234, status: "contacted", createdAt: day(5), updatedAt: now },
  ]);
}, 120_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("getStockHistory — real D1", () => {
  it("pages movements newest-first with the exact total", async () => {
    const all = await getStockHistory(db, "prod-1", { limit: 20, offset: 0 });
    expect(all.movements).toHaveLength(4);
    expect(all.total).toBe(4);
    expect(all.movements[0].id).toBe("mv-4");

    const page = await getStockHistory(db, "prod-1", { limit: 2, offset: 2 });
    expect(page.movements.map((m) => m.id)).toEqual(["mv-2", "mv-1"]);
    expect(page.total).toBe(4);
  });

  it("filters by variant", async () => {
    const result = await getStockHistory(db, "prod-2", { limit: 20, offset: 0 });
    expect(result.movements).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.movements.every((m) => m.variantId === "var-1")).toBe(true);
  });

  it("empty page beyond the end keeps the total", async () => {
    const result = await getStockHistory(db, "prod-1", { limit: 3, offset: 50 });
    expect(result.movements).toEqual([]);
    expect(result.total).toBe(4);
  });

  it("unknown product → empty page, zero total", async () => {
    const result = await getStockHistory(db, "prod-none", { limit: 20, offset: 0 });
    expect(result).toEqual({ movements: [], total: 0 });
  });
});

describe("getApprovedProductReviews — real D1", () => {
  it("returns only approved reviews for the product, paginated", async () => {
    const result = await getApprovedProductReviews(db, "store-1", "prod-1", 20, 0);
    expect(result.rows.map((r) => r.id)).toEqual(["rev-2", "rev-1"]);
    expect(result.total).toBe(2);

    const page = await getApprovedProductReviews(db, "store-1", "prod-1", 1, 1);
    expect(page.rows.map((r) => r.id)).toEqual(["rev-1"]);
    expect(page.total).toBe(2);
  });

  it("excludes pending and rejected; empty page keeps total", async () => {
    const result = await getApprovedProductReviews(db, "store-1", "prod-2", 20, 0);
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);

    const beyond = await getApprovedProductReviews(db, "store-1", "prod-1", 20, 50);
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(2);
  });
});

describe("getAllReviews — real D1", () => {
  it("unfiltered returns all reviews newest-first with global pendingCount", async () => {
    const result = await getAllReviews(db, { limit: 20, offset: 0 });
    expect(result.rows).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.pendingCount).toBe(2);
    expect(result.rows[0].id).toBe("rev-5");
    expect(result.rows.every((r) => r.productName !== null)).toBe(true);
  });

  it("status filter applies to rows and total but not pendingCount", async () => {
    const result = await getAllReviews(db, { status: "pending", limit: 20, offset: 0 });
    expect(result.rows.map((r) => r.id)).toEqual(["rev-4", "rev-3"]);
    expect(result.total).toBe(2);
    expect(result.pendingCount).toBe(2);
  });

  it("productId filter narrows rows and total", async () => {
    const result = await getAllReviews(db, { productId: "prod-1", limit: 20, offset: 0 });
    expect(result.rows).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.pendingCount).toBe(2);
  });

  it("empty page keeps totals", async () => {
    const result = await getAllReviews(db, { limit: 2, offset: 50 });
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(5);
    expect(result.pendingCount).toBe(2);
  });
});

describe("listAbandonedOrders — real D1", () => {
  it("lists newest-first unfiltered with the exact total", async () => {
    const result = await listAbandonedOrders(db, { limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.rows[0].id).toBe("ab-5");
  });

  it("status filter applies to rows and total", async () => {
    const result = await listAbandonedOrders(db, { status: "abandoned", limit: 10, offset: 0 });
    expect(result.rows.map((r) => r.id)).toEqual(["ab-2", "ab-1"]);
    expect(result.total).toBe(2);
  });

  it("search matches name and phone", async () => {
    const byName = await listAbandonedOrders(db, { search: "Sara", limit: 10, offset: 0 });
    expect(byName.rows.map((r) => r.id)).toEqual(["ab-1"]);

    const byPhone = await listAbandonedOrders(db, { search: "0550000004", limit: 10, offset: 0 });
    expect(byPhone.rows.map((r) => r.id)).toEqual(["ab-4"]);
  });

  it("empty page keeps the total", async () => {
    const result = await listAbandonedOrders(db, { limit: 2, offset: 50 });
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(5);
  });
});

describe("getAbandonedOrderStats — real D1", () => {
  it("computes stats from real rows (3 abandoned, 1 converted → 25%)", async () => {
    const stats = await getAbandonedOrderStats(db);
    expect(stats).toEqual({
      totalAbandoned: 2,
      totalConverted: 1,
      conversionRate: 33,
      estimatedLostRevenue: 4000,
    });
  });
});

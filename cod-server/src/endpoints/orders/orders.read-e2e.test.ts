/**
 * getAllOrders + getOrderById — Slice 4 real-D1 E2E.
 *
 * Runs the real migrations on an in-memory miniflare D1 (58 wilayas + 1551
 * communes reference data included) and verifies:
 *   • getOrderById: joined resolution (wilaya/commune/driver/label) in one
 *     select + ONE read batch for lines and history
 *   • null branches: no driver / wilaya / commune / shipment / review
 *   • missing order → null (no batch executed)
 *   • getAllOrders: EXISTS hasReview 1/0, lastUpdatedBy from latest history,
 *     status / wilayaId / search filters, limit+offset pagination over
 *     created_at DESC
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { getAllOrders, getOrderById } from "../../../../cod-shared/queries/orders";

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

  const commune = await db
    .select({ id: schema.communes.id, nameAr: schema.communes.nameAr })
    .from(schema.communes)
    .where(eq(schema.communes.wilayaId, 16))
    .get();
  const wilaya = await db
    .select({ nameAr: schema.wilayas.nameAr })
    .from(schema.wilayas)
    .where(eq(schema.wilayas.id, 16))
    .get();

  const now = new Date().toISOString();
  const earlier = "2025-12-01T00:00:00.000Z";

  await db.insert(schema.users).values({
    id: "user-e2e", name: "Sara Staff", email: "sara@example.com",
    createdAt: new Date(), updatedAt: new Date(),
  });
  await db.insert(schema.drivers).values({
    id: "drv-e2e", firstName: "Karim", lastName: "Hammadi", phone: "0555000010",
    createdAt: now, updatedAt: now,
  });
  await db.insert(schema.customers).values({
    id: "cust-e2e", name: "Full Buyer", phone: "0770000001",
    wilaya: wilaya!.nameAr, commune: commune?.nameAr ?? null,
    wilayaId: 16, communeId: commune?.id ?? null,
    createdAt: now,
  });
  await db.insert(schema.customers).values({
    id: "cust-e2e-2", name: "Bare Buyer", phone: "0770000002",
    wilaya: "ولاية 99", createdAt: now,
  });
  await db.insert(schema.products).values({
    id: "prod-e2e", name: "E2E Product", handle: "e2e-product", price: 1500,
    hasVariants: false, inventory: 50, trackInventory: true,
    status: "ACTIVE", visibility: true, showInStore: true,
    createdAt: now, updatedAt: now,
  });
  await db.insert(schema.stores).values({
    id: "store-e2e", name: "E2E Store", createdAt: now, updatedAt: now,
  });

  // Order A — full graph: wilaya, commune, driver, shipment, review, history by user
  await db.insert(schema.orders).values({
    id: "ord-e2e-a", orderNumber: "ORD-E2E-A", customerId: "cust-e2e",
    customerName: "Full Buyer", phone: "0770000001",
    wilayaId: 16, communeId: commune?.id ?? null,
    price: 3000, status: "new", deliveryMethod: "driver", deliveryType: "home",
    deliveryFee: 400, driverFee: 0, codAmount: 3400, driverId: "drv-e2e",
    createdAt: now, updatedAt: now,
  });
  await db.insert(schema.orderProducts).values([
    { id: "op-a1", orderId: "ord-e2e-a", productId: "prod-e2e", productName: "E2E Product", quantity: 1, pricePerUnit: 1500, lineTotal: 1500, createdAt: now },
    { id: "op-a2", orderId: "ord-e2e-a", productId: "prod-e2e", productName: "E2E Product", quantity: 1, pricePerUnit: 1500, lineTotal: 1500, createdAt: now },
  ]);
  await db.insert(schema.orderStatusHistory).values([
    { id: "h-a1", orderId: "ord-e2e-a", status: "new", timestamp: earlier, by: null },
    { id: "h-a2", orderId: "ord-e2e-a", status: "confirmed", timestamp: now, by: "user-e2e" },
  ]);
  await db.insert(schema.deliveryCompanies).values({
    id: "co-x", name: "E2E Carrier", nameAr: "ناقل", code: "e2e-carrier",
    createdAt: now, updatedAt: now,
  });
  await db.insert(schema.companyShipments).values({
    id: "shp-a", orderId: "ord-e2e-a", companyId: "co-x",
    trackingNumber: "TRK-A", labelUrl: "https://example.com/label-a.pdf",
    createdAt: now, updatedAt: now,
  });
  await db.insert(schema.reviews).values({
    id: "rev-a", storeId: "store-e2e", productId: "prod-e2e",
    orderId: "ord-e2e-a", orderNumber: "ORD-E2E-A", customerName: "Full Buyer",
    rating: 5, body: "great", status: "approved",
    createdAt: now, updatedAt: now,
  });

  // Order B — minimal: no wilaya/commune/driver/shipment/review; older timestamp
  await db.insert(schema.orders).values({
    id: "ord-e2e-b", orderNumber: "ORD-E2E-B", customerId: "cust-e2e-2",
    customerName: "Bare Buyer", phone: "0770000002",
    price: 1500, status: "confirmed", deliveryMethod: "unassigned", deliveryType: "home",
    deliveryFee: 0, driverFee: 0, codAmount: 1500,
    createdAt: earlier, updatedAt: earlier,
  });
  await db.insert(schema.orderProducts).values({
    id: "op-b1", orderId: "ord-e2e-b", productId: "prod-e2e", productName: "E2E Product",
    quantity: 1, pricePerUnit: 1500, lineTotal: 1500, createdAt: earlier,
  });
  await db.insert(schema.orderStatusHistory).values({
    id: "h-b1", orderId: "ord-e2e-b", status: "confirmed", timestamp: earlier, by: null,
  });
}, 120_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("getOrderById — real D1", () => {
  it("resolves the full joined graph", async () => {
    const order = await getOrderById(db, "ord-e2e-a");

    expect(order).not.toBeNull();
    expect(order!.driverName).toBe("Karim Hammadi");
    expect(order!.wilaya).toBe("الجزائر");
    expect(order!.commune).toBeTruthy();
    expect(order!.labelUrl).toBe("https://example.com/label-a.pdf");
    expect(order!.products).toHaveLength(2);
    expect(order!.statusHistory).toHaveLength(2);
    expect(order!.statusHistory[0].status).toBe("confirmed");
    expect(order!.statusHistory[0].byName).toBe("Sara Staff");
    expect(order!.statusHistory[1].byName).toBeNull();
  });

  it("resolves nulls for the minimal order (no driver/wilaya/commune/shipment)", async () => {
    const order = await getOrderById(db, "ord-e2e-b");

    expect(order).not.toBeNull();
    expect(order!.driverName).toBeNull();
    expect(order!.wilaya).toBeNull();
    expect(order!.commune).toBeNull();
    expect(order!.labelUrl).toBeNull();
    expect(order!.products).toHaveLength(1);
    expect(order!.statusHistory).toHaveLength(1);
    expect(order!.statusHistory[0].byName).toBeNull();
  });

  it("returns null for a missing order", async () => {
    expect(await getOrderById(db, "does-not-exist")).toBeNull();
  });
});

describe("getAllOrders — real D1", () => {
  it("lists newest-first with EXISTS hasReview and lastUpdatedBy", async () => {
    const rows = await getAllOrders(db);

    expect(rows).toHaveLength(2);
    const [a, b] = rows;
    expect(a.id).toBe("ord-e2e-a");
    expect(b.id).toBe("ord-e2e-b");
    expect(a.hasReview).toBe(1);
    expect(b.hasReview).toBe(0);
    expect(a.lastUpdatedBy).toBe("user-e2e");
    expect(b.lastUpdatedBy).toBeNull();
    expect(a.driverName).toBe("Karim Hammadi");
    expect(b.driverName).toBeNull();
  });

  it("filters by status", async () => {
    const rows = await getAllOrders(db, { status: "confirmed" });
    expect(rows.map((r) => r.id)).toEqual(["ord-e2e-b"]);
  });

  it("filters by wilayaId", async () => {
    const rows = await getAllOrders(db, { wilayaId: 16 });
    expect(rows.map((r) => r.id)).toEqual(["ord-e2e-a"]);
  });

  it("searches by order number", async () => {
    const rows = await getAllOrders(db, { search: "ORD-E2E-B" });
    expect(rows.map((r) => r.id)).toEqual(["ord-e2e-b"]);
  });

  it("searches by phone", async () => {
    const rows = await getAllOrders(db, { search: "0770000001" });
    expect(rows.map((r) => r.id)).toEqual(["ord-e2e-a"]);
  });

  it("searches by customer name", async () => {
    const rows = await getAllOrders(db, { search: "Bare" });
    expect(rows.map((r) => r.id)).toEqual(["ord-e2e-b"]);
  });

  it("paginates with limit and offset over created_at DESC", async () => {
    const page1 = await getAllOrders(db, { limit: 1, offset: 0 });
    const page2 = await getAllOrders(db, { limit: 1, offset: 1 });
    expect(page1.map((r) => r.id)).toEqual(["ord-e2e-a"]);
    expect(page2.map((r) => r.id)).toEqual(["ord-e2e-b"]);
    const empty = await getAllOrders(db, { limit: 1, offset: 5 });
    expect(empty).toEqual([]);
  });
});

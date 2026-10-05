/**
 * getOrderById → customerHistory — real-D1 E2E + summarizer unit tests.
 *
 * customerHistory tells the merchant how this customer's OTHER orders ended
 * (shown as a badge on the order detail page):
 *   • the current order is always excluded
 *   • outcome counts cover terminal statuses only (delivered/returned/cancelled)
 *   • total also counts in-progress orders
 *   • another customer's orders never leak in
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import {
  getOrderById,
  summarizeCustomerHistory,
} from "../../../../cod-shared/queries/orders";

const registry: Miniflare[] = [];
let db: AppDb;

type Status = (typeof schema.orders.$inferInsert)["status"];

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });
  registry.push(mf);
  const d1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  const preparedStatements: D1PreparedStatement[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) {
      preparedStatements.push(d1.prepare(statement));
    }
  }
  for (let i = 0; i < preparedStatements.length; i += 50) {
    await d1.batch(preparedStatements.slice(i, i + 50));
  }
  db = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;

  const now = new Date().toISOString();

  await db.insert(schema.customers).values([
    { id: "cust-repeat", name: "Repeat Buyer", phone: "0770000101", wilaya: "الجزائر", createdAt: now },
    { id: "cust-new", name: "New Buyer", phone: "0770000102", wilaya: "الجزائر", createdAt: now },
    { id: "cust-other", name: "Other Buyer", phone: "0770000103", wilaya: "الجزائر", createdAt: now },
  ]);

  const order = (id: string, customerId: string, phone: string, status: Status) => ({
    id,
    orderNumber: `ORD-${id}`,
    customerId,
    customerName: "Buyer",
    phone,
    price: 1000,
    status,
    deliveryMethod: "unassigned" as const,
    deliveryType: "home" as const,
    deliveryFee: 0,
    driverFee: 0,
    codAmount: 1000,
    createdAt: now,
    updatedAt: now,
  });

  // One insert per row — D1 caps bound variables per statement.
  const seedOrders = [
    // Repeat buyer: current order + 6 others (2 delivered, 2 returned, 1 cancelled, 1 in progress)
    order("rep-current", "cust-repeat", "0770000101", "new"),
    order("rep-d1", "cust-repeat", "0770000101", "delivered"),
    order("rep-d2", "cust-repeat", "0770000101", "delivered"),
    order("rep-r1", "cust-repeat", "0770000101", "returned"),
    order("rep-r2", "cust-repeat", "0770000101", "returned"),
    order("rep-c1", "cust-repeat", "0770000101", "cancelled"),
    order("rep-p1", "cust-repeat", "0770000101", "dispatched"),
    // First-time buyer: only the current order
    order("new-current", "cust-new", "0770000102", "new"),
    // Another customer's history must not leak into the repeat buyer's counts
    order("oth-r1", "cust-other", "0770000103", "returned"),
    order("oth-r2", "cust-other", "0770000103", "returned"),
  ];
  for (const row of seedOrders) {
    await db.insert(schema.orders).values(row);
  }
}, 120_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("getOrderById customerHistory — real D1", () => {
  it("counts the customer's other orders by outcome, excluding the current order", async () => {
    const order = await getOrderById(db, "rep-current");

    expect(order!.customerHistory).toEqual({
      total: 6,
      delivered: 2,
      returned: 2,
      cancelled: 1,
    });
  });

  it("excludes the viewed order even when it is terminal", async () => {
    const order = await getOrderById(db, "rep-d1");

    expect(order!.customerHistory).toEqual({
      total: 6,
      delivered: 1,
      returned: 2,
      cancelled: 1,
    });
  });

  it("returns zeros for a first-time customer", async () => {
    const order = await getOrderById(db, "new-current");

    expect(order!.customerHistory).toEqual({
      total: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    });
  });
});

describe("summarizeCustomerHistory", () => {
  it("returns zeros for no rows", () => {
    expect(summarizeCustomerHistory([])).toEqual({
      total: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    });
  });

  it("counts in-progress statuses in total only", () => {
    expect(
      summarizeCustomerHistory([
        { status: "delivered", count: 3 },
        { status: "confirmed", count: 2 },
        { status: "out_for_delivery", count: 1 },
      ]),
    ).toEqual({ total: 6, delivered: 3, returned: 0, cancelled: 0 });
  });

  it("coerces string counts from the driver", () => {
    expect(
      summarizeCustomerHistory([
        { status: "returned", count: "4" as unknown as number },
      ]),
    ).toEqual({ total: 4, delivered: 0, returned: 4, cancelled: 0 });
  });
});

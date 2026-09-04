/**
 * Slice 7 — count+rows in one round trip: mock-queue coverage.
 *
 * Call shape post-Slice 7 (queue order = batch statement order):
 *   • getStockHistory          → [a(movements), count]
 *   • getApprovedProductReviews → [a(reviews), count]
 *   • getAllReviews            → [a(rows), total, pendingCount]
 *   • listAbandonedOrders      → [a(rows), count]
 *   • getAbandonedOrderStats   → [abandoned, converted, revenue]
 *
 * WHERE/ordering/pagination semantics verified against real D1 in
 * list-count-e2e.test.ts.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, f, a, NOW } from "@/test-utils/mock-db";
import { getStockHistory } from "../../../../cod-shared/queries/stock";
import { getApprovedProductReviews } from "../../../../cod-shared/queries/store";
import { getAllReviews } from "../../../../cod-shared/queries/reviews";
import {
  listAbandonedOrders,
  getAbandonedOrderStats,
} from "../../../../cod-shared/queries/abandoned-orders";

function movementRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mv_1",
    product_id: "prod_1",
    variant_id: null,
    type: "PURCHASE",
    delta: 10,
    qty_before: 0,
    qty_after: 10,
    reason: "initial",
    reference: null,
    created_by: "user_1",
    created_by_name: "Admin",
    created_at: NOW,
    ...overrides,
  };
}

function reviewRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "rev_1",
    store_id: "store_1",
    product_id: "prod_1",
    order_id: "ord_1",
    order_number: "ORD-001",
    customer_name: "Fatima",
    rating: 5,
    title: null,
    body: "great",
    status: "approved",
    helpful_count: 0,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function reviewListRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "rev_1",
    store_id: "store_1",
    product_id: "prod_1",
    order_id: "ord_1",
    order_number: "ORD-001",
    customer_name: "Fatima",
    rating: 5,
    title: null,
    body: "great",
    status: "approved",
    helpful_count: 0,
    created_at: NOW,
    updated_at: NOW,
    product_name: "T-Shirt",
    ...overrides,
  };
}

function abandonedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ab_1",
    session_id: "sess_1",
    customer_name: "Sara",
    phone: "0550",
    wilaya_id: 16,
    commune_id: null,
    wilaya_name: "الجزائر",
    commune_name: null,
    product_id: "prod_1",
    product_name: "T-Shirt",
    variant_id: null,
    variant_label: null,
    price: 2500,
    delivery_type: "home",
    fbc: null,
    fbp: null,
    ip_address: null,
    user_agent: null,
    status: "abandoned",
    converted_order_id: null,
    converted_order_number: null,
    recovery_attempts: 0,
    last_recovery_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe("getStockHistory", () => {
  it("returns page and total from one batch", async () => {
    const db = makeMockDb([
      a([movementRow({ id: "mv_1" }), movementRow({ id: "mv_2" })]),
      f({ count: 9 }),
    ]);

    const result = await getStockHistory(db, "prod_1", { limit: 2, offset: 4 });

    expect(result.movements).toHaveLength(2);
    expect(result.movements[0]).toMatchObject({ id: "mv_1", type: "PURCHASE", delta: 10 });
    expect(result.total).toBe(9);
  });

  it("maps an empty page with total 0", async () => {
    const db = makeMockDb([a([]), f({ count: 0 })]);

    const result = await getStockHistory(db, "prod_1", { limit: 20, offset: 0 });

    expect(result.movements).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("getApprovedProductReviews", () => {
  it("returns page and total from one batch", async () => {
    const db = makeMockDb([a([reviewRow()]), f({ count: 3 })]);

    const result = await getApprovedProductReviews(db, "store_1", "prod_1", 20, 0);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: "rev_1", rating: 5 });
    expect(result.total).toBe(3);
  });

  it("maps an empty page", async () => {
    const db = makeMockDb([a([]), f({ count: 0 })]);

    const result = await getApprovedProductReviews(db, "store_1", "prod_missing");

    expect(result).toEqual({ rows: [], total: 0 });
  });
});

describe("getAllReviews", () => {
  it("returns rows, total, and pendingCount from one batch", async () => {
    const db = makeMockDb([
      a([reviewListRow({ status: "pending" })]),
      f({ count: 5 }),
      f({ count: 2 }),
    ]);

    const result = await getAllReviews(db, { status: "pending", limit: 20, offset: 0 });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ productName: "T-Shirt", status: "pending" });
    expect(result.total).toBe(5);
    expect(result.pendingCount).toBe(2);
  });

  it("pendingCount is independent of the status filter", async () => {
    const db = makeMockDb([
      a([reviewListRow({ status: "approved" })]),
      f({ count: 3 }),
      f({ count: 7 }),
    ]);

    const result = await getAllReviews(db, { status: "approved", limit: 20, offset: 0 });

    expect(result.total).toBe(3);
    expect(result.pendingCount).toBe(7);
  });
});

describe("listAbandonedOrders", () => {
  it("returns page and total from one batch", async () => {
    const db = makeMockDb([a([abandonedRow()]), f({ count: 12 })]);

    const result = await listAbandonedOrders(db, { limit: 1, offset: 0 });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: "ab_1", status: "abandoned" });
    expect(result.total).toBe(12);
  });

  it("maps an empty page beyond the end", async () => {
    const db = makeMockDb([a([]), f({ count: 12 })]);

    const result = await listAbandonedOrders(db, { limit: 50, offset: 500 });

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(12);
  });
});

describe("getAbandonedOrderStats", () => {
  it("derives stats from three counts in one batch", async () => {
    const db = makeMockDb([
      f({ count: 3 }),
      f({ count: 1 }),
      f({ total: 7500 }),
    ]);

    const stats = await getAbandonedOrderStats(db);

    expect(stats).toEqual({
      totalAbandoned: 3,
      totalConverted: 1,
      conversionRate: 25,
      estimatedLostRevenue: 7500,
    });
  });

  it("conversion rate rounds; zero attempted → 0%", async () => {
    const db = makeMockDb([
      f({ count: 1 }),
      f({ count: 2 }),
      f({ total: 0 }),
    ]);

    const stats = await getAbandonedOrderStats(db);

    expect(stats.conversionRate).toBe(67);
    expect(stats.estimatedLostRevenue).toBe(0);
  });

  it("empty table → all zeros, no division by zero", async () => {
    const db = makeMockDb([
      f({ count: 0 }),
      f({ count: 0 }),
      f({ total: 0 }),
    ]);

    const stats = await getAbandonedOrderStats(db);

    expect(stats).toEqual({
      totalAbandoned: 0,
      totalConverted: 0,
      conversionRate: 0,
      estimatedLostRevenue: 0,
    });
  });
});

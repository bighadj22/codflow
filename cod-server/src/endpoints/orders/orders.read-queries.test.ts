/**
 * getAllOrders + getOrderById — Slice 4 read-path coverage.
 *
 * Mock queue verifies call shape and mapping (one joined select, then ONE
 * read batch); WHERE/filter semantics are verified against real D1 in
 * orders.read-e2e.test.ts.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, f, a, orderRow, NOW } from "@/test-utils/mock-db";
import { getAllOrders, getOrderById } from "../../../../cod-shared/queries/orders";

function opRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "op_1",
    order_id: "ord_1",
    product_id: "prod_1",
    product_name: "Galaxy A54",
    variant_id: null,
    variant_label: null,
    sku: null,
    quantity: 2,
    price_per_unit: 4500,
    line_total: 9000,
    status: "fulfilled",
    returned_quantity: 0,
    created_at: NOW,
    ...overrides,
  };
}

function listRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...orderRow(),
    wilaya: "الجزائر",
    commune: "باب الزوار",
    driver_name: "Ahmed Benali",
    has_review: 0,
    last_updated_by: "user_1",
    ...overrides,
  };
}

function detailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...orderRow(),
    wilaya: "الجزائر",
    commune: "باب الزوار",
    driver_name: "Ahmed Benali",
    label_url: "https://example.com/label.pdf",
    ...overrides,
  };
}

function historyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "h_1",
    order_id: "ord_1",
    status: "new",
    timestamp: NOW,
    by: "user_1",
    by_name: "Ahmed Benali",
    ...overrides,
  };
}

describe("getAllOrders", () => {
  it("maps the joined select row including hasReview and lastUpdatedBy", async () => {
    const db = makeMockDb([a([listRow({ has_review: 1 })])]);

    const rows = await getAllOrders(db);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "ord_1",
      orderNumber: "ORD-001",
      wilaya: "الجزائر",
      commune: "باب الزوار",
      driverName: "Ahmed Benali",
      hasReview: 1,
      lastUpdatedBy: "user_1",
    });
  });

  it("hasReview maps to 0 for unreviewed orders (EXISTS returns 1/0)", async () => {
    const db = makeMockDb([a([listRow({ has_review: 0 })])]);

    const rows = await getAllOrders(db);

    expect(rows[0].hasReview).toBe(0);
  });

  it("accepts filters without extra queries (single list query)", async () => {
    const db = makeMockDb([a([listRow()])]);

    const rows = await getAllOrders(db, {
      status: "new",
      wilayaId: 16,
      search: "ORD-001",
      limit: 10,
      offset: 5,
    });

    expect(rows).toHaveLength(1);
  });

  it("returns an empty page without touching further queue entries", async () => {
    const db = makeMockDb([a([])]);

    const rows = await getAllOrders(db);

    expect(rows).toEqual([]);
  });
});

describe("getOrderById", () => {
  it("resolves the order with one joined select and one read batch", async () => {
    const db = makeMockDb([
      f(detailRow()),
      a([opRow({ id: "op_1", quantity: 2 }), opRow({ id: "op_2", quantity: 1 })]),
      a([
        historyRow({ id: "h_2", status: "preparing", timestamp: "2026-01-02T00:00:00.000Z" }),
        historyRow({ id: "h_1", status: "new", timestamp: "2026-01-01T00:00:00.000Z" }),
      ]),
    ]);

    const order = await getOrderById(db, "ord_1");

    expect(order).not.toBeNull();
    expect(order).toMatchObject({
      id: "ord_1",
      orderNumber: "ORD-001",
      wilaya: "الجزائر",
      commune: "باب الزوار",
      driverName: "Ahmed Benali",
      labelUrl: "https://example.com/label.pdf",
    });
    expect(order!.products).toHaveLength(2);
    expect(order!.products[0]).toMatchObject({ id: "op_1", quantity: 2 });
    expect(order!.statusHistory).toHaveLength(2);
    expect(order!.statusHistory[0]).toMatchObject({
      id: "h_2",
      status: "preparing",
      byName: "Ahmed Benali",
    });
  });

  it("maps null driver/wilaya/commune/label when joins miss", async () => {
    const db = makeMockDb([
      f(detailRow({
        wilaya: null,
        commune: null,
        driver_name: null,
        label_url: null,
        driver_id: null,
        wilaya_id: null,
        commune_id: null,
      })),
      a([opRow()]),
      a([historyRow({ by: null, by_name: null })]),
    ]);

    const order = await getOrderById(db, "ord_1");

    expect(order).toMatchObject({
      wilaya: null,
      commune: null,
      driverName: null,
      labelUrl: null,
    });
    expect(order!.statusHistory[0].byName).toBeNull();
  });

  it("returns null for a missing order without running the read batch", async () => {
    const db = makeMockDb([f(null)]);

    const order = await getOrderById(db, "nope");

    expect(order).toBeNull();
  });
});

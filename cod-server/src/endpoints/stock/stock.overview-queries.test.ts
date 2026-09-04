/**
 * getStockOverview + getStockAlerts — Slice 6 mock-queue coverage.
 *
 * Call shape post-Slice 6:
 *   • getStockOverview — ONE raw UNION ALL query (simple products +
 *     tracked variants), SQL-side ordering; buckets derived in one pass
 *   • getStockAlerts — ONE filtered UNION query (page) + ONE count query
 *
 * WHERE/aggregation/ordering semantics are verified against real D1 in
 * stock.overview-e2e.test.ts.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, a, f } from "@/test-utils/mock-db";
import { getStockOverview, getStockAlerts } from "../../../../cod-shared/queries/stock";

function skuRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    product_id: "prod_1",
    variant_id: null,
    product_name: "T-Shirt",
    variations: null,
    inventory: 2,
    low_stock_threshold: 5,
    inventory_value: 3000,
    is_out_of_stock: 0,
    ...overrides,
  };
}

describe("getStockOverview", () => {
  it("buckets rows from one query: out-of-stock, low, healthy", async () => {
    const db = makeMockDb([
      a([
        skuRow({ product_id: "p-out", inventory: 0, is_out_of_stock: 1, inventory_value: 0 }),
        skuRow({ product_id: "p-neg", inventory: -2, is_out_of_stock: 1, inventory_value: -3000 }),
        skuRow({ product_id: "p-low", inventory: 3 }),
        skuRow({ product_id: "p-ok", inventory: 50, inventory_value: 75000 }),
        skuRow({
          product_id: "p-v",
          variant_id: "var_1",
          variations: '{"Color":"Red","Size":"M"}',
          inventory: 4,
          inventory_value: 6000,
        }),
      ]),
    ]);

    const overview = await getStockOverview(db);

    expect(overview.totalSkus).toBe(5);
    expect(overview.outOfStockCount).toBe(2);
    expect(overview.lowStockCount).toBe(2);
    expect(overview.totalInventoryValue).toBe(-3000 + 3000 + 75000 + 6000);
    expect(overview.currency).toBe("DZD");

    expect(overview.outOfStockItems.map((i) => i.productId)).toEqual(["p-out", "p-neg"]);
    expect(overview.lowStockItems.map((i) => i.productId)).toEqual(["p-low", "p-v"]);
    expect(overview.allItems).toHaveLength(5);
    expect(new Set(overview.allItems.map((i) => i.inventory))).toEqual(
      new Set([0, -2, 3, 50, 4]),
    );
  });

  it("parses the variant label from variations JSON", async () => {
    const db = makeMockDb([
      a([
        skuRow({
          variant_id: "var_1",
          variations: '{"اللون":"أحمر","المقاس":"M"}',
        }),
      ]),
    ]);

    const overview = await getStockOverview(db);

    expect(overview.allItems[0].variantLabel).toBe("أحمر / M");
    expect(overview.allItems[0].variantId).toBe("var_1");
  });

  it("maps a null-variant row to variantLabel null", async () => {
    const db = makeMockDb([a([skuRow()])]);

    const overview = await getStockOverview(db);

    expect(overview.allItems[0].variantLabel).toBeNull();
    expect(overview.allItems[0].variantId).toBeNull();
  });

  it("returns zeros and empty lists for an empty catalog", async () => {
    const db = makeMockDb([a([])]);

    const overview = await getStockOverview(db);

    expect(overview).toMatchObject({
      totalSkus: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      totalInventoryValue: 0,
      currency: "DZD",
    });
    expect(overview.allItems).toEqual([]);
    expect(overview.outOfStockItems).toEqual([]);
    expect(overview.lowStockItems).toEqual([]);
  });
});

describe("getStockAlerts", () => {
  it("pages the alert union and returns the total from the count query", async () => {
    const db = makeMockDb([
      a([
        skuRow({ product_id: "p-out", inventory: 0, is_out_of_stock: 1 }),
        skuRow({ product_id: "p-low", inventory: 2 }),
      ]),
      f({ total: 7 }),
    ]);

    const result = await getStockAlerts(db, { limit: 2, offset: 0 });

    expect(result.items.map((i) => i.productId)).toEqual(["p-out", "p-low"]);
    expect(result.items[0].isOutOfStock).toBe(true);
    expect(result.items[1].isOutOfStock).toBe(false);
    expect(result.total).toBe(7);
  });

  it("returns an empty page with the correct total beyond the end", async () => {
    const db = makeMockDb([a([]), f({ total: 7 })]);

    const result = await getStockAlerts(db, { limit: 50, offset: 500 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(7);
  });
});

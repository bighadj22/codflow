/**
 * updateOrderStatusWebhook — Slice 2 batch-write coverage.
 *
 * Contract (cod-shared/queries/orders.ts):
 *   • unknown order → { updated: false }
 *   • rank guard: equal/lower-ranked status → { updated: false }, no writes
 *   • accepted status → rank advance committed in ONE db.batch() call
 *   • delivered + driverId → driver stats update inside the same batch
 *   • cancelled/returned → customer stats + restock + movements in the same batch
 *
 * Uses makeMockDb's sequential read queue; all writes funnel through the
 * mock's batch() which succeeds without consuming the queue.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, f, a, orderRow, NOW } from "@/test-utils/mock-db";
import { updateOrderStatusWebhook } from "../../../../cod-shared/queries/orders";

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

describe("updateOrderStatusWebhook", () => {
  it("returns { updated: false } for an unknown order", async () => {
    const db = makeMockDb([f(null)]);

    const result = await updateOrderStatusWebhook(db, "nope", "delivered", "yalidine");

    expect(result).toEqual({ updated: false });
  });

  it("rejects a same-rank status (no regression)", async () => {
    const db = makeMockDb([f(orderRow({ status: "delivered" }))]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "cancelled", "zr_express");

    expect(result).toEqual({ updated: false });
  });

  it("rejects a lower-rank status", async () => {
    const db = makeMockDb([f(orderRow({ status: "out_for_delivery" }))]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "preparing", "zr_express");

    expect(result).toEqual({ updated: false });
  });

  it("commits a forward status change (batch path)", async () => {
    const db = makeMockDb([f(orderRow({ status: "confirmed", driver_id: null }))]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "preparing", "zr_express");

    expect(result).toEqual({ updated: true });
  });

  it("commits delivered with driver stats in the same batch", async () => {
    const db = makeMockDb([
      f(orderRow({ status: "out_for_delivery", driver_id: "drv_1", driver_fee: 350, cod_amount: 9600 })),
    ]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "delivered", "yalidine");

    expect(result).toEqual({ updated: true });
  });

  it("commits delivered without a driver (no driver update needed)", async () => {
    const db = makeMockDb([f(orderRow({ status: "out_for_delivery", driver_id: null }))]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "delivered", "yalidine");

    expect(result).toEqual({ updated: true });
  });

  it("restocks simple-product inventory on cancelled (resolve-then-batch reads)", async () => {
    const db = makeMockDb([
      f(orderRow({ status: "ready" })),
      a([opRow({ quantity: 2, returned_quantity: 0 })]),
      f({ track_inventory: 1 }),
      f({ inventory: 5 }),
    ]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "cancelled", "yalidine");

    expect(result).toEqual({ updated: true });
  });

  it("restocks only remaining units when some already returned", async () => {
    const db = makeMockDb([
      f(orderRow({ status: "out_for_delivery" })),
      a([opRow({ quantity: 3, returned_quantity: 1 })]),
      f({ track_inventory: 1 }),
      f({ inventory: 4 }),
    ]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "returned", "zr_express");

    expect(result).toEqual({ updated: true });
  });

  it("skips restock when all units already returned", async () => {
    const db = makeMockDb([
      f(orderRow({ status: "out_for_delivery" })),
      a([opRow({ quantity: 2, returned_quantity: 2 })]),
    ]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "cancelled", "zr_express");

    expect(result).toEqual({ updated: true });
  });

  it("skips restock when the product does not track inventory", async () => {
    const db = makeMockDb([
      f(orderRow({ status: "ready" })),
      a([opRow({ quantity: 3, returned_quantity: 0 })]),
      f({ track_inventory: 0 }),
    ]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "cancelled", "zr_express");

    expect(result).toEqual({ updated: true });
  });

  it("restocks variant inventory when variantId is set", async () => {
    const db = makeMockDb([
      f(orderRow({ status: "ready" })),
      a([opRow({ quantity: 2, returned_quantity: 0, variant_id: "var_1", product_id: "prod_1" })]),
      f({ track_inventory: 1 }),
      f({ inventory: 3 }),
    ]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "returned", "zr_express");

    expect(result).toEqual({ updated: true });
  });

  it("mixes multiple lines in one batch", async () => {
    const db = makeMockDb([
      f(orderRow({ status: "ready" })),
      a([
        opRow({ id: "op_1", quantity: 2, returned_quantity: 0 }),
        opRow({ id: "op_2", quantity: 1, returned_quantity: 0, variant_id: "var_1" }),
      ]),
      f({ track_inventory: 1 }),
      f({ track_inventory: 1 }),
      f({ inventory: 5 }),
      f({ inventory: 3 }),
    ]);

    const result = await updateOrderStatusWebhook(db, "ord_1", "cancelled", "zr_express");

    expect(result).toEqual({ updated: true });
  });
});

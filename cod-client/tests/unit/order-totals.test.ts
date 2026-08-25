import { describe, it, expect } from "vitest";
import { computeOrderTotals } from "@/lib/order-totals";

/**
 * Regression guard for the order-details money math.
 *
 * orders.price stores ITEMS-ONLY price (never includes shipping);
 * codAmount = price + deliveryFee is what the customer pays (handlers.ts:182).
 *
 * Bug context: the detail view computed subtotal = price - deliveryFee,
 * showing 2400 for a 2800 basket with 400 shipping.
 */
describe("computeOrderTotals", () => {
  it("user-reported case: 2800 goods + 400 shipping", () => {
    const t = computeOrderTotals({ price: 2800, deliveryFee: 400 });
    expect(t.subtotal).toBe(2800);
    expect(t.total).toBe(3200);
  });

  it("free shipping: total equals subtotal", () => {
    const t = computeOrderTotals({ price: 1500, deliveryFee: 0 });
    expect(t.subtotal).toBe(1500);
    expect(t.deliveryFee).toBe(0);
    expect(t.total).toBe(1500);
  });

  it("multi-line baskets keep price as-is (already summed server-side)", () => {
    const t = computeOrderTotals({ price: 999, deliveryFee: 500 });
    expect(t.subtotal).toBe(999);
    expect(t.total).toBe(1499);
  });
});

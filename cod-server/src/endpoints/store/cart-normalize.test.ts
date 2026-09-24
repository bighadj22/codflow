/**
 * normalizeOrderLines — the order engine's only entry point.
 *
 * Every accepted request shape collapses here into one deduplicated list. The
 * legacy shapes are adapters, not branches in the engine, so these tests are
 * what guarantee existing storefronts keep behaving identically.
 *
 * Pure function: no database needed, so the invariants are property-tested
 * across generated baskets rather than a handful of examples.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  normalizeOrderLines,
  CartValidationError,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  productIdsOf,
  variantIdsOf,
  quantityByProduct,
  type CartLine,
} from "../../../../cod-shared/queries/cart";

const base = { productId: "prod_1", productName: "T-Shirt" };

// ─── Legacy shape: flat single product ────────────────────────────────────────

describe("normalizeOrderLines — legacy flat request", () => {
  it("turns a simple product into exactly one line", () => {
    expect(normalizeOrderLines({ ...base, quantity: 2 })).toEqual([
      {
        productId: "prod_1",
        productName: "T-Shirt",
        variantId: null,
        variantLabel: null,
        quantity: 2,
        offerId: undefined,
      },
    ]);
  });

  it("defaults a missing quantity to 1", () => {
    expect(normalizeOrderLines(base)[0].quantity).toBe(1);
  });

  it("carries variantId, label and offerId through", () => {
    const [line] = normalizeOrderLines({
      ...base,
      variantId: "var_1",
      variantLabel: "Red / M",
      quantity: 3,
      offerId: "offer_1",
    });
    expect(line).toMatchObject({
      variantId: "var_1",
      variantLabel: "Red / M",
      quantity: 3,
      offerId: "offer_1",
    });
  });

  it("treats an explicit null variant as no variant", () => {
    expect(normalizeOrderLines({ ...base, variantId: null })[0].variantId).toBeNull();
  });
});

// ─── Legacy shape: per-unit variant selections ────────────────────────────────

describe("normalizeOrderLines — variantSelections", () => {
  it("groups repeated units of the same variant into one line", () => {
    const lines = normalizeOrderLines({
      ...base,
      variantSelections: [
        { variantId: "var_red", variantLabel: "Red" },
        { variantId: "var_red", variantLabel: "Red" },
        { variantId: "var_blue", variantLabel: "Blue" },
      ],
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ variantId: "var_red", quantity: 2 });
    expect(lines[1]).toMatchObject({ variantId: "var_blue", quantity: 1 });
  });

  it("preserves the order the shopper picked the variants in", () => {
    const lines = normalizeOrderLines({
      ...base,
      variantSelections: [
        { variantId: "var_c" },
        { variantId: "var_a" },
        { variantId: "var_b" },
      ],
    });
    expect(lines.map((l) => l.variantId)).toEqual(["var_c", "var_a", "var_b"]);
  });

  it("keeps the first label when a later duplicate carries none", () => {
    const lines = normalizeOrderLines({
      ...base,
      variantSelections: [
        { variantId: "var_red", variantLabel: "Red" },
        { variantId: "var_red" },
      ],
    });
    expect(lines[0]).toMatchObject({ variantLabel: "Red", quantity: 2 });
  });

  it("ignores the flat variantId when selections are present", () => {
    const lines = normalizeOrderLines({
      ...base,
      variantId: "var_ignored",
      variantSelections: [{ variantId: "var_real" }],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].variantId).toBe("var_real");
  });

  it("falls back to the flat shape when selections are empty", () => {
    const lines = normalizeOrderLines({
      ...base,
      variantId: "var_1",
      quantity: 2,
      variantSelections: [],
    });
    expect(lines).toEqual([
      expect.objectContaining({ variantId: "var_1", quantity: 2 }),
    ]);
  });
});

// ─── Cart shape ───────────────────────────────────────────────────────────────

describe("normalizeOrderLines — cart items", () => {
  it("keeps distinct products as separate lines", () => {
    const lines = normalizeOrderLines({
      ...base,
      items: [
        { productId: "prod_1", productName: "T-Shirt", quantity: 1 },
        { productId: "prod_2", productName: "Mug", quantity: 3 },
      ],
    });
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.quantity)).toEqual([1, 3]);
  });

  it("keeps two variants of the SAME product as separate lines", () => {
    const lines = normalizeOrderLines({
      ...base,
      items: [
        { productId: "prod_1", productName: "T", variantId: "var_red", quantity: 1 },
        { productId: "prod_1", productName: "T", variantId: "var_blue", quantity: 2 },
      ],
    });
    expect(lines).toHaveLength(2);
  });

  it("merges the same product+variant sent twice, summing quantity", () => {
    const lines = normalizeOrderLines({
      ...base,
      items: [
        { productId: "prod_1", productName: "T", variantId: "var_red", quantity: 2 },
        { productId: "prod_1", productName: "T", variantId: "var_red", quantity: 3 },
      ],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(5);
  });

  it("merges a simple product sent twice with no variant", () => {
    const lines = normalizeOrderLines({
      ...base,
      items: [
        { productId: "prod_1", productName: "T", quantity: 2 },
        { productId: "prod_1", productName: "T", quantity: 1 },
      ],
    });
    expect(lines).toEqual([expect.objectContaining({ quantity: 3 })]);
  });

  it("takes items over the flat fields when both are present", () => {
    const lines = normalizeOrderLines({
      productId: "prod_legacy",
      productName: "Legacy",
      quantity: 9,
      items: [{ productId: "prod_cart", productName: "Cart", quantity: 1 }],
    });
    expect(lines).toEqual([
      expect.objectContaining({ productId: "prod_cart", quantity: 1 }),
    ]);
  });

  it("falls back to the flat shape when items is empty", () => {
    const lines = normalizeOrderLines({ ...base, quantity: 4, items: [] });
    expect(lines).toEqual([
      expect.objectContaining({ productId: "prod_1", quantity: 4 }),
    ]);
  });
});

// ─── Bounds — the failure paths ───────────────────────────────────────────────

describe("normalizeOrderLines — bounds", () => {
  it(`rejects more than ${MAX_CART_LINES} distinct lines`, () => {
    const items = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => ({
      productId: `prod_${i}`,
      productName: `P${i}`,
      quantity: 1,
    }));

    try {
      normalizeOrderLines({ ...base, items });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CartValidationError);
      expect((err as CartValidationError).code).toBe("TOO_MANY_LINES");
      expect((err as CartValidationError).detail).toMatchObject({
        lines: MAX_CART_LINES + 1,
        max: MAX_CART_LINES,
      });
    }
  });

  it(`accepts exactly ${MAX_CART_LINES} lines`, () => {
    const items = Array.from({ length: MAX_CART_LINES }, (_, i) => ({
      productId: `prod_${i}`,
      productName: `P${i}`,
      quantity: 1,
    }));
    expect(normalizeOrderLines({ ...base, items })).toHaveLength(MAX_CART_LINES);
  });

  it("counts lines AFTER merging, so duplicates do not trip the cap", () => {
    // 30 entries, but only 2 distinct lines — must be accepted.
    const items = Array.from({ length: 30 }, (_, i) => ({
      productId: i % 2 === 0 ? "prod_a" : "prod_b",
      productName: "P",
      quantity: 1,
    }));
    expect(normalizeOrderLines({ ...base, items })).toHaveLength(2);
  });

  it(`rejects a single line over ${MAX_LINE_QUANTITY} units`, () => {
    try {
      normalizeOrderLines({ ...base, quantity: MAX_LINE_QUANTITY + 1 });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as CartValidationError).code).toBe("LINE_QUANTITY_EXCEEDED");
    }
  });

  it("rejects duplicates that SUM past the quantity cap", () => {
    // 60 + 60 of the same variant is 120 units of one thing. Checking before
    // the merge would have let this through.
    try {
      normalizeOrderLines({
        ...base,
        items: [
          { productId: "prod_1", productName: "T", quantity: 60 },
          { productId: "prod_1", productName: "T", quantity: 60 },
        ],
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as CartValidationError).code).toBe("LINE_QUANTITY_EXCEEDED");
      expect((err as CartValidationError).detail).toMatchObject({ quantity: 120 });
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe("basket helpers", () => {
  const lines: CartLine[] = [
    { productId: "p1", productName: "A", variantId: "v1", variantLabel: null, quantity: 2 },
    { productId: "p1", productName: "A", variantId: "v2", variantLabel: null, quantity: 1 },
    { productId: "p2", productName: "B", variantId: null, variantLabel: null, quantity: 4 },
  ];

  it("productIdsOf returns each product once", () => {
    expect(productIdsOf(lines)).toEqual(["p1", "p2"]);
  });

  it("variantIdsOf drops nulls", () => {
    expect(variantIdsOf(lines)).toEqual(["v1", "v2"]);
  });

  it("quantityByProduct sums a product across its variants", () => {
    // 2 + 1 of p1 is three units of p1 — a 'buy 3' offer must fire.
    expect(quantityByProduct(lines).get("p1")).toBe(3);
    expect(quantityByProduct(lines).get("p2")).toBe(4);
  });
});

// ─── Invariants, across generated baskets ─────────────────────────────────────

describe("normalizeOrderLines — properties", () => {
  const itemArb = fc.record({
    productId: fc.constantFrom("p1", "p2", "p3"),
    productName: fc.constant("P"),
    variantId: fc.option(fc.constantFrom("v1", "v2"), { nil: undefined }),
    quantity: fc.integer({ min: 1, max: 5 }),
  });

  it("never loses units: total out equals total in", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { minLength: 1, maxLength: 12 }), (items) => {
        const lines = normalizeOrderLines({ ...base, items });
        const inTotal = items.reduce((s, i) => s + i.quantity, 0);
        const outTotal = lines.reduce((s, l) => s + l.quantity, 0);
        expect(outTotal).toBe(inTotal);
      }),
    );
  });

  it("never emits two lines with the same product+variant", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { minLength: 1, maxLength: 12 }), (items) => {
        const lines = normalizeOrderLines({ ...base, items });
        const keys = lines.map((l) => `${l.productId}|${l.variantId ?? ""}`);
        expect(new Set(keys).size).toBe(keys.length);
      }),
    );
  });

  it("is deterministic — the same request always gives the same lines", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { minLength: 1, maxLength: 12 }), (items) => {
        expect(normalizeOrderLines({ ...base, items })).toEqual(
          normalizeOrderLines({ ...base, items }),
        );
      }),
    );
  });

  it("quantityByProduct agrees with the raw request, per product", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { minLength: 1, maxLength: 12 }), (items) => {
        const totals = quantityByProduct(normalizeOrderLines({ ...base, items }));
        for (const id of new Set(items.map((i) => i.productId))) {
          const expected = items
            .filter((i) => i.productId === id)
            .reduce((s, i) => s + i.quantity, 0);
          expect(totals.get(id)).toBe(expected);
        }
      }),
    );
  });

  it("emits at least one line for any non-empty request", () => {
    fc.assert(
      fc.property(fc.array(itemArb, { minLength: 1, maxLength: 12 }), (items) => {
        expect(normalizeOrderLines({ ...base, items }).length).toBeGreaterThan(0);
      }),
    );
  });
});

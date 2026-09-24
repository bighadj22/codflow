/**
 * resolveCartOffers — the offer rules, exhaustively.
 *
 * Pure function: candidates in, decision out. No database and no clock, so
 * every rule and every edge is cheap to state directly, and the invariants are
 * property-tested across generated baskets rather than three examples.
 *
 * The integration — that these candidates are the right ones, and that the
 * rewards become real order lines with real stock deducted — is proven against
 * real D1 in cart-orders-e2e.test.ts.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveCartOffers } from "../../../../cod-shared/queries/offers-cart";
import type { CartLine } from "../../../../cod-shared/queries/cart";
import type { CatalogOffer } from "../../../../cod-shared/queries/catalog-snapshot";

// ─── Builders ─────────────────────────────────────────────────────────────────

function line(overrides: Partial<CartLine> & { productId: string }): CartLine {
  return {
    productName: "P",
    variantId: null,
    variantLabel: null,
    quantity: 1,
    ...overrides,
  };
}

let offerSeq = 0;
function offer(overrides: Partial<CatalogOffer> & { triggerProductId: string }): CatalogOffer {
  offerSeq += 1;
  return {
    id: `offer_${offerSeq}`,
    name: "Offer",
    triggerVariantId: null,
    triggerQuantity: 2,
    rewardProductId: overrides.triggerProductId,
    rewardVariantId: null,
    rewardQuantity: 1,
    discountType: "free",
    startsAt: null,
    endsAt: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as CatalogOffer;
}

// ─── Rule 1: trigger counts a product across its lines ────────────────────────

describe("resolveCartOffers — trigger quantity", () => {
  it("does not fire below the trigger", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 1 })],
      [offer({ triggerProductId: "p1", triggerQuantity: 2 })],
    );
    expect(result.earned).toHaveLength(0);
  });

  it("fires exactly at the trigger", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 2 })],
      [offer({ triggerProductId: "p1", triggerQuantity: 2 })],
    );
    expect(result.earned).toHaveLength(1);
  });

  it("sums a product across its variants to test the trigger", () => {
    // 2 red + 1 blue is three of that product — "buy 3" must fire.
    const result = resolveCartOffers(
      [
        line({ productId: "p1", variantId: "red", quantity: 2 }),
        line({ productId: "p1", variantId: "blue", quantity: 1 }),
      ],
      [offer({ triggerProductId: "p1", triggerQuantity: 3 })],
    );
    expect(result.earned).toHaveLength(1);
  });

  it("does not borrow quantity from another product", () => {
    const result = resolveCartOffers(
      [
        line({ productId: "p1", quantity: 1 }),
        line({ productId: "p2", quantity: 5 }),
      ],
      [offer({ triggerProductId: "p1", triggerQuantity: 2 })],
    );
    expect(result.earned).toHaveLength(0);
  });

  it("ignores an offer for a product that is not in the basket", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 5 })],
      [offer({ triggerProductId: "p_other", triggerQuantity: 1 })],
    );
    expect(result.earned).toHaveLength(0);
  });
});

// ─── Rule 2: highest satisfied tier wins ──────────────────────────────────────

describe("resolveCartOffers — tier selection", () => {
  it("picks the highest tier the basket satisfies", () => {
    const low = offer({ triggerProductId: "p1", triggerQuantity: 2, rewardQuantity: 1 });
    const high = offer({ triggerProductId: "p1", triggerQuantity: 4, rewardQuantity: 3 });
    const result = resolveCartOffers([line({ productId: "p1", quantity: 5 })], [low, high]);
    expect(result.earned[0].offer.id).toBe(high.id);
  });

  it("falls to the lower tier when the higher is not satisfied", () => {
    const low = offer({ triggerProductId: "p1", triggerQuantity: 2 });
    const high = offer({ triggerProductId: "p1", triggerQuantity: 10 });
    const result = resolveCartOffers([line({ productId: "p1", quantity: 3 })], [low, high]);
    expect(result.earned[0].offer.id).toBe(low.id);
  });

  it("gives a product at most one offer", () => {
    const a = offer({ triggerProductId: "p1", triggerQuantity: 2 });
    const b = offer({ triggerProductId: "p1", triggerQuantity: 2 });
    const result = resolveCartOffers([line({ productId: "p1", quantity: 9 })], [a, b]);
    expect(result.earned).toHaveLength(1);
  });

  it("breaks a tie the same way every time", () => {
    const a = offer({ id: "offer_bbb", triggerProductId: "p1", triggerQuantity: 2 });
    const b = offer({ id: "offer_aaa", triggerProductId: "p1", triggerQuantity: 2 });
    const forwards = resolveCartOffers([line({ productId: "p1", quantity: 2 })], [a, b]);
    const backwards = resolveCartOffers([line({ productId: "p1", quantity: 2 })], [b, a]);
    expect(forwards.earned[0].offer.id).toBe(backwards.earned[0].offer.id);
  });

  it("fires an offer on each of several products", () => {
    const result = resolveCartOffers(
      [
        line({ productId: "p1", quantity: 2 }),
        line({ productId: "p2", quantity: 2 }),
      ],
      [
        offer({ triggerProductId: "p1", triggerQuantity: 2 }),
        offer({ triggerProductId: "p2", triggerQuantity: 2 }),
      ],
    );
    expect(result.earned).toHaveLength(2);
  });
});

// ─── Rule 3: a client-chosen offer must independently qualify ─────────────────

describe("resolveCartOffers — client-requested offer", () => {
  it("honours a requested offer that qualifies", () => {
    const low = offer({ triggerProductId: "p1", triggerQuantity: 2 });
    const high = offer({ triggerProductId: "p1", triggerQuantity: 4 });
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 5, offerId: low.id })],
      [low, high],
    );
    expect(result.earned[0].offer.id).toBe(low.id);
  });

  it("ignores a requested offer the basket has not earned", () => {
    const high = offer({ triggerProductId: "p1", triggerQuantity: 10 });
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 1, offerId: high.id })],
      [high],
    );
    expect(result.earned).toHaveLength(0);
  });

  it("falls back to the best earned offer when the request does not qualify", () => {
    const low = offer({ triggerProductId: "p1", triggerQuantity: 2 });
    const unreachable = offer({ triggerProductId: "p1", triggerQuantity: 99 });
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 3, offerId: unreachable.id })],
      [low, unreachable],
    );
    expect(result.earned[0].offer.id).toBe(low.id);
  });

  it("ignores an offerId that matches nothing at all", () => {
    const real = offer({ triggerProductId: "p1", triggerQuantity: 2 });
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 2, offerId: "offer_does_not_exist" })],
      [real],
    );
    expect(result.earned[0].offer.id).toBe(real.id);
  });
});

// ─── Variant-locked offers ────────────────────────────────────────────────────

describe("resolveCartOffers — variant locking", () => {
  it("fires when the locked variant is in the basket", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", variantId: "red", quantity: 2 })],
      [offer({ triggerProductId: "p1", triggerVariantId: "red", triggerQuantity: 2 })],
    );
    expect(result.earned).toHaveLength(1);
  });

  it("does not fire when only another variant is present", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", variantId: "blue", quantity: 5 })],
      [offer({ triggerProductId: "p1", triggerVariantId: "red", triggerQuantity: 2 })],
    );
    expect(result.earned).toHaveLength(0);
  });

  it("prefers an unlocked offer when the locked one does not match", () => {
    const locked = offer({
      triggerProductId: "p1",
      triggerVariantId: "red",
      triggerQuantity: 4,
    });
    const open = offer({ triggerProductId: "p1", triggerQuantity: 2 });
    const result = resolveCartOffers(
      [line({ productId: "p1", variantId: "blue", quantity: 5 })],
      [locked, open],
    );
    expect(result.earned[0].offer.id).toBe(open.id);
  });

  it("matches a variant-locked offer against any line of that product", () => {
    // The locked variant is the second line, not the first.
    const result = resolveCartOffers(
      [
        line({ productId: "p1", variantId: "blue", quantity: 1 }),
        line({ productId: "p1", variantId: "red", quantity: 1 }),
      ],
      [offer({ triggerProductId: "p1", triggerVariantId: "red", triggerQuantity: 2 })],
    );
    expect(result.earned).toHaveLength(1);
  });
});

// ─── Rule 4: free shipping (plan Q2) ──────────────────────────────────────────

describe("resolveCartOffers — free shipping", () => {
  const freeShip = (productId: string, triggerQuantity = 2) =>
    offer({
      triggerProductId: productId,
      triggerQuantity,
      discountType: "free_shipping",
      rewardProductId: null,
      rewardQuantity: 0,
    });

  it("applies to a single-product basket", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 2 })],
      [freeShip("p1")],
    );
    expect(result.freeShipping).toBe(true);
  });

  it("applies to one product ordered in several variants", () => {
    // Still ONE distinct product, so this is not a mixed basket.
    const result = resolveCartOffers(
      [
        line({ productId: "p1", variantId: "red", quantity: 1 }),
        line({ productId: "p1", variantId: "blue", quantity: 1 }),
      ],
      [freeShip("p1")],
    );
    expect(result.freeShipping).toBe(true);
  });

  it("does NOT apply once a second product joins the basket", () => {
    // The loophole: a cheap trigger must not ship an expensive basket free.
    const result = resolveCartOffers(
      [
        line({ productId: "cheap_case", quantity: 2 }),
        line({ productId: "expensive_tv", quantity: 1 }),
      ],
      [freeShip("cheap_case")],
    );
    expect(result.freeShipping).toBe(false);
  });

  it("still records the offer as applied even where it changed nothing", () => {
    const fs = freeShip("cheap_case");
    const result = resolveCartOffers(
      [
        line({ productId: "cheap_case", quantity: 2 }),
        line({ productId: "tv", quantity: 1 }),
      ],
      [fs],
    );
    expect(result.appliedOfferIds).toContain(fs.id);
  });

  it("never produces a reward line", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 2 })],
      [freeShip("p1")],
    );
    expect(result.earned).toHaveLength(0);
  });

  it("does not fire below its own trigger", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 1 })],
      [freeShip("p1", 2)],
    );
    expect(result.freeShipping).toBe(false);
  });

  it("coexists with a free-product offer on another product", () => {
    const result = resolveCartOffers(
      [line({ productId: "p1", quantity: 2 })],
      [freeShip("p1"), offer({ triggerProductId: "p1", triggerQuantity: 2 })],
    );
    // One offer per product: the higher-ranked one wins, so exactly one of the
    // two outcomes happens — never both from the same product.
    expect(result.earned.length + (result.freeShipping ? 1 : 0)).toBe(1);
  });
});

// ─── Invariants ───────────────────────────────────────────────────────────────

describe("resolveCartOffers — properties", () => {
  const lineArb = fc.record({
    productId: fc.constantFrom("p1", "p2", "p3"),
    quantity: fc.integer({ min: 1, max: 6 }),
  });

  const candidates = [
    offer({ triggerProductId: "p1", triggerQuantity: 2 }),
    offer({ triggerProductId: "p1", triggerQuantity: 4 }),
    offer({ triggerProductId: "p2", triggerQuantity: 3 }),
    offer({
      triggerProductId: "p3",
      triggerQuantity: 2,
      discountType: "free_shipping",
      rewardProductId: null,
      rewardQuantity: 0,
    }),
  ];

  const toLines = (raw: Array<{ productId: string; quantity: number }>): CartLine[] =>
    raw.map((r) => line(r));

  it("never returns more earned offers than there are distinct products", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), (raw) => {
        const lines = toLines(raw);
        const result = resolveCartOffers(lines, candidates);
        const distinct = new Set(lines.map((l) => l.productId)).size;
        expect(result.earned.length).toBeLessThanOrEqual(distinct);
      }),
    );
  });

  it("never earns the same offer twice", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), (raw) => {
        const ids = resolveCartOffers(toLines(raw), candidates).earned.map(
          (e) => e.offer.id,
        );
        expect(new Set(ids).size).toBe(ids.length);
      }),
    );
  });

  it("only ever earns an offer whose trigger the basket actually meets", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), (raw) => {
        const lines = toLines(raw);
        const totals = new Map<string, number>();
        for (const l of lines) {
          totals.set(l.productId, (totals.get(l.productId) ?? 0) + l.quantity);
        }
        for (const { offer: o } of resolveCartOffers(lines, candidates).earned) {
          expect(totals.get(o.triggerProductId) ?? 0).toBeGreaterThanOrEqual(
            o.triggerQuantity,
          );
        }
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), (raw) => {
        const lines = toLines(raw);
        expect(resolveCartOffers(lines, candidates)).toEqual(
          resolveCartOffers(lines, candidates),
        );
      }),
    );
  });

  it("free shipping implies exactly one distinct product in the basket", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), (raw) => {
        const lines = toLines(raw);
        if (resolveCartOffers(lines, candidates).freeShipping) {
          expect(new Set(lines.map((l) => l.productId)).size).toBe(1);
        }
      }),
    );
  });

  it("never earns an offer with no candidates at all", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), (raw) => {
        const result = resolveCartOffers(toLines(raw), []);
        expect(result.earned).toHaveLength(0);
        expect(result.freeShipping).toBe(false);
      }),
    );
  });
});

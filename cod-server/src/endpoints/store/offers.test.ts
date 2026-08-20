/**
 * Offer Selection — Unit Tests
 *
 * Tests selectApplicableOffer(), checkStoreOrderStock(), and the interaction
 * between offers, stock, and order validation.
 *
 * selectApplicableOffer queries:
 *   Q_EXPLICIT: db.select().from(offers).where(id + baseConditions).get()  → single offer row
 *   Q_ALL:      db.select().from(offers).where(baseConditions).orderBy(desc qty).all() → offer[]
 *
 * Scenarios:
 *
 * SECTION A — offer selection logic
 *  A1.  qty < triggerQuantity              → no offer
 *  A2.  qty == triggerQuantity             → offer fires
 *  A3.  qty > triggerQuantity              → offer fires
 *  A4.  inactive offer                     → no offer
 *  A5.  expired offer (endsAt in past)     → no offer
 *  A6.  future offer (startsAt in future)  → no offer
 *  A7.  active + scheduled (starts now)    → offer fires
 *  A8.  explicit offerId found + valid     → returns that offer
 *  A9.  explicit offerId not found/invalid → falls back to auto-detect
 *  A10. explicit offerId wrong product     → falls back (baseCondition filters it)
 *
 * SECTION B — priority / multi-tier
 *  B1.  two offers same product, qty satisfies both  → highest triggerQuantity wins
 *  B2.  two offers same product, qty satisfies only lower tier → lower wins
 *  B3.  free_shipping offer preferred over free when qty satisfies both (desc order)
 *
 * SECTION C — variant locking
 *  C1.  triggerVariantId = null  → any variant matches
 *  C2.  triggerVariantId matches customer variant     → fires
 *  C3.  triggerVariantId does NOT match variant       → no offer
 *  C4.  triggerVariantId set, customer has no variant → no offer
 *
 * SECTION D — discount types
 *  D1.  discountType = "free"          → offer row returned with correct fields
 *  D2.  discountType = "free_shipping" → offer row returned with correct fields
 *
 * SECTION E — stock × offer interaction
 *  E1.  variant in stock, offer fires               → stock gate passes, offer available
 *  E2.  variant OOS, offer would fire               → stock gate blocks (offer irrelevant)
 *  E3.  qty exactly at variant stock, offer fires   → stock gate passes (==, not >)
 *  E4.  qty exceeds variant stock, offer would fire → stock gate blocks
 *  E5.  offer free-product same-variant, variant stock=2, order qty=2 → passes (reward stock is separate guard)
 *
 * SECTION F — edge / defensive
 *  F1.  no offers in DB at all → null
 *  F2.  product exists but zero offers → null
 *  F3.  offer for different product → null
 *  F4.  qty = 0 (edge) → no offer (lte(trigger, 0) never true for trigger >= 1)
 */

import { describe, it, expect } from "vitest";
import { selectApplicableOffer } from "./queries";
import { checkStoreOrderStock } from "./queries";
import { makeMockDb, f, a, offerRow } from "@/test-utils/mock-db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAST   = "2000-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";
const NOW_TS = new Date().toISOString();

/** Q1 for checkStoreOrderStock: partial select { track_inventory, inventory } */
function productQ(trackInventory: boolean, inventory: number) {
  return f({ track_inventory: trackInventory ? 1 : 0, inventory });
}
/** Q2 for checkStoreOrderStock: partial select { inventory } */
function variantQ(inventory: number) {
  return f({ inventory });
}

/**
 * selectApplicableOffer issues ONE of two query patterns:
 *   - explicit offerId: f(offerRow) then possibly a([]) as fallback
 *   - auto-detect:      a([offerRow, ...])
 */

// ─── SECTION A: offer selection logic ────────────────────────────────────────

describe("selectApplicableOffer — qty threshold", () => {
  it("A1: qty below triggerQuantity → no offer", async () => {
    // auto-detect: returns empty list
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 1, null, undefined);
    expect(result).toBeNull();
  });

  it("A2: qty == triggerQuantity → offer fires", async () => {
    const offer = offerRow({ trigger_quantity: 2, discount_type: "free" });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result).not.toBeNull();
    expect(result!.triggerQuantity).toBe(2);
  });

  it("A3: qty > triggerQuantity → offer fires", async () => {
    const offer = offerRow({ trigger_quantity: 2 });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-001", 5, null, undefined);
    expect(result).not.toBeNull();
  });

  it("A4: inactive offer in DB → DB filter excludes it, returns null", async () => {
    // selectApplicableOffer queries with eq(status, 'active'), so inactive never returned
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 3, null, undefined);
    expect(result).toBeNull();
  });

  it("A5: expired offer (endsAt in past) → DB filter excludes it, returns null", async () => {
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result).toBeNull();
  });

  it("A6: future offer (startsAt not yet reached) → DB filter excludes it, returns null", async () => {
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result).toBeNull();
  });

  it("A7: scheduled offer whose window is now → fires (mock returns it)", async () => {
    const offer = offerRow({ starts_at: PAST, ends_at: FUTURE, trigger_quantity: 2 });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result).not.toBeNull();
    expect(result!.startsAt).toBe(PAST);
    expect(result!.endsAt).toBe(FUTURE);
  });

  it("A8: explicit offerId found and valid → returns that exact offer", async () => {
    const offer = offerRow({ id: "offer-explicit", trigger_quantity: 2 });
    // explicit path: f(offer) → found, no fallback needed
    const db = makeMockDb([f(offer)]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, "offer-explicit");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("offer-explicit");
  });

  it("A9: explicit offerId not found → falls back to auto-detect", async () => {
    const fallback = offerRow({ id: "offer-auto", trigger_quantity: 2 });
    // explicit path: f(null) → not found; fallback: a([fallback])
    const db = makeMockDb([f(null), a([fallback])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, "offer-missing");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("offer-auto");
  });

  it("A10: explicit offerId returns no match (wrong product filtered by DB) → fallback returns null", async () => {
    const db = makeMockDb([f(null), a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, "offer-other-prod");
    expect(result).toBeNull();
  });
});

// ─── SECTION B: priority / multi-tier ────────────────────────────────────────

describe("selectApplicableOffer — tier priority", () => {
  it("B1: qty satisfies both tiers → highest triggerQuantity wins (first in desc-sorted list)", async () => {
    // DB returns desc(triggerQuantity): offer-002 (qty=3) first, offer-001 (qty=2) second
    const high = offerRow({ id: "offer-002", trigger_quantity: 3, reward_quantity: 2 });
    const low  = offerRow({ id: "offer-001", trigger_quantity: 2, reward_quantity: 1 });
    const db = makeMockDb([a([high, low])]);
    const result = await selectApplicableOffer(db, "prod-001", 4, null, undefined);
    expect(result!.id).toBe("offer-002");
    expect(result!.rewardQuantity).toBe(2);
  });

  it("B2: qty satisfies only lower tier (qty=2, thresholds 2 and 3) → lower wins", async () => {
    // DB already filters lte(triggerQuantity, qty=2) — so only offer-001 returned
    const low = offerRow({ id: "offer-001", trigger_quantity: 2, reward_quantity: 1 });
    const db = makeMockDb([a([low])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result!.id).toBe("offer-001");
    expect(result!.rewardQuantity).toBe(1);
  });

  it("B3: only one tier matches quantity → that tier fires", async () => {
    const only = offerRow({ id: "offer-001", trigger_quantity: 2 });
    const db = makeMockDb([a([only])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result!.id).toBe("offer-001");
  });
});

// ─── SECTION C: variant locking ──────────────────────────────────────────────

describe("selectApplicableOffer — variant locking", () => {
  it("C1: triggerVariantId=null, any variant → fires", async () => {
    const offer = offerRow({ trigger_variant_id: null });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, "var-001-3", undefined);
    expect(result).not.toBeNull();
  });

  it("C2: triggerVariantId matches customer's variant → fires", async () => {
    const offer = offerRow({ trigger_variant_id: "var-002-2" });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-002", 2, "var-002-2", undefined);
    expect(result).not.toBeNull();
  });

  it("C3: triggerVariantId does NOT match customer's variant → skipped, no offer", async () => {
    // DB returns the offer, but variant filter in JS rejects it
    const offer = offerRow({ trigger_variant_id: "var-002-2" });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-002", 2, "var-002-1", undefined);
    expect(result).toBeNull();
  });

  it("C4: triggerVariantId set, customer ordered simple product (no variantId) → no offer", async () => {
    const offer = offerRow({ trigger_variant_id: "var-002-2" });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-002", 2, null, undefined);
    expect(result).toBeNull();
  });

  it("C5: two candidates — locked variant offer rejected, fallback null-variant offer fires", async () => {
    const locked  = offerRow({ id: "locked",   trigger_variant_id: "var-001-5", trigger_quantity: 2 });
    const anyVar  = offerRow({ id: "any-var",  trigger_variant_id: null,        trigger_quantity: 2 });
    // desc order: both at qty=2, locked first (same qty — order by DB; in practice both returned)
    const db = makeMockDb([a([locked, anyVar])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, "var-001-1", undefined);
    // locked is skipped (variant mismatch), anyVar fires
    expect(result!.id).toBe("any-var");
  });
});

// ─── SECTION D: discount types ───────────────────────────────────────────────

describe("selectApplicableOffer — discount types", () => {
  it("D1: discountType=free → offer returned with correct fields", async () => {
    const offer = offerRow({
      id: "offer-001",
      discount_type: "free",
      reward_product_id: "prod-001",
      reward_quantity: 1,
    });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result!.discountType).toBe("free");
    expect(result!.rewardProductId).toBe("prod-001");
    expect(result!.rewardQuantity).toBe(1);
  });

  it("D2: discountType=free_shipping → offer returned, rewardProductId null, rewardQuantity 0", async () => {
    const offer = offerRow({
      id: "offer-006",
      discount_type: "free_shipping",
      reward_product_id: null,
      reward_quantity: 0,
      trigger_product_id: "prod-004",
    });
    const db = makeMockDb([a([offer])]);
    const result = await selectApplicableOffer(db, "prod-004", 2, null, undefined);
    expect(result!.discountType).toBe("free_shipping");
    expect(result!.rewardProductId).toBeNull();
    expect(result!.rewardQuantity).toBe(0);
  });
});

// ─── SECTION E: stock × offer interaction ────────────────────────────────────

describe("checkStoreOrderStock — stock × offer", () => {
  it("E1: variant in stock, offer would fire → stock gate passes", async () => {
    // variant has 5 in stock, ordering 2 — stock check passes (offer selection is separate)
    const db = makeMockDb([productQ(true, 0), variantQ(5)]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-001",
      variantId: "var-001-1",
      variantSelections: [],
      quantity: 2,
    });
    expect(error).toBeNull();
  });

  it("E2: variant OOS, offer would fire → stock gate blocks before offer", async () => {
    const db = makeMockDb([productQ(true, 0), variantQ(0)]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-001",
      variantId: "var-001-1",
      variantSelections: [],
      quantity: 2,
    });
    expect(error).not.toBeNull();
    expect(typeof error).toBe("string");
  });

  it("E3: qty exactly equals variant stock → passes (stock gate uses >=, not >)", async () => {
    // stock=2, qty=2 — exactly at cap, should pass
    const db = makeMockDb([productQ(true, 0), variantQ(2)]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-001",
      variantId: "var-001-1",
      variantSelections: [],
      quantity: 2,
    });
    expect(error).toBeNull();
  });

  it("E4: qty exceeds variant stock → stock gate blocks", async () => {
    // stock=2, qty=3 — over cap
    const db = makeMockDb([productQ(true, 0), variantQ(2)]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-001",
      variantId: "var-001-1",
      variantSelections: [],
      quantity: 3,
    });
    expect(error).not.toBeNull();
  });

  it("E5: offer tier (variantSelections) — qty satisfies offer, all variants in stock → passes", async () => {
    // Offer tier: 2 units selected (var_a ×1, var_b ×1), both in stock
    const db = makeMockDb([
      productQ(true, 0),
      variantQ(5),   // var_a: 5 in stock
      variantQ(8),   // var_b: 8 in stock
    ]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-001",
      variantId: null,
      variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      quantity: 1,
    });
    expect(error).toBeNull();
  });

  it("E6: offer tier — one selection OOS, offer should not be allowed through stock gate", async () => {
    const db = makeMockDb([
      productQ(true, 0),
      variantQ(5),   // var_a: ok
      variantQ(0),   // var_b: OOS
    ]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-001",
      variantId: null,
      variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      quantity: 1,
    });
    expect(error).not.toBeNull();
  });

  it("E7: offer tier — same variant repeated, cumulative qty exceeds stock → blocked", async () => {
    // Customer picks var_a ×3 via offer tier, but only 2 in stock
    const db = makeMockDb([
      productQ(true, 0),
      variantQ(2),   // var_a: only 2 in stock
    ]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-001",
      variantId: null,
      variantSelections: [
        { variantId: "var_a" },
        { variantId: "var_a" },
        { variantId: "var_a" },
      ],
      quantity: 1,
    });
    expect(error).not.toBeNull();
  });
});

// ─── SECTION F: edge / defensive ─────────────────────────────────────────────

describe("selectApplicableOffer — edge cases", () => {
  it("F1: no offers in DB at all → null", async () => {
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 10, null, undefined);
    expect(result).toBeNull();
  });

  it("F2: product exists but zero matching offers → null", async () => {
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-ghost", 3, null, undefined);
    expect(result).toBeNull();
  });

  it("F3: offer is for a different product → DB filter excludes it, null returned", async () => {
    // selectApplicableOffer filters eq(triggerProductId, productId) in DB
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result).toBeNull();
  });

  it("F4: qty=0 → no offer (lte(triggerQuantity, 0) never true for trigger≥1)", async () => {
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-001", 0, null, undefined);
    expect(result).toBeNull();
  });

  it("F5: explicit offerId provided, DB returns it directly → correct id in result", async () => {
    const offer = offerRow({ id: "offer-005", trigger_quantity: 1, discount_type: "free" });
    const db = makeMockDb([f(offer)]);
    const result = await selectApplicableOffer(db, "prod-007", 1, null, "offer-005");
    expect(result!.id).toBe("offer-005");
  });
});

// ─── SECTION G: offer + stock combined regression ────────────────────────────
// Simulates real scenarios based on the seeded KickStore offers

describe("KickStore offer regression scenarios", () => {
  it("Air Runner Pro qty=2 → triggers offer-001 (lowest tier)", async () => {
    const offer001 = offerRow({ id: "offer-001", trigger_quantity: 2, reward_quantity: 1 });
    // DB returns only offer-001 (offer-002 filtered out because lte(3, 2) = false)
    const db = makeMockDb([a([offer001])]);
    const result = await selectApplicableOffer(db, "prod-001", 2, null, undefined);
    expect(result!.id).toBe("offer-001");
    expect(result!.rewardQuantity).toBe(1);
  });

  it("Air Runner Pro qty=3 → triggers offer-002 (higher tier, 2 free)", async () => {
    const offer002 = offerRow({ id: "offer-002", trigger_quantity: 3, reward_quantity: 2 });
    const offer001 = offerRow({ id: "offer-001", trigger_quantity: 2, reward_quantity: 1 });
    // Both satisfy qty=3, desc sort → offer-002 first
    const db = makeMockDb([a([offer002, offer001])]);
    const result = await selectApplicableOffer(db, "prod-001", 3, null, undefined);
    expect(result!.id).toBe("offer-002");
    expect(result!.rewardQuantity).toBe(2);
  });

  it("Street Fighter qty=2 → free_shipping offer (offer-006)", async () => {
    const offer006 = offerRow({
      id: "offer-006",
      trigger_product_id: "prod-004",
      discount_type: "free_shipping",
      reward_product_id: null,
      reward_quantity: 0,
      trigger_quantity: 2,
    });
    const db = makeMockDb([a([offer006])]);
    const result = await selectApplicableOffer(db, "prod-004", 2, null, undefined);
    expect(result!.discountType).toBe("free_shipping");
  });

  it("Street Fighter qty=2 but variant OOS → stock gate blocks despite matching offer", async () => {
    const db = makeMockDb([productQ(true, 0), variantQ(0)]);
    const error = await checkStoreOrderStock(db, {
      productId: "prod-004",
      variantId: "var-004-6",  // 45/Kaki — OOS
      variantSelections: [],
      quantity: 2,
    });
    expect(error).not.toBeNull();
  });

  it("Night Rider offer is inactive → returns null regardless of qty", async () => {
    // inactive offers are filtered in DB query (eq(status, 'active'))
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-009", 5, null, undefined);
    expect(result).toBeNull();
  });

  it("Flex Sport offer expired in 2020 → returns null regardless of qty", async () => {
    // expired offers are filtered in DB query (gte(endsAt, now))
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-006", 5, null, undefined);
    expect(result).toBeNull();
  });

  it("Mountain Trek qty=1 → fires offer-005 (qty=1 trigger)", async () => {
    const offer005 = offerRow({
      id: "offer-005",
      trigger_product_id: "prod-007",
      trigger_quantity: 1,
      reward_product_id: "prod-003",
      reward_quantity: 1,
    });
    const db = makeMockDb([a([offer005])]);
    const result = await selectApplicableOffer(db, "prod-007", 1, null, undefined);
    expect(result!.id).toBe("offer-005");
    expect(result!.rewardProductId).toBe("prod-003");
  });

  it("Desert Storm qty=1 → fires offer-008, cross-product reward", async () => {
    const offer008 = offerRow({
      id: "offer-008",
      trigger_product_id: "prod-008",
      trigger_quantity: 1,
      reward_product_id: "prod-010",
      reward_quantity: 1,
    });
    const db = makeMockDb([a([offer008])]);
    const result = await selectApplicableOffer(db, "prod-008", 1, null, undefined);
    expect(result!.id).toBe("offer-008");
    expect(result!.rewardProductId).toBe("prod-010");
  });

  it("Classic Tennis qty=2 → no offer (offer-004 requires qty≥3)", async () => {
    const db = makeMockDb([a([])]);
    const result = await selectApplicableOffer(db, "prod-003", 2, null, undefined);
    expect(result).toBeNull();
  });

  it("Classic Tennis qty=3 → fires offer-004", async () => {
    const offer004 = offerRow({
      id: "offer-004",
      trigger_product_id: "prod-003",
      trigger_quantity: 3,
      reward_product_id: "prod-010",
      reward_quantity: 1,
    });
    const db = makeMockDb([a([offer004])]);
    const result = await selectApplicableOffer(db, "prod-003", 3, null, undefined);
    expect(result!.id).toBe("offer-004");
  });
});

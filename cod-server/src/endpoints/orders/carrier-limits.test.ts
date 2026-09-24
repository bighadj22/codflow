/**
 * Carrier payload limits — the rules, including the ones that must NOT fire.
 *
 * Pure functions, so every boundary is stated directly. The wiring — that a
 * dispatch actually refuses an over-ceiling order before calling the provider
 * — is asserted in the dispatch tests.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  limitsFor,
  exceedsAmountCeiling,
  buildProductDescription,
  sumParcelWeight,
  CARRIER_LIMITS,
} from "./carrier-limits";

// ─── Limit lookup ─────────────────────────────────────────────────────────────

describe("limitsFor", () => {
  it("knows Yalidine's documented 150,000 ceiling", () => {
    expect(limitsFor("yalidine").maxAmount).toBe(150_000);
  });

  it("enforces no value ceiling for carriers that publish none", () => {
    // Inventing a cap would refuse orders the carrier would have accepted.
    expect(limitsFor("zr_express").maxAmount).toBeNull();
    expect(limitsFor("noest").maxAmount).toBeNull();
  });

  it("falls back to a safe default for an unknown carrier", () => {
    const limits = limitsFor("some_new_carrier");
    expect(limits.maxAmount).toBeNull();
    expect(limits.maxDescription).toBeGreaterThan(0);
  });

  it("gives every known carrier a usable description budget", () => {
    for (const [code, limits] of Object.entries(CARRIER_LIMITS)) {
      expect(limits.maxDescription, code).toBeGreaterThanOrEqual(64);
    }
  });
});

// ─── Amount ceiling ───────────────────────────────────────────────────────────

describe("exceedsAmountCeiling", () => {
  const yalidine = limitsFor("yalidine");

  it("allows an ordinary order", () => {
    expect(exceedsAmountCeiling(9_600, yalidine)).toBe(false);
  });

  it("allows exactly the documented maximum", () => {
    // Yalidine documents 0–150000 inclusive.
    expect(exceedsAmountCeiling(150_000, yalidine)).toBe(false);
  });

  it("rejects one dinar over", () => {
    expect(exceedsAmountCeiling(150_001, yalidine)).toBe(true);
  });

  it("never rejects for a carrier with no ceiling", () => {
    expect(exceedsAmountCeiling(10_000_000, limitsFor("zr_express"))).toBe(false);
  });

  it("allows zero", () => {
    expect(exceedsAmountCeiling(0, yalidine)).toBe(false);
  });
});

// ─── Product description ──────────────────────────────────────────────────────

describe("buildProductDescription", () => {
  it("joins names and appends the order number", () => {
    expect(buildProductDescription(["Shirt", "Mug"], "ORD-20260101-0001", 255)).toBe(
      "Shirt, Mug — ORD-20260101-0001",
    );
  });

  it("collapses duplicate product names", () => {
    expect(buildProductDescription(["Shirt", "Shirt"], "ORD-1", 255)).toBe(
      "Shirt — ORD-1",
    );
  });

  it("drops empty names", () => {
    expect(buildProductDescription(["", "Mug", ""], "ORD-1", 255)).toBe("Mug — ORD-1");
  });

  it("returns just the order number when there are no names", () => {
    expect(buildProductDescription([], "ORD-1", 255)).toBe("ORD-1");
  });

  it("truncates a long basket but KEEPS the order number", () => {
    const names = Array.from({ length: 20 }, (_, i) => `Product Number ${i}`);
    const result = buildProductDescription(names, "ORD-20260101-0042", 120);

    expect(result.length).toBeLessThanOrEqual(120);
    // The suffix is what support searches by — it must survive.
    expect(result).toContain("ORD-20260101-0042");
    expect(result).toContain("…");
  });

  it("keeps the order number even when the limit is absurdly small", () => {
    // Losing traceability is worse than one over-long field.
    expect(buildProductDescription(["A very long product name"], "ORD-1", 5)).toBe(
      "ORD-1",
    );
  });

  it("does not truncate when it fits exactly", () => {
    const exact = buildProductDescription(["AB"], "ORD-1", "AB — ORD-1".length);
    expect(exact).toBe("AB — ORD-1");
    expect(exact).not.toContain("…");
  });

  it("always contains the order number, for any basket", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 40 }), { maxLength: 25 }),
        fc.integer({ min: 40, max: 300 }),
        (names, max) => {
          const result = buildProductDescription(names, "ORD-20260101-0001", max);
          expect(result).toContain("ORD-20260101-0001");
        },
      ),
    );
  });

  it("never exceeds the limit when the limit leaves room for the suffix", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 40 }), { maxLength: 25 }),
        fc.integer({ min: 40, max: 300 }),
        (names, max) => {
          expect(
            buildProductDescription(names, "ORD-1", max).length,
          ).toBeLessThanOrEqual(max);
        },
      ),
    );
  });
});

// ─── Parcel weight ────────────────────────────────────────────────────────────

describe("sumParcelWeight", () => {
  it("sums weight across lines and quantities", () => {
    const weights = new Map([["v1", 0.5], ["v2", 2]]);
    expect(
      sumParcelWeight(
        [
          { variantId: "v1", quantity: 2 },
          { variantId: "v2", quantity: 1 },
        ],
        weights,
      ),
    ).toBe(3);
  });

  it("returns undefined when nothing has a weight", () => {
    // An unweighed parcel sends no weight — guessing would be worse.
    expect(
      sumParcelWeight([{ variantId: "v1", quantity: 1 }], new Map()),
    ).toBeUndefined();
  });

  it("returns undefined for lines with no variant at all", () => {
    expect(
      sumParcelWeight([{ variantId: null, quantity: 3 }], new Map()),
    ).toBeUndefined();
  });

  it("counts the known lines and skips the unknown ones", () => {
    const weights = new Map<string, number | null>([["v1", 1.5], ["v2", null]]);
    expect(
      sumParcelWeight(
        [
          { variantId: "v1", quantity: 2 },
          { variantId: "v2", quantity: 5 },
        ],
        weights,
      ),
    ).toBe(3);
  });

  it("rounds away floating-point noise", () => {
    // 0.1 × 3 is 0.30000000000000004 in binary floating point.
    const weights = new Map([["v1", 0.1]]);
    expect(sumParcelWeight([{ variantId: "v1", quantity: 3 }], weights)).toBe(0.3);
  });

  it("treats a zero weight as known, not missing", () => {
    const weights = new Map([["v1", 0]]);
    expect(sumParcelWeight([{ variantId: "v1", quantity: 2 }], weights)).toBe(0);
  });

  it("never returns a negative total for non-negative weights", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            variantId: fc.constantFrom("v1", "v2", "v3"),
            quantity: fc.integer({ min: 1, max: 20 }),
          }),
          { maxLength: 10 },
        ),
        (lines) => {
          const weights = new Map([["v1", 0.5], ["v2", 1], ["v3", 0]]);
          const total = sumParcelWeight(lines, weights);
          if (total !== undefined) expect(total).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

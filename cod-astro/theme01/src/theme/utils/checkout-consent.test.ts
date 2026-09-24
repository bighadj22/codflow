import { describe, expect, it } from "vitest";
import { resolveCheckoutConsent } from "./checkout-consent";
import type { StorePageLink } from "@/core/api/types";

const TEXT = "By placing this order, you agree to our {terms} and {refund}.";

function page(overrides: Partial<StorePageLink> = {}): StorePageLink {
  return { id: "sp_1", kind: "terms", slug: "terms", title: "Terms and Conditions", position: 1, ...overrides };
}

describe("resolveCheckoutConsent", () => {
  it("splits the sentence into the three text fragments around the two link tokens", () => {
    const terms = page({ kind: "terms", slug: "terms", title: "Terms" });
    const refund = page({ id: "sp_2", kind: "refund", slug: "refund-policy", title: "Refund Policy" });
    const result = resolveCheckoutConsent(TEXT, [terms, refund]);

    expect(result).toEqual({
      beforeTerms: "By placing this order, you agree to our ",
      termsPage: terms,
      betweenLinks: " and ",
      refundPage: refund,
      afterRefund: ".",
    });
  });

  it("returns null when the terms page is missing", () => {
    const refund = page({ kind: "refund", slug: "refund-policy" });
    expect(resolveCheckoutConsent(TEXT, [refund])).toBeNull();
  });

  it("returns null when the refund page is missing", () => {
    const terms = page({ kind: "terms", slug: "terms" });
    expect(resolveCheckoutConsent(TEXT, [terms])).toBeNull();
  });

  it("returns null when neither page is configured (fresh, unseeded store)", () => {
    expect(resolveCheckoutConsent(TEXT, [])).toBeNull();
  });

  it("ignores unrelated pages (shipping, custom) when only those exist", () => {
    const shipping = page({ kind: "shipping", slug: "shipping-policy" });
    const custom = page({ kind: "custom", slug: "faq" });
    expect(resolveCheckoutConsent(TEXT, [shipping, custom])).toBeNull();
  });

  it("returns null (fails loud) when the content pack's sentence is missing the {terms} token", () => {
    const terms = page({ kind: "terms" });
    const refund = page({ id: "sp_2", kind: "refund", slug: "refund-policy" });
    expect(resolveCheckoutConsent("A sentence with no tokens.", [terms, refund])).toBeNull();
  });

  it("returns null when the sentence has {terms} but not {refund}", () => {
    const terms = page({ kind: "terms" });
    const refund = page({ id: "sp_2", kind: "refund", slug: "refund-policy" });
    expect(resolveCheckoutConsent("Agree to {terms} only.", [terms, refund])).toBeNull();
  });

  it("works with the real content pack sentence in all three languages", () => {
    const terms = page({ kind: "terms" });
    const refund = page({ id: "sp_2", kind: "refund", slug: "refund-policy" });
    const sentences = [
      "By placing this order, you agree to our {terms} and {refund}.",
      "بإتمامك لهذا الطلب، فإنك توافق على {terms} وعلى {refund}.",
      "En passant cette commande, vous acceptez nos {terms} et notre {refund}.",
    ];
    for (const sentence of sentences) {
      const result = resolveCheckoutConsent(sentence, [terms, refund]);
      expect(result, sentence).not.toBeNull();
      expect(result!.termsPage).toBe(terms);
      expect(result!.refundPage).toBe(refund);
    }
  });
});

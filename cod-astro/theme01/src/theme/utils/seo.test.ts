/**
 * SEO metadata tests — the rule that markup never reaches structured data.
 *
 * Slice 5 of the rich-text description plan. `getProductJsonLd` and any meta
 * description read `productMetaDescription`, which must:
 *   • prefer the platform's plain-text derivation (`descriptionPlain`),
 *   • fall back to the stored text for legacy `text` rows (plain by definition),
 *   • yield `undefined` — never markup — for an `html` row without plain text.
 *
 * The third case is the one that matters: a missing `descriptionPlain` must
 * never cause sanitised HTML to be embedded in JSON-LD.
 */
/// <reference types="vitest/globals" />

import { ProductSchema } from "@/core/api/validation";
import { productMetaDescription, getProductJsonLd } from "./seo";
import type { Product } from "@/core/api/types";

/** Built through the real schema, so the fixture cannot drift from the API contract. */
function product(overrides: Partial<Product> = {}): Product {
  return ProductSchema.parse({
    id: "prod_1",
    name: "Casque Bluetooth",
    description: "<p>Son <strong>excellent</strong></p>",
    descriptionFormat: "html",
    descriptionPlain: "Son excellent",
    handle: "casque-bluetooth",
    price: 4500,
    compareAtPrice: null,
    currency: "DZD",
    hasVariants: false,
    variantOptions: null,
    tags: [],
    status: "active",
    storeFeatured: false,
    inventory: 10,
    trackInventory: true,
    category: null,
    variants: [],
    images: [],
    coverImage: null,
    reviewStats: null,
    offers: [],
    ...overrides,
  });
}

describe("productMetaDescription", () => {
  it("prefers descriptionPlain for a rich description", () => {
    expect(productMetaDescription(product())).toBe("Son excellent");
  });

  it("never returns markup for a rich description", () => {
    const meta = productMetaDescription(product())!;
    expect(meta).not.toMatch(/[<>]/);
    expect(meta).not.toContain("strong");
  });

  it("returns undefined for an html row that has no plain text (never leaks markup)", () => {
    const p = product({ descriptionPlain: null });
    expect(productMetaDescription(p)).toBeUndefined();
    expect(JSON.stringify(getProductJsonLd(p, p.price))).not.toContain("<p>");
  });

  it("falls back to the stored text for a legacy text row", () => {
    const p = product({
      description: "Son excellent",
      descriptionFormat: undefined,
      descriptionPlain: undefined,
    });
    expect(productMetaDescription(p)).toBe("Son excellent");
  });

  it("accepts a legacy row whose description contains a literal '<' (not markup)", () => {
    // Regression guard: legacy prose like "Size < 10cm" is text, not HTML.
    const p = product({
      description: "Size < 10cm",
      descriptionFormat: undefined,
      descriptionPlain: undefined,
    });
    expect(productMetaDescription(p)).toBe("Size < 10cm");
    expect(productMetaDescription(p)).not.toContain("&lt;");
  });

  it("returns undefined when there is no description at all", () => {
    const p = product({ description: null, descriptionPlain: null, descriptionFormat: undefined });
    expect(productMetaDescription(p)).toBeUndefined();
  });

  it("treats an empty plain string as absent and falls back for text rows", () => {
    const p = product({ description: "Texte", descriptionFormat: "text", descriptionPlain: "" });
    expect(productMetaDescription(p)).toBe("Texte");
  });
});

describe("getProductJsonLd", () => {
  it("carries the plain description and no tags anywhere in the payload", () => {
    const p = product();
    const jsonLd = JSON.stringify(getProductJsonLd(p, p.price));
    expect(jsonLd).toContain("Son excellent");
    expect(jsonLd).not.toContain("<p>");
    expect(jsonLd).not.toContain("<strong>");
  });

  it("keeps the offer/availability contract intact", () => {
    const p = product({ trackInventory: true, inventory: 0 });
    const jsonLd = getProductJsonLd(p, p.price) as Record<string, any>;
    expect(jsonLd.name).toBe("Casque Bluetooth");
    expect(jsonLd.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(jsonLd.offers.priceCurrency).toBe("DZD");
  });

  it("omits description entirely (JSON.stringify drops undefined) when unavailable", () => {
    const p = product({ descriptionPlain: null });
    const jsonLd = JSON.stringify(getProductJsonLd(p, p.price));
    expect(jsonLd).not.toContain("\"description\"");
  });
});

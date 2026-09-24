/**
 * What gets suggested beside a product.
 *
 * This runs at the moment a shopper has decided "not this one", which on a COD
 * storefront reached from an ad is the difference between a second chance and
 * the back button. The rules are small; getting them wrong is visible.
 */
/// <reference types="vitest/globals" />

import {
  usableRelated,
  shouldShowRelated,
  MAX_RELATED,
  MIN_RELATED,
} from "./related-products";

const p = (id: string) => ({ id, name: `Product ${id}` });

describe("usableRelated", () => {
  it("never suggests the product being viewed", () => {
    // Suggesting the page you are already on is the one result nobody needs.
    const rows = usableRelated([p("a"), p("self"), p("b")], "self");

    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("caps a large category so it cannot become a wall of cards", () => {
    const many = Array.from({ length: 20 }, (_, i) => p(`p${i}`));

    expect(usableRelated(many, "self")).toHaveLength(MAX_RELATED);
  });

  it("respects an explicit cap", () => {
    const many = Array.from({ length: 20 }, (_, i) => p(`p${i}`));

    expect(usableRelated(many, "self", 3)).toHaveLength(3);
  });

  it("keeps the catalog's own order", () => {
    // The merchant's ordering is a merchandising decision; this does not
    // second-guess it by sorting.
    const rows = usableRelated([p("c"), p("a"), p("b")], "self");

    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("drops entries with no id rather than rendering a broken card", () => {
    const rows = usableRelated(
      [p("a"), { id: null }, { id: "" }, null as never, undefined as never, p("b")],
      "self",
    );

    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("survives a failed fetch", () => {
    // The API client returns [] on failure, but a storefront must not break if
    // it ever returns something else.
    expect(usableRelated(null, "self")).toEqual([]);
    expect(usableRelated(undefined, "self")).toEqual([]);
    expect(usableRelated([], "self")).toEqual([]);
  });

  it("returns nothing when the catalog holds only this product", () => {
    expect(usableRelated([p("self")], "self")).toEqual([]);
  });
});

describe("shouldShowRelated", () => {
  it("hides the section rather than heading a single card", () => {
    // "You may also like" over one card reads as an accident.
    expect(shouldShowRelated(0)).toBe(false);
    expect(shouldShowRelated(1)).toBe(false);
  });

  it("shows it once there is a real selection", () => {
    expect(shouldShowRelated(MIN_RELATED)).toBe(true);
    expect(shouldShowRelated(8)).toBe(true);
  });
});

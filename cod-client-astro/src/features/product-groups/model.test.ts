import { describe, expect, it } from "vitest";
import {
  filterGroups,
  formatGroupDate,
  groupCanDelete,
  paginateGroups,
  parseProductGroupRoute,
  productGroupErrorMessage,
  sortGroups,
  toSlug,
} from "./model";
import type { ProductCategory } from "./types";

const group = (overrides: Partial<ProductCategory> = {}): ProductCategory => ({
  id: "cat-1",
  name: "Electronics",
  slug: "electronics",
  description: null,
  parentId: null,
  imageUrl: null,
  metaTitle: null,
  metaDescription: null,
  metaKeywords: null,
  position: 0,
  productsCount: 3,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

const t = (key: string) => key;

describe("product-groups model", () => {
  it("filters groups by name and slug", () => {
    const rows = [group(), group({ id: "2", name: "Clothing", slug: "clothing" })];
    expect(filterGroups(rows, "electron").map((item) => item.id)).toEqual(["cat-1"]);
    expect(filterGroups(rows, "clothing").map((item) => item.id)).toEqual(["2"]);
    expect(filterGroups(rows, "").map((item) => item.id)).toEqual(["cat-1", "2"]);
  });

  it("sorts and paginates group collections", () => {
    const rows = [group({ id: "1", name: "Zed", productsCount: 5 }), group({ id: "2", name: "Amel", productsCount: 2 }), group({ id: "3", name: "Meriem", productsCount: 9 })];
    expect(sortGroups(rows, "name", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(sortGroups(rows, "productsCount", "desc").map((item) => item.id)).toEqual(["3", "1", "2"]);
    expect(paginateGroups(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("guards deletion until the group has no products", () => {
    expect(groupCanDelete(group({ productsCount: 0 }))).toBe(true);
    expect(groupCanDelete(group({ productsCount: 1 }))).toBe(false);
    expect(groupCanDelete(group({ productsCount: undefined }))).toBe(true);
  });

  it("parses only valid product-group routes", () => {
    expect(parseProductGroupRoute("/product-groups")).toEqual({ kind: "list" });
    expect(parseProductGroupRoute("/product-groups/new/")).toEqual({ kind: "new" });
    expect(parseProductGroupRoute("/product-groups/cat%2F1/edit")).toEqual({ kind: "edit", id: "cat/1" });
    expect(parseProductGroupRoute("/product-groups/cat-1")).toEqual({ kind: "unknown" });
    expect(parseProductGroupRoute("/product-groups/new/edit")).toEqual({ kind: "unknown" });
  });

  it("maps business error codes, slugs, and dates", () => {
    expect(productGroupErrorMessage({ code: "PRODUCT_GROUP_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(productGroupErrorMessage({ code: "PRODUCT_GROUP_HAS_PRODUCTS" }, t)).toBe("form.cannot_delete");
    expect(productGroupErrorMessage(new Error("boom"), t)).toBe("error_generic");
    expect(toSlug("Audio & Video!")).toBe("audio-video");
    expect(formatGroupDate("2026-08-26T00:00:00.000Z", "en")).toBe("August 26, 2026");
    expect(formatGroupDate("not-a-date", "en")).toBe("-");
  });
});

import { describe, expect, it } from "vitest";
import {
  apiVariantOptions,
  calcMargin,
  filterProducts,
  formatProductDate,
  generateCombinations,
  filterStockItems,
  formatStockDate,
  groupStockByProduct,
  movementIsStockIn,
  paginateProducts,
  parseProductRoute,
  parseProductStatus,
  productErrorMessage,
  sortProducts,
  sortStockGroups,
  sortStockItems,
  stockAlertTone,
  stockGroupInventory,
  stockGroupUpdatedAt,
  toSlug,
  variantLabel,
} from "./model";
import type { Product, StockAlertItem } from "./types";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "prod-1",
  name: "Cotton T-Shirt",
  description: "Soft cotton",
  handle: "cotton-t-shirt-prod1",
  currency: "DZD",
  price: 1500,
  compareAtPrice: null,
  costPrice: null,
  type: "PHYSICAL",
  hasVariants: false,
  variantOptions: null,
  sku: "TS-001",
  inventory: 10,
  lowStockThreshold: 5,
  trackInventory: true,
  categoryId: "cat-1",
  shippingProfileId: null,
  tags: [],
  visibility: true,
  status: "ACTIVE",
  showInStore: true,
  storeFeatured: false,
  deletedAt: null,
  publishedAt: null,
  category: null,
  variants: [],
  images: [],
  variantsCount: 0,
  totalInventory: 10,
  primaryImageSrc: null,
  reviewCount: 0,
  avgRating: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  ...overrides,
});

const alert = (overrides: Partial<StockAlertItem> = {}): StockAlertItem => ({
  productId: "prod-1",
  variantId: null,
  productName: "T-Shirt",
  variantLabel: null,
  sku: "TS-001",
  inventory: 0,
  lowStockThreshold: 5,
  isOutOfStock: true,
  updatedAt: "2026-01-10T00:00:00.000Z",
  ...overrides,
});

const t = (key: string) => key;

describe("products model", () => {
  it("filters by query, category, and status", () => {
    const rows = [product(), product({ id: "2", name: "Jeans", handle: "jeans-2", categoryId: "cat-2", status: "DRAFT" })];
    expect(filterProducts(rows, { query: "t-shirt", category: "all", status: "all" }).map((item) => item.id)).toEqual(["prod-1"]);
    expect(filterProducts(rows, { query: "", category: "cat-2", status: "all" }).map((item) => item.id)).toEqual(["2"]);
    expect(filterProducts(rows, { query: "", category: "all", status: "DRAFT" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("sorts and paginates product collections", () => {
    const rows = [product({ id: "1", name: "Zed", price: 500 }), product({ id: "2", name: "Amel", price: 3000 }), product({ id: "3", name: "Meriem", price: 1000 })];
    expect(sortProducts(rows, "name", "asc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(sortProducts(rows, "price", "desc").map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(paginateProducts(rows, 2, 2).map((item) => item.id)).toEqual(["3"]);
  });

  it("parses only valid product routes", () => {
    expect(parseProductRoute("/products")).toEqual({ kind: "list" });
    expect(parseProductRoute("/products/new/")).toEqual({ kind: "new" });
    expect(parseProductRoute("/products/stock")).toEqual({ kind: "stock" });
    expect(parseProductRoute("/products/prod%2F1")).toEqual({ kind: "detail", id: "prod/1" });
    expect(parseProductRoute("/products/prod-1/edit")).toEqual({ kind: "edit", id: "prod-1" });
    expect(parseProductRoute("/products/new/edit")).toEqual({ kind: "unknown" });
    expect(parseProductRoute("/products/stock/edit")).toEqual({ kind: "unknown" });
  });

  it("generates variant combinations from options", () => {
    expect(generateCombinations([])).toEqual([]);
    const combos = generateCombinations([
      { id: "o1", name: "Color", values: [{ id: "v1", value: "Red", hexColor: "" }, { id: "v2", value: "Blue", hexColor: "" }] },
      { id: "o2", name: "Size", values: [{ id: "v3", value: "M", hexColor: "" }] },
    ]);
    expect(combos).toHaveLength(2);
    expect(combos[0].variations).toEqual({ Color: "Red", Size: "M" });
    expect(variantLabel(combos[0].variations)).toBe("Red / M");
  });

  it("maps business error codes, slugs, and margin", () => {
    expect(productErrorMessage({ code: "PRODUCT_NOT_FOUND" }, t)).toBe("error_not_found");
    expect(productErrorMessage({ code: "PRODUCT_HAS_ORDERS" }, t)).toBe("error_delete_has_orders");
    expect(productErrorMessage({ code: "DUPLICATE_SKU" }, t)).toBe("error_duplicate_sku");
    expect(productErrorMessage(new Error("boom"), t)).toBe("error_generic");
    expect(toSlug("Cotton T-Shirt!")).toBe("cotton-t-shirt");
    expect(calcMargin("2000", "1200")).toBe(40);
    expect(calcMargin("1000", "2000")).toBeNull();
  });

  it("groups stock alerts by product and computes tones", () => {
    const groups = groupStockByProduct([alert(), alert({ variantId: "var-1", productName: "T-Shirt" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
    expect(stockAlertTone(alert())).toBe("out");
    expect(stockAlertTone(alert({ isOutOfStock: false, inventory: 3, lowStockThreshold: 5 }))).toBe("low");
    expect(stockAlertTone(alert({ isOutOfStock: false, inventory: 9, lowStockThreshold: 5 }))).toBe("ok");
    expect(movementIsStockIn("PURCHASE")).toBe(true);
    expect(movementIsStockIn("ORDER_DEDUCTED")).toBe(false);
    expect(parseProductStatus("DRAFT")).toBe("DRAFT");
    expect(parseProductStatus("bogus")).toBeUndefined();
    expect(apiVariantOptions([{ id: "o1", name: "Color", values: [{ id: "v1", value: "Red", hexColor: "#ff0000" }] }])).toEqual([{ name: "Color", values: [{ value: "Red", hexColor: "#ff0000" }] }]);
    expect(formatProductDate("2026-08-26T00:00:00.000Z", "en")).toBe("August 26, 2026");
    expect(formatProductDate("not-a-date", "en")).toBe("-");
  });

  it("searches stock rows by product name, variant label and sku", () => {
    const rows = [
      alert({ productId: "p-1", productName: "Cotton T-Shirt", sku: "TS-001" }),
      alert({ productId: "p-2", productName: "Hoodie", variantId: "v-1", variantLabel: "Red / M", sku: "HD-RED-M" }),
      alert({ productId: "p-3", productName: "Cap", sku: null }),
    ];
    expect(filterStockItems(rows, "").length).toBe(3);
    expect(filterStockItems(rows, "   ").length).toBe(3);
    expect(filterStockItems(rows, "hoodie").map((item) => item.productId)).toEqual(["p-2"]);
    expect(filterStockItems(rows, "red / m").map((item) => item.productId)).toEqual(["p-2"]);
    expect(filterStockItems(rows, "ts-001").map((item) => item.productId)).toEqual(["p-1"]);
    expect(filterStockItems(rows, "TS-001").map((item) => item.productId)).toEqual(["p-1"]);
    expect(filterStockItems(rows, "cap").map((item) => item.productId)).toEqual(["p-3"]);
    expect(filterStockItems(rows, "nothing")).toEqual([]);
  });

  it("sorts stock rows by quantity, name and last update in both directions", () => {
    const rows = [
      alert({ productId: "b", productName: "Banana", inventory: 7, updatedAt: "2026-02-01T00:00:00.000Z" }),
      alert({ productId: "a", productName: "Apple", inventory: 2, updatedAt: "2026-03-01T00:00:00.000Z" }),
      alert({ productId: "c", productName: "Cherry", inventory: 40, updatedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(sortStockItems(rows, "inventory", "asc").map((item) => item.inventory)).toEqual([2, 7, 40]);
    expect(sortStockItems(rows, "inventory", "desc").map((item) => item.inventory)).toEqual([40, 7, 2]);
    expect(sortStockItems(rows, "name", "asc").map((item) => item.productId)).toEqual(["a", "b", "c"]);
    expect(sortStockItems(rows, "updatedAt", "desc").map((item) => item.productId)).toEqual(["a", "b", "c"]);
    expect(rows.map((item) => item.productId)).toEqual(["b", "a", "c"]);
  });

  it("sorts stock groups on their aggregate and orders the variants inside each one", () => {
    const groups = groupStockByProduct([
      alert({ productId: "p-1", productName: "Hoodie", variantId: "v-1", variantLabel: "M", inventory: 9, updatedAt: "2026-01-05T00:00:00.000Z" }),
      alert({ productId: "p-1", productName: "Hoodie", variantId: "v-2", variantLabel: "L", inventory: 1, updatedAt: "2026-04-05T00:00:00.000Z" }),
      alert({ productId: "p-2", productName: "Cap", inventory: 4, updatedAt: "2026-02-05T00:00:00.000Z" }),
    ]);
    expect(stockGroupInventory(groups[0])).toBe(10);
    expect(stockGroupUpdatedAt(groups[0])).toBe("2026-04-05T00:00:00.000Z");

    const byQuantity = sortStockGroups(groups, "inventory", "asc");
    expect(byQuantity.map((group) => group.productId)).toEqual(["p-2", "p-1"]);
    expect(byQuantity[1].items.map((item) => item.inventory)).toEqual([1, 9]);

    expect(sortStockGroups(groups, "inventory", "desc").map((group) => group.productId)).toEqual(["p-1", "p-2"]);
    expect(sortStockGroups(groups, "name", "asc").map((group) => group.productId)).toEqual(["p-2", "p-1"]);
    expect(sortStockGroups(groups, "updatedAt", "desc").map((group) => group.productId)).toEqual(["p-1", "p-2"]);
    expect(groups[0].items.map((item) => item.variantId)).toEqual(["v-1", "v-2"]);
  });

  it("formats a stock row date and rejects unusable values", () => {
    expect(formatStockDate("2026-08-26T00:00:00.000Z", "en")).toBe("Aug 26, 2026");
    expect(formatStockDate("", "en")).toBeNull();
    expect(formatStockDate("not-a-date", "en")).toBeNull();
  });
});

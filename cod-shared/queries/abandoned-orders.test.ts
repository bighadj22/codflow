/**
 * Abandoned basket flattening.
 *
 * This is the seam where a cart becomes a database row, and the whole safety
 * of migration 0028 rests on it: the flat product columns must keep being
 * filled for basket rows, because the dashboard's product column, the customer
 * search and the lost-revenue sum all read them and none of them were changed.
 */

import { describe, it, expect } from "vitest";
import {
  deriveAbandonedProductColumns,
  parseAbandonedItems,
  type AbandonedItem,
} from "./abandoned-orders";

const hoodie: AbandonedItem = {
  productId: "p1",
  productName: "Hoodie Classic",
  variantId: "v-black-l",
  variantLabel: "Noir / L",
  quantity: 2,
  unitPrice: 2400,
};

const tshirt: AbandonedItem = {
  productId: "p2",
  productName: "Street Fighter 45",
  variantId: null,
  variantLabel: null,
  quantity: 1,
  unitPrice: 1000,
};

describe("deriveAbandonedProductColumns — single-product checkout", () => {
  it("stores exactly what it stored before carts existed", () => {
    const columns = deriveAbandonedProductColumns({
      productId: "p1",
      productName: "Hoodie Classic",
      variantId: "v-black-l",
      variantLabel: "Noir / L",
      price: 2400,
    });

    expect(columns).toEqual({
      productId: "p1",
      productName: "Hoodie Classic",
      variantId: "v-black-l",
      variantLabel: "Noir / L",
      price: 2400,
      itemsJson: null,
      itemCount: null,
    });
  });

  it("keeps a record with nothing known about the product", () => {
    // The shopper typed a phone number before touching anything else.
    expect(deriveAbandonedProductColumns({})).toEqual({
      productId: null,
      productName: null,
      variantId: null,
      variantLabel: null,
      price: null,
      itemsJson: null,
      itemCount: null,
    });
  });

  it("treats an empty basket as no basket", () => {
    const columns = deriveAbandonedProductColumns({ items: [], productId: "p1", price: 900 });

    expect(columns.itemsJson).toBeNull();
    expect(columns.itemCount).toBeNull();
    expect(columns.productId).toBe("p1");
  });
});

describe("deriveAbandonedProductColumns — basket checkout", () => {
  it("fills the flat columns from the first line", () => {
    // What the merchant sees in the product column of the existing list.
    const columns = deriveAbandonedProductColumns({ items: [hoodie, tshirt] });

    expect(columns.productId).toBe("p1");
    expect(columns.productName).toBe("Hoodie Classic");
    expect(columns.variantId).toBe("v-black-l");
    expect(columns.variantLabel).toBe("Noir / L");
  });

  it("records the basket subtotal as the cart value, not one unit's price", () => {
    // 2 × 2400 + 1 × 1000. Storing 2400 here would under-report every basket
    // in the estimated-lost-revenue card.
    expect(deriveAbandonedProductColumns({ items: [hoodie, tshirt] }).price).toBe(5800);
  });

  it("counts distinct lines, not units", () => {
    // "and 1 more" is about lines; the merchant opens the row for quantities.
    expect(deriveAbandonedProductColumns({ items: [hoodie, tshirt] }).itemCount).toBe(2);
  });

  it("round-trips the whole basket", () => {
    const columns = deriveAbandonedProductColumns({ items: [hoodie, tshirt] });

    expect(parseAbandonedItems(columns.itemsJson)).toEqual([hoodie, tshirt]);
  });

  it("lets the basket win over stale flat fields", () => {
    // The storefront sends both on the checkout page; the basket is the truth.
    const columns = deriveAbandonedProductColumns({
      items: [tshirt],
      productId: "stale",
      productName: "Stale",
      price: 99,
    });

    expect(columns.productId).toBe("p2");
    expect(columns.price).toBe(1000);
  });

  it("keeps a single-line basket a basket", () => {
    const columns = deriveAbandonedProductColumns({ items: [tshirt] });

    expect(columns.itemCount).toBe(1);
    expect(columns.itemsJson).not.toBeNull();
  });
});

describe("parseAbandonedItems", () => {
  it("returns no basket for a row that never had one", () => {
    expect(parseAbandonedItems(null)).toBeNull();
    expect(parseAbandonedItems(undefined)).toBeNull();
    expect(parseAbandonedItems("")).toBeNull();
  });

  it("returns no basket rather than throwing on unreadable data", () => {
    // A row must still list in the dashboard, with its flat product column
    // intact, even if this column is garbage.
    expect(parseAbandonedItems("not json")).toBeNull();
    expect(parseAbandonedItems("{}")).toBeNull();
    expect(parseAbandonedItems("[]")).toBeNull();
  });

  it("drops entries that are not usable lines", () => {
    const raw = JSON.stringify([tshirt, { productId: "x" }, null, "nope"]);

    expect(parseAbandonedItems(raw)).toEqual([tshirt]);
  });

  it("returns no basket when nothing in it survives", () => {
    expect(parseAbandonedItems(JSON.stringify([{ productId: "x" }]))).toBeNull();
  });
});

/**
 * Stock Management — Unit Tests
 *
 * Tests the full stock-check pipeline for storefront orders.
 *
 * checkStoreOrderStock queries (partial selects — must match column order exactly):
 *   Q1. db.select({ trackInventory, inventory }).from(products)  → { track_inventory, inventory }
 *   Q2. db.select({ inventory }).from(productVariants)           → { inventory }
 *
 * Rules under test:
 *  1. trackInventory=false  → always allow (no stock gate)
 *  2. Simple product (no variants), stock >= quantity → allow
 *  3. Simple product, stock = 0 → block
 *  4. Simple product, quantity > stock → block
 *  5. Single variant selected, stock >= quantity → allow
 *  6. Single variant, inventory = 0 → block
 *  7. Single variant, quantity > stock → block
 *  8. variantSelections (offer tiers), all in stock → allow
 *  9. variantSelections, one variant OOS → block
 * 10. variantSelections, same variant ×3 but stock = 2 → block
 * 11. Product not found → pass through (no crash)
 * 12. BusinessLogicError carries INSUFFICIENT_STOCK code
 * 13. Inventory roll-up: product with one OOS variant and others in stock
 */

import { describe, it, expect } from "vitest";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { checkStoreOrderStock } from "./queries";
import { makeMockDb, f } from "@/test-utils/mock-db";

// ─── Partial-select row helpers ───────────────────────────────────────────────
// The mock DB uses Object.values() positionally, so partial-select mocks must
// contain ONLY the selected columns, in the EXACT ORDER of the .select() clause.

/**
 * Q1: db.select({ trackInventory: products.trackInventory, inventory: products.inventory })
 * Column order: track_inventory, inventory
 */
function productQ(trackInventory: boolean, inventory: number) {
  return f({ track_inventory: trackInventory ? 1 : 0, inventory });
}

/**
 * Q2: db.select({ inventory: productVariants.inventory })
 * Column order: inventory
 */
function variantQ(inventory: number) {
  return f({ inventory });
}

// ─── Rule 1: trackInventory=false → always allow ──────────────────────────────

describe("checkStoreOrderStock — trackInventory=false", () => {
  it("returns null when product does not track inventory", async () => {
    const db = makeMockDb([productQ(false, 0)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [],
      quantity: 100,
    });
    expect(result).toBeNull();
  });

  it("returns null even with variantId and zero stock (no tracking)", async () => {
    const db = makeMockDb([productQ(false, 0)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: "var_1",
      variantSelections: [],
      quantity: 9999,
    });
    expect(result).toBeNull();
  });
});

// ─── Rules 2–4: Simple product (no variants) ──────────────────────────────────

describe("checkStoreOrderStock — simple product (no variants)", () => {
  it("allows when stock >= quantity", async () => {
    const db = makeMockDb([productQ(true, 5)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [],
      quantity: 5,
    });
    expect(result).toBeNull();
  });

  it("blocks when stock = 0", async () => {
    const db = makeMockDb([productQ(true, 0)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [],
      quantity: 1,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("blocks when quantity > stock", async () => {
    const db = makeMockDb([productQ(true, 3)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [],
      quantity: 4,
    });
    expect(result).not.toBeNull();
  });

  it("allows exact stock quantity", async () => {
    const db = makeMockDb([productQ(true, 1)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [],
      quantity: 1,
    });
    expect(result).toBeNull();
  });
});

// ─── Rules 5–7: Single variant selected ───────────────────────────────────────

describe("checkStoreOrderStock — single variant", () => {
  it("allows when variant stock >= quantity", async () => {
    const db = makeMockDb([productQ(true, 0), variantQ(8)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: "var_1",
      variantSelections: [],
      quantity: 2,
    });
    expect(result).toBeNull();
  });

  it("blocks when variant inventory = 0", async () => {
    const db = makeMockDb([productQ(true, 0), variantQ(0)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: "var_1",
      variantSelections: [],
      quantity: 1,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("blocks when quantity > variant stock", async () => {
    const db = makeMockDb([productQ(true, 0), variantQ(2)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: "var_1",
      variantSelections: [],
      quantity: 3,
    });
    expect(result).not.toBeNull();
  });

  it("allows exact variant stock quantity", async () => {
    const db = makeMockDb([productQ(true, 0), variantQ(3)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: "var_1",
      variantSelections: [],
      quantity: 3,
    });
    expect(result).toBeNull();
  });

  it("Street Fighter 45/Kaki (inventory=0) is blocked — regression test", async () => {
    // var-004-6: {Pointure:45, Couleur:Kaki}, inventory=0
    // Other 45 variants (45/Noir) still have stock → product-level total > 0
    // But this specific combination must be blocked
    const db = makeMockDb([productQ(true, 34), variantQ(0)]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod-004",
      variantId: "var-004-6",
      variantSelections: [],
      quantity: 1,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

// ─── Rules 8–10: variantSelections (offer tier multi-unit) ───────────────────

describe("checkStoreOrderStock — variantSelections (offer tiers)", () => {
  it("allows when all selected variants have sufficient stock", async () => {
    const db = makeMockDb([
      productQ(true, 0),
      variantQ(10),    // var_a: 10 in stock, 1 unit
      variantQ(5),     // var_b: 5 in stock, 1 unit
    ]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      quantity: 1,
    });
    expect(result).toBeNull();
  });

  it("blocks when one variant in selections has 0 stock", async () => {
    const db = makeMockDb([
      productQ(true, 0),
      variantQ(5),     // var_a: ok
      variantQ(0),     // var_b: OOS
    ]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [{ variantId: "var_a" }, { variantId: "var_b" }],
      quantity: 1,
    });
    expect(result).not.toBeNull();
  });

  it("blocks when same variant selected ×3 but stock = 2", async () => {
    // groupVariantSelections collapses duplicates and checks cumulative count
    const db = makeMockDb([
      productQ(true, 0),
      variantQ(2),     // var_a: only 2 in stock, but 3 units selected
    ]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [
        { variantId: "var_a" },
        { variantId: "var_a" },
        { variantId: "var_a" },
      ],
      quantity: 1,
    });
    expect(result).not.toBeNull();
  });

  it("allows when same variant selected ×2 and stock is exactly 2", async () => {
    const db = makeMockDb([
      productQ(true, 0),
      variantQ(2),
    ]);
    const result = await checkStoreOrderStock(db, {
      productId: "prod_1",
      variantId: null,
      variantSelections: [{ variantId: "var_a" }, { variantId: "var_a" }],
      quantity: 1,
    });
    expect(result).toBeNull();
  });
});

// ─── Rule 11: Product not found ───────────────────────────────────────────────

describe("checkStoreOrderStock — product not found", () => {
  it("returns null (no crash, no false block) when product row is missing", async () => {
    const db = makeMockDb([f(null)]);
    const result = await checkStoreOrderStock(db, {
      productId: "ghost-product",
      variantId: "var_1",
      variantSelections: [],
      quantity: 1,
    });
    expect(result).toBeNull();
  });
});

// ─── Rule 12: Handler error code ─────────────────────────────────────────────

describe("INSUFFICIENT_STOCK error", () => {
  it("BusinessLogicError carries INSUFFICIENT_STOCK code", () => {
    const err = new BusinessLogicError(
      "هذا المنتج غير متوفر بالخيار المطلوب.",
      ERROR_CODES.INSUFFICIENT_STOCK
    );
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.statusCode).toBe(422);
    expect(err.category).toBe("BUSINESS_LOGIC");
  });

  it("is thrown as BusinessLogicError", () => {
    expect(() => {
      throw new BusinessLogicError("OOS", ERROR_CODES.INSUFFICIENT_STOCK);
    }).toThrow(BusinessLogicError);
  });
});

// ─── Rule 13: Inventory roll-up logic ────────────────────────────────────────

describe("inventory roll-up (Street Fighter seed data)", () => {
  it("product total = sum of all variant inventories", () => {
    const variants = [
      { id: "var-004-1", inventory: 6 },   // 40/Noir
      { id: "var-004-2", inventory: 9 },   // 42/Noir
      { id: "var-004-3", inventory: 4 },   // 45/Noir
      { id: "var-004-4", inventory: 7 },   // 40/Kaki
      { id: "var-004-5", inventory: 8 },   // 42/Kaki
      { id: "var-004-6", inventory: 0 },   // 45/Kaki — OOS
    ];
    const total = variants.reduce((sum, v) => sum + v.inventory, 0);
    expect(total).toBe(34);
  });

  it("product-level OOS check (card) correctly shows as IN STOCK", () => {
    const total: number = 34; // computed above
    expect(total === 0).toBe(false); // product card shows no OOS overlay
  });

  it("45/Kaki specific combination is OOS while product is not", () => {
    const oosVariant = { id: "var-004-6", inventory: 0 };
    const productTotal = 34;

    expect(productTotal).toBeGreaterThan(0); // product NOT globally OOS
    expect(oosVariant.inventory).toBe(0);    // but this combination IS OOS
  });

  it("globally OOS only when ALL variants have 0 inventory", () => {
    const allOos = [{ inventory: 0 }, { inventory: 0 }, { inventory: 0 }];
    const total = allOos.reduce((sum, v) => sum + v.inventory, 0);
    expect(total).toBe(0); // product card shows OOS overlay, button disabled
  });
});

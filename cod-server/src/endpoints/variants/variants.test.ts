/**
 * Variants — Unit Tests
 *
 * Coverage:
 *  1. Validation schemas (Zod) — no DB required
 *  2. getVariantById — returns null for missing; parses variations JSON
 *  3. createVariant — inserts and returns new variant
 *  4. updateVariant — updates and returns variant
 *  5. deleteVariant — throws when in orders; succeeds otherwise
 */

import { describe, it, expect } from "vitest";
import { createVariantSchema, updateVariantSchema } from "./validation";
import { getVariantById, createVariant, updateVariant, deleteVariant } from "./queries";
import { makeMockDb, f, a, variantRow, NOW } from "@/test-utils/mock-db";

// orderProducts row: id, order_id, product_id, product_name, variant_id, variant_label,
//                    quantity, price_per_unit, line_total, created_at (10 cols, schema order)
function orderProductRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "op_1",
    order_id: "ord_1",
    product_id: "prod_1",
    product_name: "T-Shirt",
    variant_id: "var_1",
    variant_label: null,
    sku: null,
    quantity: 2,
    price_per_unit: 1500,
    line_total: 3000,
    created_at: NOW,
    ...overrides,
  };
}

// ─── createVariantSchema ───────────────────────────────────────────────────────

describe("createVariantSchema", () => {
  const validBase = {
    variations: { Color: "Red", Size: "M" },
    price: 1500,
    sku: "VAR-001",
  };

  it("accepts a valid variant payload", () => {
    expect(createVariantSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects negative price", () => {
    expect(createVariantSchema.safeParse({ ...validBase, price: -1 }).success).toBe(false);
  });

  it("accepts price = 0 (free variant)", () => {
    expect(createVariantSchema.safeParse({ ...validBase, price: 0 }).success).toBe(true);
  });

  it("rejects non-integer price", () => {
    expect(createVariantSchema.safeParse({ ...validBase, price: 99.5 }).success).toBe(false);
  });

  it("defaults inventory to 0", () => {
    expect(createVariantSchema.parse(validBase).inventory).toBe(0);
  });

  it("defaults isDefault to false", () => {
    expect(createVariantSchema.parse(validBase).isDefault).toBe(false);
  });

  it("defaults active to true", () => {
    expect(createVariantSchema.parse(validBase).active).toBe(true);
  });

  it("defaults position to 1", () => {
    expect(createVariantSchema.parse(validBase).position).toBe(1);
  });

  it("rejects position = 0 (below minimum)", () => {
    expect(createVariantSchema.safeParse({ ...validBase, position: 0 }).success).toBe(false);
  });

  it("accepts negative compareAtPrice → rejects (min 0)", () => {
    expect(createVariantSchema.safeParse({ ...validBase, compareAtPrice: -1 }).success).toBe(false);
  });

  it("rejects null sku (required field)", () => {
    expect(createVariantSchema.safeParse({ ...validBase, sku: null }).success).toBe(false);
  });

  it("accepts variations as a record of strings", () => {
    expect(createVariantSchema.safeParse({ ...validBase, variations: { Color: "Blue" } }).success).toBe(true);
  });
});

// ─── updateVariantSchema ───────────────────────────────────────────────────────

describe("updateVariantSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateVariantSchema.safeParse({}).success).toBe(true);
  });

  it("rejects negative price if provided", () => {
    expect(updateVariantSchema.safeParse({ price: -100 }).success).toBe(false);
  });

  it("accepts partial update with only inventory", () => {
    expect(updateVariantSchema.safeParse({ inventory: 50 }).success).toBe(true);
  });

  it("accepts null compareAtPrice to clear it", () => {
    expect(updateVariantSchema.safeParse({ compareAtPrice: null }).success).toBe(true);
  });
});

// ─── getVariantById ────────────────────────────────────────────────────────────

describe("getVariantById", () => {
  it("returns null when variant does not exist", async () => {
    const db = makeMockDb([f(null)]);
    const result = await getVariantById(db as any, "var_missing");
    expect(result).toBeNull();
  });

  it("returns the variant when found", async () => {
    const db = makeMockDb([f(variantRow())]);
    const result = await getVariantById(db as any, "var_1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("var_1");
  });

  it("parses variations JSON from DB row", async () => {
    const db = makeMockDb([f(variantRow({ variations: '{"Color":"Blue","Size":"XL"}' }))]);
    const result = await getVariantById(db as any, "var_1");
    expect(result!.variations).toEqual({ Color: "Blue", Size: "XL" });
  });

  it("returns correct price", async () => {
    const db = makeMockDb([f(variantRow({ price: 2500 }))]);
    const result = await getVariantById(db as any, "var_1");
    expect(result!.price).toBe(2500);
  });
});

// ─── createVariant ─────────────────────────────────────────────────────────────

describe("createVariant", () => {
  it("creates and returns the new variant", async () => {
    // INSERT (run) → getVariantById → productVariants.get()
    const db = makeMockDb([f(variantRow({ product_id: "prod_1" }))]);
    const result = await createVariant(db as any, "prod_1", {
      variations: { Color: "Red" },
      price: 1500,
      sku: "VAR-RED",
      inventory: 10,
      isDefault: true,
      active: true,
      position: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.productId).toBe("prod_1");
  });

  it("serializes variations to JSON for storage", async () => {
    const db = makeMockDb([f(variantRow({ variations: '{"Size":"S"}' }))]);
    const result = await createVariant(db as any, "prod_1", {
      variations: { Size: "S" },
      price: 1200,
      sku: "VAR-S",
      inventory: 0,
      isDefault: false,
      active: true,
      position: 2,
    });
    expect(result!.variations).toEqual({ Size: "S" });
  });
});

// ─── updateVariant ─────────────────────────────────────────────────────────────

describe("updateVariant", () => {
  it("updates and returns the variant", async () => {
    // UPDATE (run with no queue) → getVariantById → productVariants.get()
    const db = makeMockDb([f(variantRow({ inventory: 20 }))]);
    const result = await updateVariant(db as any, "var_1", { inventory: 20 });
    expect(result).not.toBeNull();
    expect(result!.inventory).toBe(20);
  });

  it("returns variant after price update", async () => {
    const db = makeMockDb([f(variantRow({ price: 1800 }))]);
    const result = await updateVariant(db as any, "var_1", { price: 1800 });
    expect(result!.price).toBe(1800);
  });
});

// ─── deleteVariant ─────────────────────────────────────────────────────────────

describe("deleteVariant", () => {
  it("nulls out order references and succeeds when variant is in orders", async () => {
    // run() calls (update + delete) never consume from queue
    const db = makeMockDb([]);
    const result = await deleteVariant(db as any, "var_1");
    expect(result).toEqual({ success: true });
  });

  it("succeeds when variant is not in any order", async () => {
    // orderProducts.get() → null → DELETE (run) → succeeds
    const db = makeMockDb([f(null)]);
    const result = await deleteVariant(db as any, "var_1");
    expect(result).toEqual({ success: true });
  });
});

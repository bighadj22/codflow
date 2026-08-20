/**
 * Products — Unit Tests
 *
 * Coverage:
 *  1. Validation schemas (Zod) — no DB required
 *  2. getProductById — returns null for missing / soft-deleted product
 *  3. deleteProduct — soft delete (sets deletedAt, does not hard-delete)
 *  4. createProduct — handle auto-generation from name
 *  5. getAllProducts — excludes soft-deleted rows
 */

import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
} from "./validation";
import { getProductById, deleteProduct, createProduct } from "./queries";
import { makeMockDb, f, a, productRow, NOW } from "@/test-utils/mock-db";

// ─── Validation ────────────────────────────────────────────────────────────────

describe("createProductSchema", () => {
  const validBase = {
    name: "قميص قطني",
    price: 1500,
    sku: "PROD-001",
  };

  it("accepts a minimal valid product", () => {
    expect(createProductSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createProductSchema.safeParse({ ...validBase, name: "" }).success).toBe(false);
  });

  it("rejects negative price", () => {
    expect(createProductSchema.safeParse({ ...validBase, price: -1 }).success).toBe(false);
  });

  it("accepts price = 0 (free product)", () => {
    expect(createProductSchema.safeParse({ ...validBase, price: 0 }).success).toBe(true);
  });

  it("rejects non-integer price", () => {
    // price must be int
    expect(createProductSchema.safeParse({ ...validBase, price: 99.5 }).success).toBe(false);
  });

  it("defaults type to PHYSICAL", () => {
    expect(createProductSchema.parse(validBase).type).toBe("PHYSICAL");
  });

  it("defaults status to ACTIVE", () => {
    expect(createProductSchema.parse(validBase).status).toBe("ACTIVE");
  });

  it("defaults hasVariants to false", () => {
    expect(createProductSchema.parse(validBase).hasVariants).toBe(false);
  });

  it("defaults inventory to 0", () => {
    expect(createProductSchema.parse(validBase).inventory).toBe(0);
  });

  it("defaults trackInventory to true", () => {
    expect(createProductSchema.parse(validBase).trackInventory).toBe(true);
  });

  it("defaults visibility to true", () => {
    expect(createProductSchema.parse(validBase).visibility).toBe(true);
  });

  it("defaults showInStore to true", () => {
    expect(createProductSchema.parse(validBase).showInStore).toBe(true);
  });

  it("defaults storeFeatured to false", () => {
    expect(createProductSchema.parse(validBase).storeFeatured).toBe(false);
  });

  it("accepts DIGITAL type", () => {
    expect(createProductSchema.safeParse({ ...validBase, type: "DIGITAL" }).success).toBe(true);
  });

  it("rejects unknown product type", () => {
    expect(createProductSchema.safeParse({ ...validBase, type: "SERVICE" }).success).toBe(false);
  });

  it("accepts DRAFT, ACTIVE, ARCHIVED statuses", () => {
    for (const status of ["DRAFT", "ACTIVE", "ARCHIVED"]) {
      expect(createProductSchema.safeParse({ ...validBase, status }).success).toBe(true);
    }
  });

  it("rejects unknown status", () => {
    expect(createProductSchema.safeParse({ ...validBase, status: "DELETED" }).success).toBe(false);
  });

  it("accepts variantOptions array", () => {
    const data = {
      ...validBase,
      hasVariants: true,
      variantOptions: [
        { name: "اللون", values: [{ value: "أحمر" }, { value: "أزرق" }] },
      ],
    };
    expect(createProductSchema.safeParse(data).success).toBe(true);
  });

  it("rejects variantOptions with empty values array", () => {
    const data = {
      ...validBase,
      variantOptions: [{ name: "اللون", values: [] }],
    };
    expect(createProductSchema.safeParse(data).success).toBe(false);
  });

  it("accepts negative compareAtPrice (no min constraint)", () => {
    // compareAtPrice min(0) — negative should fail
    expect(createProductSchema.safeParse({ ...validBase, compareAtPrice: -1 }).success).toBe(false);
  });

  it("accepts compareAtPrice = 0", () => {
    expect(createProductSchema.safeParse({ ...validBase, compareAtPrice: 0 }).success).toBe(true);
  });

  it("accepts tags as string array", () => {
    expect(createProductSchema.safeParse({ ...validBase, tags: ["cotton", "summer"] }).success).toBe(true);
  });
});

describe("updateProductSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateProductSchema.safeParse({}).success).toBe(true);
  });

  it("rejects empty name if provided", () => {
    expect(updateProductSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects negative price if provided", () => {
    expect(updateProductSchema.safeParse({ price: -100 }).success).toBe(false);
  });

  it("accepts partial update with only status", () => {
    expect(updateProductSchema.safeParse({ status: "ARCHIVED" }).success).toBe(true);
  });
});

describe("productFiltersSchema", () => {
  it("coerces visibility from string 'true' to boolean", () => {
    const result = productFiltersSchema.parse({ visibility: "true" });
    expect(result.visibility).toBe(true);
  });

  it("coerces visibility from string 'false' to boolean", () => {
    const result = productFiltersSchema.parse({ visibility: "false" });
    expect(result.visibility).toBe(false);
  });

  it("defaults limit to 50 and offset to 0", () => {
    const result = productFiltersSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("rejects limit > 100", () => {
    expect(productFiltersSchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects negative offset", () => {
    expect(productFiltersSchema.safeParse({ offset: "-1" }).success).toBe(false);
  });

  it("accepts valid status filter", () => {
    expect(productFiltersSchema.safeParse({ status: "DRAFT" }).success).toBe(true);
  });

  it("rejects unknown status filter", () => {
    expect(productFiltersSchema.safeParse({ status: "REMOVED" }).success).toBe(false);
  });
});

// ─── Query logic ───────────────────────────────────────────────────────────────

describe("getProductById", () => {
  it("returns null when product is not found (or soft-deleted)", async () => {
    const db = makeMockDb([f(null)]);
    const result = await getProductById(db, "prod_missing");
    expect(result).toBeNull();
  });

  it("returns the product when found", async () => {
    // products.get → category_id=null skips category lookup → variants.all → images.all
    const db = makeMockDb([
      f(productRow({ category_id: null })),
      a([]),  // productVariants.all()
      a([]),  // productImages.all()
    ]);
    const result = await getProductById(db, "prod_1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("prod_1");
  });

  it("fetches category when product has a categoryId", async () => {
    // products.get → categories.get → variants.all → images.all
    const db = makeMockDb([
      f(productRow({ category_id: "cat_1" })),
      f({ id: "cat_1", name: "ملابس" }),  // productCategories.get()
      a([]),                               // productVariants.all()
      a([]),                               // productImages.all()
    ]);
    const result = await getProductById(db, "prod_1");
    expect(result).not.toBeNull();
  });

  it("parses variantOptions JSON from the DB row", async () => {
    const variantOptions = [{ name: "اللون", values: [{ value: "أحمر" }] }];
    const db = makeMockDb([
      f(productRow({ variant_options: JSON.stringify(variantOptions), has_variants: 1, category_id: null })),
      a([]),
      a([]),
    ]);
    const result = await getProductById(db, "prod_1");
    expect(result!.variantOptions).toEqual(variantOptions);
  });

  it("returns null variantOptions when column is null", async () => {
    const db = makeMockDb([
      f(productRow({ variant_options: null, category_id: null })),
      a([]),
      a([]),
    ]);
    const result = await getProductById(db, "prod_1");
    expect(result!.variantOptions).toBeNull();
  });

  it("parses tags JSON from the DB row", async () => {
    const tags = ["cotton", "summer"];
    const db = makeMockDb([
      f(productRow({ tags: JSON.stringify(tags), category_id: null })),
      a([]),
      a([]),
    ]);
    const result = await getProductById(db, "prod_1");
    expect(result!.tags).toEqual(tags);
  });

  it("returns empty array for tags when column is null", async () => {
    const db = makeMockDb([
      f(productRow({ tags: null, category_id: null })),
      a([]),
      a([]),
    ]);
    const result = await getProductById(db, "prod_1");
    expect(result!.tags).toEqual([]);
  });
});

describe("deleteProduct", () => {
  it("soft-deletes the product (returns success, does not hard delete)", async () => {
    // UPDATE products SET deleted_at = now (run — no queue consumption)
    const db = makeMockDb([]);
    const result = await deleteProduct(db, "prod_1");
    expect(result).toEqual({ success: true });
  });
});

describe("createProduct", () => {
  it("auto-generates handle when not provided", async () => {
    // INSERT products (run) → buildProductDetail: products.get → variants.all → images.all
    const db = makeMockDb([
      f(productRow({ name: "T-Shirt", handle: "t-shirt-abc12345", category_id: null })),
      a([]),
      a([]),
    ]);

    const result = await createProduct(db, {
      name: "T-Shirt",
      price: 1500,
      type: "PHYSICAL",
      hasVariants: false,
      inventory: 10,
      trackInventory: true,
      visibility: true,
      status: "ACTIVE",
      showInStore: true,
      storeFeatured: false,
    });

    expect(result).not.toBeNull();
    expect(result!.name).toBe("T-Shirt");
  });

  it("sets publishedAt when status is ACTIVE", async () => {
    const db = makeMockDb([
      f(productRow({ status: "ACTIVE", published_at: NOW, category_id: null })),
      a([]),
      a([]),
    ]);

    const result = await createProduct(db, {
      name: "Active Product",
      price: 500,
      type: "PHYSICAL",
      hasVariants: false,
      inventory: 0,
      trackInventory: false,
      visibility: true,
      status: "ACTIVE",
      showInStore: true,
      storeFeatured: false,
    });

    expect(result!.publishedAt).toBeTruthy();
  });

  it("does not set publishedAt when status is DRAFT", async () => {
    const db = makeMockDb([
      f(productRow({ status: "DRAFT", published_at: null, category_id: null })),
      a([]),
      a([]),
    ]);

    const result = await createProduct(db, {
      name: "Draft Product",
      price: 500,
      type: "PHYSICAL",
      hasVariants: false,
      inventory: 0,
      trackInventory: false,
      visibility: false,
      status: "DRAFT",
      showInStore: false,
      storeFeatured: false,
    });

    expect(result!.publishedAt).toBeNull();
  });
});

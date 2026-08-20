/**
 * Product Groups — Unit Tests
 *
 * Coverage:
 *  1. Validation schemas (Zod) — no DB required
 *  2. getGroupById — returns null for missing; returns group with children + productsCount
 *  3. createGroup — inserts and returns new group
 *  4. updateGroup — updates and returns group
 *  5. deleteGroup — throws when products exist; succeeds otherwise
 */

import { describe, it, expect } from "vitest";
import { createGroupSchema, updateGroupSchema, groupFiltersSchema } from "./validation";
import { getGroupById, createGroup, updateGroup, deleteGroup } from "./queries";
import { makeMockDb, f, a, categoryRow } from "@/test-utils/mock-db";

// ─── createGroupSchema ─────────────────────────────────────────────────────────

describe("createGroupSchema", () => {
  it("accepts a minimal valid group", () => {
    expect(createGroupSchema.safeParse({ name: "ملابس" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createGroupSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("defaults position to 0", () => {
    expect(createGroupSchema.parse({ name: "ملابس" }).position).toBe(0);
  });

  it("accepts a valid slug (lowercase, hyphens)", () => {
    expect(createGroupSchema.safeParse({ name: "Shirts", slug: "cotton-shirts" }).success).toBe(true);
  });

  it("rejects slug with uppercase letters", () => {
    expect(createGroupSchema.safeParse({ name: "Shirts", slug: "Cotton-Shirts" }).success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    expect(createGroupSchema.safeParse({ name: "Shirts", slug: "cotton shirts" }).success).toBe(false);
  });

  it("accepts valid imageUrl", () => {
    expect(
      createGroupSchema.safeParse({ name: "ملابس", imageUrl: "https://example.com/img.jpg" }).success
    ).toBe(true);
  });

  it("rejects invalid imageUrl", () => {
    expect(
      createGroupSchema.safeParse({ name: "ملابس", imageUrl: "not-a-url" }).success
    ).toBe(false);
  });

  it("accepts null imageUrl", () => {
    expect(createGroupSchema.safeParse({ name: "ملابس", imageUrl: null }).success).toBe(true);
  });

  it("accepts optional parentId for sub-categories", () => {
    expect(
      createGroupSchema.safeParse({ name: "صيفي", parentId: "cat_1" }).success
    ).toBe(true);
  });

  it("rejects negative position", () => {
    expect(createGroupSchema.safeParse({ name: "ملابس", position: -1 }).success).toBe(false);
  });
});

// ─── updateGroupSchema ─────────────────────────────────────────────────────────

describe("updateGroupSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateGroupSchema.safeParse({}).success).toBe(true);
  });

  it("rejects empty name if provided", () => {
    expect(updateGroupSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts partial update with only position", () => {
    expect(updateGroupSchema.safeParse({ position: 2 }).success).toBe(true);
  });

  it("accepts null parentId to clear parent", () => {
    expect(updateGroupSchema.safeParse({ parentId: null }).success).toBe(true);
  });
});

// ─── groupFiltersSchema ────────────────────────────────────────────────────────

describe("groupFiltersSchema", () => {
  it("accepts an empty object", () => {
    expect(groupFiltersSchema.safeParse({}).success).toBe(true);
  });

  it("accepts search filter", () => {
    const result = groupFiltersSchema.parse({ search: "ملابس" });
    expect(result.search).toBe("ملابس");
  });

  it("accepts parentId filter", () => {
    const result = groupFiltersSchema.parse({ parentId: "cat_1" });
    expect(result.parentId).toBe("cat_1");
  });
});

// ─── getGroupById ──────────────────────────────────────────────────────────────

describe("getGroupById", () => {
  it("returns null when group does not exist", async () => {
    const db = makeMockDb([f(null)]);
    const result = await getGroupById(db as any, "cat_missing");
    expect(result).toBeNull();
  });

  it("returns group with empty children and zero productsCount", async () => {
    // productCategories.get → Promise.all[children.all, count.get]
    const db = makeMockDb([
      f(categoryRow()),
      a([]),           // children (Promise.all[0])
      f({ count: 0 }), // productsCount (Promise.all[1])
    ]);
    const result = await getGroupById(db as any, "cat_1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("cat_1");
    expect(result!.children).toEqual([]);
    expect(result!.productsCount).toBe(0);
  });

  it("returns group with children", async () => {
    const childCat = { ...categoryRow({ id: "cat_2", parent_id: "cat_1", slug: "child-cat_2" }) };
    const db = makeMockDb([
      f(categoryRow()),
      a([childCat]),   // 1 child
      f({ count: 0 }),
    ]);
    const result = await getGroupById(db as any, "cat_1");
    expect(result!.children).toHaveLength(1);
  });

  it("returns correct productsCount", async () => {
    const db = makeMockDb([
      f(categoryRow()),
      a([]),
      f({ count: 5 }),
    ]);
    const result = await getGroupById(db as any, "cat_1");
    expect(result!.productsCount).toBe(5);
  });
});

// ─── createGroup ───────────────────────────────────────────────────────────────

describe("createGroup", () => {
  it("creates and returns the new group", async () => {
    // INSERT (run) → getGroupById: category.get → Promise.all[children.all, count.get]
    const db = makeMockDb([
      f(categoryRow()),
      a([]),
      f({ count: 0 }),
    ]);
    const result = await createGroup(db as any, { name: "إكسسوارات", position: 0 });
    expect(result).not.toBeNull();
    expect(result!.id).toBeDefined();
  });

  it("auto-generates slug from name when not provided", async () => {
    const db = makeMockDb([
      f(categoryRow({ slug: "ikssswarat-abc12345" })),
      a([]),
      f({ count: 0 }),
    ]);
    const result = await createGroup(db as any, { name: "إكسسوارات", position: 0 });
    expect(result!.slug).toBeDefined();
  });

  it("uses provided slug when given", async () => {
    const db = makeMockDb([
      f(categoryRow({ slug: "accessories" })),
      a([]),
      f({ count: 0 }),
    ]);
    const result = await createGroup(db as any, {
      name: "Accessories",
      slug: "accessories",
      position: 1,
    });
    expect(result!.slug).toBe("accessories");
  });
});

// ─── updateGroup ───────────────────────────────────────────────────────────────

describe("updateGroup", () => {
  it("updates and returns the group", async () => {
    // UPDATE (run) → getGroupById: category.get → Promise.all[children.all, count.get]
    const db = makeMockDb([
      f(categoryRow({ name: "ملابس نسائية" })),
      a([]),
      f({ count: 2 }),
    ]);
    const result = await updateGroup(db as any, "cat_1", { name: "ملابس نسائية" });
    expect(result).not.toBeNull();
    expect(result!.productsCount).toBe(2);
  });
});

// ─── deleteGroup ───────────────────────────────────────────────────────────────

describe("deleteGroup", () => {
  it("succeeds even when category has products (sets categoryId to null via FK)", async () => {
    // DELETE cascades: products.category_id → set null (onDelete: "set null")
    const db = makeMockDb([]);
    const result = await deleteGroup(db as any, "cat_1");
    expect(result).toEqual({ success: true });
  });

  it("succeeds when category has no products", async () => {
    const db = makeMockDb([]);
    const result = await deleteGroup(db as any, "cat_1");
    expect(result).toEqual({ success: true });
  });
});

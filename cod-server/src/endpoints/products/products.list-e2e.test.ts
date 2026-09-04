/**
 * getAllProducts + getStoreProducts — Slice 5 real-D1 E2E.
 *
 * Runs the real migrations on an in-memory miniflare D1 and verifies the
 * batched read shapes against a mixed catalog (30 products):
 *   • variant / no-variant products; active + inactive variants
 *   • approved / pending / zero reviews; avgRating rounding
 *   • images / no images; cover = first by position
 *   • soft-deleted exclusion; status/visibility filters
 *   • featured-first ordering on the storefront list
 *   • pagination (limit/offset)
 *   • chunk boundary: a 91-product page issues two id-chunked variant
 *     queries and stays under D1's 100-bound-parameter limit (miniflare
 *     enforces it — verified by probe during implementation).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { getAllProducts } from "../../../../cod-shared/queries/products";
import { getStoreProducts } from "../../../../cod-shared/queries/store";

const registry: Miniflare[] = [];
let db: AppDb;

const CATALOG = 30;
const BIG_CATALOG = 95;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });
  registry.push(mf);
  const d1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) {
      await d1.prepare(statement).run();
    }
  }
  db = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;

  const now = new Date().toISOString();
  await db.insert(schema.stores).values({
    id: "store-e2e", name: "E2E Store", createdAt: now, updatedAt: now,
  });

  for (let i = 0; i < CATALOG + BIG_CATALOG; i++) {
    const big = i >= CATALOG;
    const id = big ? `prod-big-${i}` : `prod-${i}`;
    const createdAt = `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`;

    const product: typeof schema.products.$inferInsert = {
      id,
      name: big ? `Bulk Product ${i}` : `E2E Product ${i}`,
      description: i === 2 ? "Contains the marker ZZDESCMARKERZZ in prose" : null,
      handle: `e2e-${id}`,
      price: 1000 + i,
      hasVariants: !big && i % 3 === 0,
      inventory: big ? 5 : 20 + i,
      trackInventory: true,
      status: big ? "ACTIVE" : i === 7 ? "DRAFT" : "ACTIVE",
      visibility: true,
      showInStore: big ? true : i !== 8,
      storeFeatured: !big && i === 1,
      createdAt,
      updatedAt: now,
    };
    if (i === 9) product.deletedAt = now;
    await db.insert(schema.products).values(product);

    if (product.hasVariants) {
      await db.insert(schema.productVariants).values([
        {
          id: `var-${id}-a`, productId: id, variations: '{"Color":"Red"}',
          sku: `SKU-${id}-A`, price: 1000, inventory: 3, active: true, position: 1,
          createdAt: now, updatedAt: now,
        },
        {
          id: `var-${id}-b`, productId: id, variations: '{"Color":"Blue"}',
          sku: `SKU-${id}-B`, price: 1100, inventory: 4, active: true, position: 2,
          createdAt: now, updatedAt: now,
        },
        {
          id: `var-${id}-c`, productId: id, variations: '{"Color":"Green"}',
          sku: `SKU-${id}-C`, price: 1200, inventory: 99, active: false, position: 3,
          createdAt: now, updatedAt: now,
        },
      ]);
    }

    if (!big && i % 4 === 0) {
      await db.insert(schema.productImages).values([
        { id: `img-${id}-2`, productId: id, src: `${id}-second.jpg`, position: 2, type: 1, createdAt: now, updatedAt: now },
        { id: `img-${id}-1`, productId: id, src: `${id}-first.jpg`, position: 1, type: 1, createdAt: now, updatedAt: now },
      ]);
    }

    if (!big && (i === 0 || i === 3 || i === 6)) {
      await db.insert(schema.customers).values({
        id: `cust-rev-${i}`, name: `Reviewer ${i}`, phone: `07700001${String(i).padStart(2, "0")}`,
        wilaya: "الجزائر", createdAt: now,
      });
      await db.insert(schema.orders).values({
        id: `ord-rev-${i}`, orderNumber: `ORD-REV-${i}`, customerId: `cust-rev-${i}`,
        customerName: `Reviewer ${i}`, phone: `07700001${String(i).padStart(2, "0")}`,
        price: 1000, status: "delivered", deliveryMethod: "unassigned", deliveryType: "home",
        deliveryFee: 0, driverFee: 0, codAmount: 1000, createdAt, updatedAt: now,
      });
      await db.insert(schema.reviews).values({
        id: `rev-${i}`, storeId: "store-e2e", productId: id,
        orderId: `ord-rev-${i}`, orderNumber: `ORD-REV-${i}`,
        customerName: `Reviewer ${i}`,
        rating: 4, body: "good",
        status: i === 6 ? "pending" : "approved",
        createdAt: now, updatedAt: now,
      });
    }
  }
}, 180_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("getAllProducts — real D1", () => {
  it("returns the full mixed catalog with correct derived fields", async () => {
    const rows = await getAllProducts(db, { limit: 200 });

    expect(rows.length).toBe(CATALOG + BIG_CATALOG - 1);

    const variantRow = rows.find((r) => r.id === "prod-0");
    expect(variantRow).toMatchObject({
      hasVariants: true,
      variantsCount: 3,
      totalInventory: 106,
      reviewCount: 1,
      avgRating: 4,
      primaryImageSrc: "prod-0-first.jpg",
    });
    expect(variantRow!.variants.map((v) => v.id)).toEqual([
      "var-prod-0-a", "var-prod-0-b", "var-prod-0-c",
    ]);

    const simpleRow = rows.find((r) => r.id === "prod-1");
    expect(simpleRow).toMatchObject({
      hasVariants: false,
      variantsCount: 0,
      totalInventory: 21,
      reviewCount: 0,
      avgRating: null,
    });

    const pendingOnly = rows.find((r) => r.id === "prod-6");
    expect(pendingOnly).toMatchObject({ reviewCount: 0, avgRating: null });

    const noImages = rows.find((r) => r.id === "prod-2");
    expect(noImages!.primaryImageSrc).toBeNull();
  });

  it("excludes soft-deleted products", async () => {
    const rows = await getAllProducts(db, { limit: 200 });
    expect(rows.find((r) => r.id === "prod-9")).toBeUndefined();
  });

  it("filters by status and respects limit/offset", async () => {
    const drafts = await getAllProducts(db, { status: "DRAFT" });
    expect(drafts.map((r) => r.id)).toEqual(["prod-7"]);

    const page1 = await getAllProducts(db, { limit: 10, offset: 0 });
    const page2 = await getAllProducts(db, { limit: 10, offset: 10 });
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page1[0].id).not.toBe(page2[0].id);

    const empty = await getAllProducts(db, { limit: 10, offset: 500 });
    expect(empty).toEqual([]);
  });

  it("search matches name but no longer scans description text (Slice 9 hygiene)", async () => {
    const byName = await getAllProducts(db, { search: "E2E Product 2" });
    expect(byName.map((r) => r.id).sort()).toEqual(
      ["prod-2", ...Array.from({ length: 10 }, (_, i) => `prod-2${i}`)].sort(),
    );

    const byDescriptionMarker = await getAllProducts(db, { search: "ZZDESCMARKERZZ" });
    expect(byDescriptionMarker).toEqual([]);
  });

  it("chunks variant fetches for pages beyond the 90-id boundary", async () => {
    const rows = await getAllProducts(db, { limit: 200 });
    expect(rows.length).toBeGreaterThan(91);

    const bulk = rows.filter((r) => r.id.startsWith("prod-big-"));
    expect(bulk).toHaveLength(BIG_CATALOG);
    expect(bulk.every((r) => r.variantsCount === 0 && r.totalInventory === 5)).toBe(true);
  });
});

describe("getStoreProducts — real D1", () => {
  it("lists store-visible ACTIVE products with featured first", async () => {
    const rows = await getStoreProducts(db, { limit: 200 });

    expect(rows.find((r) => r.id === "prod-9")).toBeUndefined();
    expect(rows.find((r) => r.id === "prod-8")).toBeUndefined();
    expect(rows.find((r) => r.id === "prod-7")).toBeUndefined();

    expect(rows[0].id).toBe("prod-1");
    expect(rows[0].storeFeatured).toBe(true);
    expect(rows.slice(1).every((r) => !r.storeFeatured)).toBe(true);
  });

  it("derives inventory from ACTIVE variants only", async () => {
    const rows = await getStoreProducts(db, { limit: 200 });

    const variantProduct = rows.find((r) => r.id === "prod-0");
    expect(variantProduct!.inventory).toBe(7);

    const simpleProduct = rows.find((r) => r.id === "prod-1");
    expect(simpleProduct!.inventory).toBe(21);
  });

  it("picks the cover image with the lowest position per product", async () => {
    const rows = await getStoreProducts(db, { limit: 200 });

    const withImages = rows.find((r) => r.id === "prod-0");
    expect(withImages!.coverImage).toMatchObject({ id: "img-prod-0-1", src: "prod-0-first.jpg" });

    const withoutImages = rows.find((r) => r.id === "prod-1");
    expect(withoutImages!.coverImage).toBeNull();
  });

  it("maps reviewStats from approved reviews only", async () => {
    const rows = await getStoreProducts(db, { limit: 200 });

    const approved = rows.find((r) => r.id === "prod-0");
    expect(approved!.reviewStats).toEqual({ avgRating: 4, reviewCount: 1 });

    const pendingOnly = rows.find((r) => r.id === "prod-6");
    expect(pendingOnly!.reviewStats).toBeNull();

    const noReviews = rows.find((r) => r.id === "prod-1");
    expect(noReviews!.reviewStats).toBeNull();
  });

  it("respects the limit cap", async () => {
    const all = await getStoreProducts(db, { limit: 200 });
    const page1 = await getStoreProducts(db, { limit: 5 });

    expect(page1[0].id).toBe(all[0].id);
    expect(page1).toHaveLength(5);
    expect(page1.every((r) => all.some((a) => a.id === r.id))).toBe(true);
    expect(await getStoreProducts(db, { limit: 500, featured: true })).toEqual(
      await getStoreProducts(db, { limit: 5, featured: true }),
    );
  });

  it("featured filter returns only the featured product", async () => {
    const rows = await getStoreProducts(db, { featured: true, limit: 10 });
    expect(rows.map((r) => r.id)).toEqual(["prod-1"]);
  });
});

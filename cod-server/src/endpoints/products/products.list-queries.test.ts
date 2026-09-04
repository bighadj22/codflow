/**
 * getAllProducts — Slice 5 mock-queue coverage.
 *
 * Call shape: ONE main select (products + review/image scalar subqueries),
 * then ONE follow-up per id-chunk fetching all variants of the page. No
 * per-row queries. WHERE/aggregate semantics are verified against real D1
 * in products.list-e2e.test.ts.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, f, a, productRow, variantRow } from "@/test-utils/mock-db";
import { getAllProducts } from "../../../../cod-shared/queries/products";

describe("getAllProducts", () => {
  it("maps one row with review stats and cover image from the main select", async () => {
    const db = makeMockDb([
      a([
        {
          ...productRow(),
          review_count: 7,
          avg_rating: 4.5,
          primary_image_src: "https://example.com/cover.jpg",
        },
      ]),
      a([variantRow({ id: "var_1", position: 2 }), variantRow({ id: "var_2", position: 1 })]),
    ]);

    const rows = await getAllProducts(db);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "prod_1",
      reviewCount: 7,
      avgRating: 4.5,
      primaryImageSrc: "https://example.com/cover.jpg",
      variantsCount: 2,
      totalInventory: 10,
      hasVariants: false,
    });
    expect(rows[0].variants).toHaveLength(2);
    expect(rows[0].variants[0]).toMatchObject({ id: "var_1", variations: { Color: "Red" } });
  });

  it("falls back to product inventory when a product has no variants", async () => {
    const db = makeMockDb([
      a([{ ...productRow(), review_count: 0, avg_rating: null, primary_image_src: null }]),
      a([]),
    ]);

    const rows = await getAllProducts(db);

    expect(rows[0]).toMatchObject({
      variantsCount: 0,
      totalInventory: 10,
      primaryImageSrc: null,
      reviewCount: 0,
      avgRating: null,
      variants: [],
    });
  });

  it("returns [] for an empty page without running the variant follow-up", async () => {
    const db = makeMockDb([a([])]);

    const rows = await getAllProducts(db);

    expect(rows).toEqual([]);
  });

  it("parses variantOptions and tags JSON", async () => {
    const db = makeMockDb([
      a([
        {
          ...productRow({
            variant_options: JSON.stringify([{ name: "اللون", values: [{ value: "أحمر" }] }]),
            tags: JSON.stringify(["sale"]),
          }),
          review_count: 0,
          avg_rating: null,
          primary_image_src: null,
        },
      ]),
      a([]),
    ]);

    const rows = await getAllProducts(db);

    expect(rows[0].variantOptions).toEqual([{ name: "اللون", values: [{ value: "أحمر" }] }]);
    expect(rows[0].tags).toEqual(["sale"]);
  });

  it("pages beyond the chunk size issue one variant query per chunk", async () => {
    const page = Array.from({ length: 91 }, (_, i) => ({
      ...productRow({ id: `prod_${i}` }),
      review_count: 0,
      avg_rating: null,
      primary_image_src: null,
    }));
    const db = makeMockDb([
      a(page),
      a([variantRow({ product_id: "prod_0" })]),
      a([variantRow({ product_id: "prod_90" })]),
    ]);

    const rows = await getAllProducts(db, { limit: 91 });

    expect(rows).toHaveLength(91);
    expect(rows[0]).toMatchObject({ id: "prod_0", variantsCount: 1 });
    expect(rows[89]).toMatchObject({ id: "prod_89", variantsCount: 0 });
    expect(rows[90]).toMatchObject({ id: "prod_90", variantsCount: 1 });
  });
});

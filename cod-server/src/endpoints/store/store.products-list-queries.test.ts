/**
 * getStoreProducts — Slice 5 mock-queue coverage.
 *
 * Call shape: ONE main select (products + review subqueries), then ONE read
 * batch containing the cover-image select(s) and active-variant inventory
 * aggregate(s). No per-row queries.
 */

import { describe, it, expect } from "vitest";
import { makeMockDb, a, productRow } from "@/test-utils/mock-db";
import { getStoreProducts } from "../../../../cod-shared/queries/store";

describe("getStoreProducts", () => {
  it("maps cover image, variant inventory, and review stats from one batch", async () => {
    const db = makeMockDb([
      a([
        {
          ...productRow({ has_variants: 1, inventory: 999 }),
          avg_rating: 4.7,
          review_count: 12,
        },
      ]),
      a([{ id: "img_1", product_id: "prod_1", src: "cover.jpg", position: 2 }]),
      a([{ productId: "prod_1", total: 14 }]),
    ]);

    const rows = await getStoreProducts(db, {});

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "prod_1",
      inventory: 14,
      reviewStats: { avgRating: 4.7, reviewCount: 12 },
    });
    expect(rows[0].coverImage).toMatchObject({ id: "img_1", src: "cover.jpg" });
  });

  it("picks the first cover image by position within a product", async () => {
    const db = makeMockDb([
      a([{ ...productRow(), avg_rating: null, review_count: 0 }]),
      a([
        { id: "img_b", product_id: "prod_1", src: "first.jpg", position: 1 },
        { id: "img_a", product_id: "prod_1", src: "second.jpg", position: 2 },
      ]),
      a([]),
    ]);

    const rows = await getStoreProducts(db, {});

    expect(rows[0].coverImage).toMatchObject({ id: "img_b", src: "first.jpg" });
  });

  it("simple product inventory comes from the product row (no variant sum)", async () => {
    const db = makeMockDb([
      a([{ ...productRow({ inventory: 42, has_variants: 0 }), avg_rating: null, review_count: 0 }]),
      a([]),
      a([]),
    ]);

    const rows = await getStoreProducts(db, {});

    expect(rows[0]).toMatchObject({ inventory: 42, coverImage: null });
  });

  it("variant product with no active variants maps inventory 0", async () => {
    const db = makeMockDb([
      a([{ ...productRow({ has_variants: 1, inventory: 999 }), avg_rating: null, review_count: 0 }]),
      a([]),
      a([]),
    ]);

    const rows = await getStoreProducts(db, {});

    expect(rows[0]).toMatchObject({ inventory: 0 });
  });

  it("null reviewStats when no approved reviews", async () => {
    const db = makeMockDb([
      a([{ ...productRow(), avg_rating: null, review_count: 0 }]),
      a([]),
      a([]),
    ]);

    const rows = await getStoreProducts(db, {});

    expect(rows[0].reviewStats).toBeNull();
  });

  it("returns [] for an empty page without the follow-up batch", async () => {
    const db = makeMockDb([a([])]);

    const rows = await getStoreProducts(db, {});

    expect(rows).toEqual([]);
  });
});

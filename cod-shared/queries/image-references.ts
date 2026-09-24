import { productCategories, productImages, products } from "../db/schema";
import type { AppDb } from "../db/client";
import { imageKeysInText } from "../lib/orphan-images";

/**
 * Every R2 key still referenced by stored data.
 *
 * The reference sources are enumerated here, in one place, because a missed
 * source means the orphan sweep deletes live merchant media. Today:
 *
 *   1. `product_images.r2_key` — the gallery record's own key;
 *   2. `product_images.src` — the same object as a public URL, for rows saved
 *      without a key;
 *   3. `products.description` — inline images in rich descriptions, which no
 *      other table knows about;
 *   4. `product_categories.image_url` — the category uploader writes into the
 *      same `products/` namespace, so a category image is an object this sweep
 *      could otherwise delete.
 *
 * Soft-deleted products are included deliberately: restore must not find its
 * media already destroyed. A new uploader must add its column here (the sweep
 * test in `cod-server/src/cron/sweep-orphan-images.test.ts` guards the ones
 * that exist).
 *
 * Scanning is per-value and shape-agnostic (`imageKeysInText`), so a key is
 * protected whether it is stored bare or inside a URL.
 */
export async function collectReferencedImageKeys(db: AppDb): Promise<Set<string>> {
  const [imageRows, descriptionRows, categoryRows] = await Promise.all([
    db
      .select({ r2Key: productImages.r2Key, src: productImages.src })
      .from(productImages)
      .all(),
    db.select({ description: products.description }).from(products).all(),
    db.select({ imageUrl: productCategories.imageUrl }).from(productCategories).all(),
  ]);

  const keys = new Set<string>();
  for (const row of imageRows) {
    for (const key of imageKeysInText(row.r2Key, row.src)) keys.add(key);
  }
  for (const row of descriptionRows) {
    for (const key of imageKeysInText(row.description)) keys.add(key);
  }
  for (const row of categoryRows) {
    for (const key of imageKeysInText(row.imageUrl)) keys.add(key);
  }
  return keys;
}

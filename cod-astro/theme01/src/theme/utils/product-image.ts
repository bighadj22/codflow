/**
 * Which image represents a product outside its own page.
 *
 * `coverImage` is nullable and frequently null: a merchant uploads a gallery
 * and never explicitly picks a cover. Reading it alone gives a product with
 * four photos and no thumbnail — which is exactly how the basket shipped,
 * showing a name beside an empty grey square.
 *
 * Kept as a function rather than inlined so the fallback is one rule with one
 * test, and so the cart, the checkout summary and the product card cannot
 * disagree about which photo a product "is".
 */

interface ImageLike {
  src?: string | null;
}

interface ProductLike {
  coverImage?: ImageLike | null;
  images?: ImageLike[] | null;
}

/** The product's representative image, or null when it genuinely has none. */
export function productImageSource(product: ProductLike | null | undefined): string | null {
  if (!product) return null;
  const candidates = [product.coverImage, ...(product.images ?? [])];
  for (const candidate of candidates) {
    const src = candidate?.src;
    if (typeof src === "string" && src.trim().length > 0) return src;
  }
  return null;
}

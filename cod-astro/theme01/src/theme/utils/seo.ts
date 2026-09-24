import type { Product } from "@/core/api/types";

/**
 * The description to use in metadata (JSON-LD, og:description).
 *
 * A rich description is stored as sanitised HTML — correct for the page, wrong
 * for metadata, where tags must never appear. The platform ships
 * `descriptionPlain` (tags stripped, entities decoded) for exactly this.
 * Fallbacks, in order:
 *   1. `descriptionPlain` — authoritative when present.
 *   2. legacy `text` rows → the stored text (it is plain by definition).
 *   3. an `html` row with no `descriptionPlain` → `undefined`, so markup can
 *      never leak into structured data.
 */
export function productMetaDescription(product: Product): string | undefined {
  if (product.descriptionPlain) return product.descriptionPlain;
  if (product.descriptionFormat === "html") return undefined;
  return product.description ?? undefined;
}

export function getProductJsonLd(product: Product, basePrice: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productMetaDescription(product),
    image: product.images.map((i) => i.src),
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: basePrice,
      availability:
        product.trackInventory && product.inventory === 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
  };
}

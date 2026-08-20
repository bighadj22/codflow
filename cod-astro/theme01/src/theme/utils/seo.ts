import type { Product } from "@/core/api/types";

export function getProductJsonLd(product: Product, basePrice: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
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

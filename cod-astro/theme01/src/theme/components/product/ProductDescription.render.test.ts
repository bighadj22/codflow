// @vitest-environment node
// Must run in the node environment: under happy-dom the Astro plugin resolves
// `.astro` imports to the browser stub, which throws instead of rendering.
/**
 * ProductDescription render tests — the security-critical branch of Slice 5.
 *
 * Two facts must hold, and only one of them is about rich text:
 *   1. `descriptionFormat: "html"` → the sanitised markup is rendered as HTML
 *      (this is what makes formatting and inline images visible).
 *   2. `descriptionFormat: "text"` (or absent — every legacy row) → the value
 *      is **escaped**, exactly as before this feature. A merchant's prose
 *      containing "<" must never become an element.
 *
 * Rendered through Astro's Container API against the real component, so the
 * assertion is about what the storefront actually emits — not about a helper
 * we wrote to be testable.
 */
/// <reference types="vitest/globals" />

import { experimental_AstroContainer as AstroContainer } from "astro/container";
import ProductDescription from "./ProductDescription.astro";
import { ProductSchema } from "@/core/api/validation";
import type { Product } from "@/core/api/types";

function product(overrides: Partial<Product> = {}): Product {
  return ProductSchema.parse({
    id: "prod_1",
    name: "Casque Bluetooth",
    description: "<p>Son <strong>excellent</strong></p>",
    descriptionFormat: "html",
    descriptionPlain: "Son excellent",
    handle: "casque-bluetooth",
    price: 4500,
    compareAtPrice: null,
    currency: "DZD",
    hasVariants: false,
    variantOptions: null,
    tags: [],
    status: "active",
    storeFeatured: false,
    inventory: 10,
    trackInventory: true,
    category: null,
    variants: [],
    images: [],
    coverImage: null,
    reviewStats: null,
    offers: [],
    ...overrides,
  });
}

async function render(p: Product): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(ProductDescription, {
    props: {
      description: p.description ?? "",
      format: p.descriptionFormat,
      isDesktop: true,
    },
  });
}

describe("ProductDescription — the rich/plain branch", () => {
  it("renders sanitised HTML for a rich description (markup becomes elements)", async () => {
    const html = await render(product());
    expect(html).toContain("<strong>excellent</strong>");
    expect(html).toContain("rich-description");
    // Must not be double-escaped — that would show tags as text to customers.
    expect(html).not.toContain("&lt;strong&gt;");
  });

  it("renders inline images from the sanitised HTML with their attributes", async () => {
    const html = await render(
      product({
        description:
          '<p>Look</p><img src="https://media.example.com/products/a.jpg" alt="Casque" width="800" height="600" loading="lazy" decoding="async" referrerpolicy="no-referrer">',
      }),
    );
    expect(html).toContain('src="https://media.example.com/products/a.jpg"');
    expect(html).toContain('alt="Casque"');
    expect(html).toContain('width="800"');
  });

  it("ESCAPES a legacy text description — angle brackets never become elements", async () => {
    const html = await render(
      product({
        description: "Size < 10cm & <script>alert(1)</script>",
        descriptionFormat: undefined,
        descriptionPlain: undefined,
      }),
    );
    expect(html).toContain("&lt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("rich-description");
  });

  it("treats an absent descriptionFormat as text (legacy parity)", async () => {
    const html = await render(
      product({ description: "<em>x</em>", descriptionFormat: undefined, descriptionPlain: undefined }),
    );
    expect(html).not.toContain("<em>");
    expect(html).toContain("&lt;em&gt;");
  });

  it("renders nothing for the description when it is null", async () => {
    const html = await render(product({ description: null }));
    expect(html).not.toContain("rich-description");
    expect(html).not.toContain("&lt;");
  });
});

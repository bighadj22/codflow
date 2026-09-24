/**
 * Which image represents a product in the basket.
 *
 * This shipped reading `coverImage` alone. That field is nullable and often
 * null — a merchant uploads a gallery and never picks a cover — so the cart
 * drawer and the checkout summary showed a product name beside an empty grey
 * square, on a storefront whose whole job is selling by photograph.
 */
/// <reference types="vitest/globals" />

import { productImageSource } from "./product-image";

describe("productImageSource", () => {
  it("prefers the cover the merchant chose", () => {
    const src = productImageSource({
      coverImage: { src: "https://media.example/cover.webp" },
      images: [{ src: "https://media.example/first.webp" }],
    });

    expect(src).toBe("https://media.example/cover.webp");
  });

  it("falls back to the first gallery image when there is no cover", () => {
    // The case that broke: four photos, no cover, no thumbnail in the basket.
    const src = productImageSource({
      coverImage: null,
      images: [
        { src: "https://media.example/first.webp" },
        { src: "https://media.example/second.webp" },
      ],
    });

    expect(src).toBe("https://media.example/first.webp");
  });

  it("skips a cover that exists but carries no usable url", () => {
    expect(
      productImageSource({
        coverImage: { src: "" },
        images: [{ src: "https://media.example/first.webp" }],
      }),
    ).toBe("https://media.example/first.webp");

    expect(
      productImageSource({
        coverImage: { src: "   " },
        images: [{ src: "https://media.example/first.webp" }],
      }),
    ).toBe("https://media.example/first.webp");
  });

  it("skips gallery entries with no url and takes the next real one", () => {
    const src = productImageSource({
      coverImage: null,
      images: [{ src: null }, { src: "https://media.example/second.webp" }],
    });

    expect(src).toBe("https://media.example/second.webp");
  });

  it("returns nothing when the product genuinely has no image", () => {
    // The row still renders — a name and a placeholder beats a broken <img>.
    expect(productImageSource({ coverImage: null, images: [] })).toBeNull();
    expect(productImageSource({})).toBeNull();
    expect(productImageSource(null)).toBeNull();
    expect(productImageSource(undefined)).toBeNull();
  });
});

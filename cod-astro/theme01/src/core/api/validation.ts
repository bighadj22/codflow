import { z } from "astro:schema";

/**
 * Product Image Schema
 */
export const ProductImageSchema = z.object({
  id: z.string(),
  src: z.string().url(),
  srcSm: z.string().url().nullable(),
  srcMd: z.string().url().nullable(),
  srcLg: z.string().url().nullable(),
  altText: z.string().nullable(),
  position: z.number(),
});

/**
 * Product Variant Schema
 */
export const ProductVariantSchema = z.object({
  id: z.string(),
  variations: z.record(z.string()),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  inventory: z.number(),
  sku: z.string().nullable(),
  isDefault: z.boolean(),
  imageId: z.string().nullable(),
});

/**
 * Offer Schema
 */
export const OfferSchema = z.object({
  id: z.string(),
  name: z.string(),
  discountType: z.enum(["free", "free_shipping"]),
  triggerQuantity: z.number(),
  triggerVariantId: z.string().nullable(),
  rewardQuantity: z.number(),
  rewardProductId: z.string().nullable(),
  rewardProductName: z.string(),
  rewardVariantId: z.string().nullable(),
  rewardVariantLabel: z.string().nullable(),
});

/**
 * Product Schema for Content Collections
 */
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  handle: z.string(),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  currency: z.string(),
  hasVariants: z.boolean(),
  variantOptions: z.array(z.object({
    name: z.string(),
    values: z.array(z.object({ 
      value: z.string(), 
      hexColor: z.string().optional() 
    })),
  })).nullable(),
  tags: z.array(z.string()),
  status: z.string(),
  storeFeatured: z.boolean(),
  inventory: z.number(),
  trackInventory: z.boolean(),
  category: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }).nullable(),
  variants: z.array(ProductVariantSchema),
  images: z.array(ProductImageSchema),
  coverImage: ProductImageSchema.nullable(),
  reviewStats: z.object({
    avgRating: z.number(),
    reviewCount: z.number(),
  }).nullable().optional(),
  offers: z.array(OfferSchema),
});

/**
 * Category Schema for Content Collections
 */
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  position: z.number(),
});

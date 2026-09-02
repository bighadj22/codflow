/**
 * Store & Storefront Schemas
 *
 * Store configuration, branding, Meta Pixel, and storefront-specific views.
 */

import { z } from "@hono/zod-openapi";
import { ProductCategoryRowSchema } from "./products";

export const StoreSchema = z
  .object({
    id: z.string().openapi({ example: "store_01" }),
    name: z.string().openapi({ example: "My Shop" }),
    domain: z.string().nullable().openapi({ description: "Custom storefront domain", example: null }),
    logoUrl: z.string().url().nullable().openapi({ example: "https://cdn.example.com/logo.png" }),
    themeId: z.string().openapi({
      description: 'Active theme slug: "theme01", "theme02", etc.',
      example: "theme01",
    }),
    primaryColor: z.string().openapi({ description: "Primary CTA color (hex)", example: "#3b82f6" }),
    accentColor: z.string().openapi({ description: "Accent / highlight color (hex)", example: "#f97316" }),
    bgColor: z.string().openapi({ description: "Background color (hex)", example: "#ffffff" }),
    fontFamily: z.string().openapi({ description: "CSS font-family string", example: "Cairo" }),
    fontUrl: z.string().url().nullable().openapi({
      description: "Google Fonts import URL (optional override)",
      example: "https://fonts.googleapis.com/css2?family=Cairo",
    }),
    lang: z.enum(["ar", "en"]).openapi({ description: "Store UI language", example: "ar" }),
    currency: z.string().openapi({ example: "DZD" }),
    currencySymbol: z.string().openapi({ example: "دج" }),
    contentJson: z.string().nullable().openapi({
      description: "Serialized JSON of every text string shown in the storefront",
    }),
    metaTitle: z.string().nullable().openapi({ example: "My Shop — Best Products" }),
    metaDescription: z.string().nullable().openapi({ example: "Find the best products at My Shop." }),
    ogImage: z.string().url().nullable().openapi({ example: "https://cdn.example.com/og.png" }),
    announcementBar: z.string().nullable().openapi({
      description: "Top announcement bar text (null = hidden)",
      example: "Free delivery on orders above 3000 دج",
    }),
    reviewsEnabled: z.boolean().openapi({
      description: "When false, reviews are hidden on the storefront and submission is disabled",
      example: true,
    }),
    status: z.enum(["active", "inactive"]).openapi({ example: "active" }),
    storeApiKey: z.string().nullable().openapi({
      description:
        "Plaintext storefront API key — visible to the merchant in Store Settings. Not the dashboard API key.",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Store", {
    description:
      "Single-tenant store configuration: branding, theme, localization, SEO, and feature flags",
  });

export const StorePixelConfigSchema = z
  .object({
    id: z.string(),
    storeId: z.string(),
    pixelId: z.string().openapi({ example: "1234567890123456" }),
    accessToken: z.string().openapi({ description: "Meta access token used for server-side events" }),
    testEventCode: z.string().nullable().openapi({
      description: "Meta test event code — used during integration testing only. Set to null in production.",
    }),
    enabled: z.boolean().openapi({ example: true }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("StorePixelConfig", {
    description: "Meta pixel tracking configuration for server-side conversion events",
  });

// ─── Storefront API (public, X-Store-API-Key) ─────────────────────────────────

export const StoreProductImageSchema = z.object({
  id: z.string(),
  src: z.string().url().openapi({ description: "Original image URL" }),
  srcSm: z.string().url().nullable().openapi({ example: null }),
  srcMd: z.string().url().nullable().openapi({ example: null }),
  srcLg: z.string().url().nullable().openapi({ example: null }),
  altText: z.string().nullable().openapi({ description: "Alt text for accessibility" }),
  position: z.number().int().min(1).openapi({ description: "Display order (1 = first)" }),
});

export const StoreReviewStatsSchema = z.object({
  avgRating: z.number().openapi({
    description: "Average rating (1.0–5.0, rounded to 1 decimal)",
    example: 4.5,
  }),
  reviewCount: z.number().int().openapi({
    description: "Number of approved reviews",
    example: 12,
  }),
});

const storeBaseFields = {
  id: z.string(),
  name: z.string().openapi({ example: "Samsung Galaxy A54" }),
  description: z.string().nullable(),
  handle: z.string().openapi({ example: "samsung-galaxy-a54" }),
  currency: z.string().openapi({ example: "DZD" }),
  price: z.number().openapi({ example: 45000 }),
  compareAtPrice: z.number().nullable(),
  costPrice: z.number().nullable().openapi({
    description: "Internal cost price for merchant reference",
  }),
  type: z.enum(["PHYSICAL", "DIGITAL"]),
  hasVariants: z.boolean(),
  sku: z.string().nullable(),
  inventory: z.number().int(),
  trackInventory: z.boolean(),
  lowStockThreshold: z.number().int().openapi({
    description: "Threshold for low stock warnings",
  }),
  categoryId: z.string().nullable(),
  visibility: z.boolean(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  showInStore: z.boolean(),
  storeFeatured: z.boolean(),
  deletedAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

export const StoreProductListSchema = z
  .object({
    ...storeBaseFields,
    variantOptions: z.string().nullable().openapi({
      description: "Raw JSON string — parsed before use",
    }),
    tags: z.string().nullable().openapi({
      description: "Raw JSON string array — parsed before use",
    }),
    coverImage: StoreProductImageSchema.nullable().openapi({
      description: "First image by position, or null if no images",
    }),
    reviewStats: StoreReviewStatsSchema.nullable().openapi({
      description:
        "Aggregate review stats (approved reviews only). null if no approved reviews exist for this product.",
    }),
  })
  .openapi("StoreProductList");

export const StoreOfferSummarySchema = z.object({
  id: z.string().openapi({ description: "Offer UUID" }),
  name: z.string().openapi({
    description: "Merchant-facing offer name — display as the offer banner title.",
    example: "اشتري 2 واحصل على 1 مجاناً",
  }),
  discountType: z.enum(["free", "free_shipping"]).openapi({
    description:
      "`free` = Buy X Get Y (reward product added at $0). `free_shipping` = delivery fee waived for this order.",
  }),
  triggerQuantity: z.number().int().openapi({
    description: "Minimum quantity the customer must order to trigger the offer.",
    example: 2,
  }),
  triggerVariantId: z.string().nullable().openapi({
    description:
      "Trigger variant restriction. null = offer applies to any variant. When non-null, the offer only activates if the customer selects this specific variant.",
  }),
  rewardQuantity: z.number().int().openapi({
    description: "Number of free units of the reward product added to the order.",
    example: 1,
  }),
  rewardProductId: z.string().nullable().openapi({
    description:
      "UUID of the product given for free. null for `free_shipping` offers (no reward product).",
  }),
  rewardProductName: z.string().openapi({
    description: "Display name of the reward product. Empty string for `free_shipping` offers.",
    example: "Samsung Galaxy A54",
  }),
  rewardVariantId: z.string().nullable().openapi({
    description:
      "UUID of the specific reward variant. null = server resolves automatically (same variant as ordered when same product, or first active variant when different product).",
  }),
  rewardVariantLabel: z.string().nullable().openapi({
    description:
      "Human-readable reward variant label (e.g. 'أزرق / 128 GB'). null when no specific variant is fixed.",
  }),
});

export const StoreProductDetailSchema = z
  .object({
    ...storeBaseFields,
    variantOptions: z
      .array(
        z.object({
          name: z.string().openapi({ example: "Color" }),
          values: z.array(
            z.object({
              value: z.string().openapi({ example: "Red" }),
              hexColor: z.string().nullable().openapi({ example: "#FF0000" }),
            })
          ),
        })
      )
      .nullable()
      .openapi({ description: "Parsed variant option axes. null for simple products." }),
    tags: z.array(z.string()).openapi({
      description: "Parsed tag list",
      example: ["sale", "new"],
    }),
    category: ProductCategoryRowSchema.nullable().openapi({
      description: "Joined category, or null if no category assigned.",
    }),
    variants: z
      .array(
        z.object({
          id: z.string(),
          productId: z.string(),
          variations: z.record(z.string(), z.string()).openapi({
            description: "Parsed key-value map of option name → value",
            example: { Color: "Red", Size: "M" },
          }),
          currency: z.string().openapi({ example: "DZD" }),
          price: z.number().openapi({ example: 45000 }),
          compareAtPrice: z.number().nullable(),
          sku: z.string().nullable(),
          barcode: z.string().nullable(),
          inventory: z.number().int(),
          lowStockThreshold: z.number().int(),
          weightKg: z.number().nullable(),
          imageId: z.string().nullable(),
          isDefault: z.boolean(),
          active: z.boolean(),
          position: z.number().int(),
          createdAt: z.string().datetime(),
          updatedAt: z.string().datetime(),
        })
      )
      .openapi({
        description: "Active variants ordered by position. Empty array for simple products.",
      }),
    images: z.array(StoreProductImageSchema).openapi({
      description: "All product images ordered by position.",
    }),
    reviewStats: StoreReviewStatsSchema.nullable().openapi({
      description:
        "Aggregate review stats (approved reviews only). null if no approved reviews exist for this product.",
    }),
    offers: z.array(StoreOfferSummarySchema).openapi({
      description:
        "Active Buy X Get Y offers currently applicable to this product. Only includes offers where `status=active` and the current time is within the optional schedule window. The storefront uses this list to display offer banners and to show the free reward row in the order summary when the customer selects a matching variant and quantity.",
    }),
  })
  .openapi("StoreProductDetail");

export const StoreConfigSchema = z
  .object({
    id: z.string().openapi({ description: "Store UUID" }),
    name: z.string().openapi({ example: "متجري" }),
    domain: z.string().nullable(),
    logoUrl: z.string().nullable(),
    themeId: z.string().openapi({ example: "theme01" }),
    primaryColor: z.string().openapi({ example: "#3a58ee" }),
    accentColor: z.string().openapi({ example: "#f59e0b" }),
    bgColor: z.string().openapi({ example: "#f8f8f8" }),
    fontFamily: z.string().openapi({ example: "Cairo, sans-serif" }),
    fontUrl: z.string().nullable().openapi({
      description: "Google Fonts CSS URL override",
    }),
    lang: z.enum(["ar", "en"]),
    currency: z.string().openapi({ example: "DZD" }),
    currencySymbol: z.string().openapi({ example: "دج" }),
    contentJson: z.string().nullable().openapi({
      description:
        "JSON blob of storefront text overrides (StoreFrontContent partial). null = use theme defaults.",
    }),
    metaTitle: z.string().nullable(),
    metaDescription: z.string().nullable(),
    ogImage: z.string().nullable(),
    announcementBar: z.string().nullable(),
    reviewsEnabled: z.boolean().openapi({
      description: "When false, the reviews section is hidden on the storefront",
      example: true,
    }),
    otpEnabled: z.boolean().openapi({
      description:
        "When true, storefront checkout requires WhatsApp phone verification (dzverify). " +
        "True only when a store_otp_config row exists AND is enabled.",
      example: false,
    }),
    status: z.enum(["active", "inactive"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("StoreConfig");

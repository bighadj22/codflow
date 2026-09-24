/**
 * Landing Page Schemas
 *
 * The one-product marketing pages: image stack + COD form.
 */

import { z } from "@hono/zod-openapi";

export const LandingPageStatusEnum = z.enum(["draft", "published", "archived"]);

export const LandingPageStatsSchema = z
  .object({
    views: z.number().int().min(0).openapi({ example: 1240 }),
    orders: z.number().int().min(0).openapi({ example: 36 }),
    revenue: z.number().min(0).openapi({
      description: "Sum of attributed order prices in DZD",
      example: 180000,
    }),
  })
  .openapi("LandingPageStats");

export const LandingPageImageSchema = z
  .object({
    id: z.string().openapi({ example: "lpimg_abc123" }),
    landingPageId: z.string().openapi({ example: "lp_abc123" }),
    r2Key: z.string().openapi({
      description: "R2 object key under the landing/ namespace",
      example: "landing/abc123def456.jpg",
    }),
    src: z.string().openapi({
      description: "Public URL of the image",
      example: "https://media.codflow.store/landing/abc123.jpg",
    }),
    altText: z.string().nullable().openapi({
      description: "Alt text for accessibility",
      example: "Samsung A55 — عرض خاص",
    }),
    source: z.enum(["upload", "ai"]).openapi({
      description: "How the image entered the stack (AI generation is a future phase)",
      example: "upload",
    }),
    position: z.number().int().min(1).openapi({
      description: "Stack order (1 = top of the page)",
      example: 1,
    }),
    width: z.number().int().nullable().openapi({
      description: "Intrinsic pixel width — the storefront reserves this space to prevent layout shift; null on legacy rows",
      example: 1080,
    }),
    height: z.number().int().nullable().openapi({
      description: "Intrinsic pixel height — the storefront reserves this space to prevent layout shift; null on legacy rows",
      example: 1350,
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("LandingPageImage");

const productRef = z
  .object({
    id: z.string().openapi({ example: "prod_abc123" }),
    name: z.string().openapi({ example: "Samsung Galaxy A55" }),
    handle: z.string().openapi({ example: "samsung-galaxy-a55" }),
    price: z.number().openapi({
      description: "Catalog price in DZD — the price the LP charges (no override)",
      example: 65000,
    }),
  })
  .nullable();

export const LandingPageSchema = z
  .object({
    id: z.string().openapi({ example: "lp_abc123" }),
    slug: z.string().openapi({
      description: "Public URL identifier — /lp/<slug>",
      example: "lp-9f3a2b1c",
    }),
    name: z.string().openapi({
      description: "Internal label, never rendered publicly",
      example: "Zinc v3 — carousel ad",
    }),
    productId: z.string().openapi({ example: "prod_abc123" }),
    status: LandingPageStatusEnum.openapi({
      description: "draft → published → archived. Only published pages resolve publicly.",
      example: "published",
    }),
    imageGap: z.number().int().min(0).max(200).openapi({
      description: "Pixels between stacked images — the only spacing setting",
      example: 0,
    }),
    metaTitle: z.string().nullable().openapi({ example: "Samsung A55 — عرض خاص" }),
    metaDescription: z.string().nullable().openapi({ example: "اطلب الآن — الدفع عند الاستلام" }),
    views: z.number().int().min(0).openapi({ example: 1240 }),
    publicUrl: z.string().openapi({
      description:
        "The shareable storefront URL (from the store's domain, or the deployment's storefront fallback; relative /lp/<slug> when neither is set)",
      example: "https://demo.codflow.store/lp/lp-9f3a2b1c",
    }),
    publishedAt: z.string().datetime().nullable().openapi({ example: null }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    images: z.array(LandingPageImageSchema).openapi({
      description: "The image stack, ordered by position (1 = top)",
    }),
    product: productRef.openapi({
      description: "The single product this page sells",
    }),
    stats: LandingPageStatsSchema,
  })
  .openapi("LandingPage");

export const LandingPageListItemSchema = z
  .object({
    id: z.string().openapi({ example: "lp_abc123" }),
    slug: z.string().openapi({ example: "lp-9f3a2b1c" }),
    name: z.string().openapi({ example: "Zinc v3 — carousel ad" }),
    status: LandingPageStatusEnum,
    productId: z.string().openapi({ example: "prod_abc123" }),
    productName: z.string().nullable().openapi({ example: "Samsung Galaxy A55" }),
    productHandle: z.string().nullable().openapi({ example: "samsung-galaxy-a55" }),
    imageCount: z.number().int().min(0).openapi({ example: 7 }),
    views: z.number().int().min(0).openapi({ example: 1240 }),
    orders: z.number().int().min(0).openapi({ example: 36 }),
    revenue: z.number().min(0).openapi({ example: 180000 }),
    publicUrl: z.string().openapi({
      description: "The shareable storefront URL for this page",
      example: "https://demo.codflow.store/lp/lp-9f3a2b1c",
    }),
    publishedAt: z.string().datetime().nullable().openapi({ example: null }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    tracking: z
      .object({
        pixelId: z.string().openapi({ example: "1234567890123456" }),
        conversionEvent: z.enum(["Lead", "Purchase", "Purchase_Confirmed", "Purchase_Delivered"]),
        enabled: z.boolean(),
        testMode: z.boolean(),
      })
      .nullable()
      .openapi({
        description:
          "This page's own pixel, or null when it inherits the store's. Enough to badge a list row; the access token is never included. Whether it is actually in force also depends on the store's per-page tracking switch.",
      }),
  })
  .openapi("LandingPageListItem");

/**
 * A landing page's own Meta Pixel + Conversions API configuration, which
 * REPLACES the store's for that page's visitors and orders. Absent (null) for
 * a page that inherits the store pixel, which is the default for every page.
 *
 * The access token is write-only: it is accepted on save and returned only as
 * a masked hint.
 */
export const LandingPageTrackingSchema = z
  .object({
    id: z.string().openapi({ example: "lppc_abc123" }),
    landingPageId: z.string().openapi({ example: "lp_abc123" }),
    pixelId: z.string().openapi({
      description: "The Meta Pixel this page reports to. Public by definition — it appears in the page source.",
      example: "1234567890123456",
    }),
    adAccountName: z.string().nullable().openapi({
      description: "The merchant's own label for the ad account. Reference only, never sent to Meta.",
      example: "Zinc — scaling",
    }),
    accessTokenMasked: z.string().openapi({
      description: "Last four characters of the stored Conversions API token. The token itself never leaves the server.",
      example: "••••x9Kq",
    }),
    testEventCode: z.string().nullable().openapi({ example: "TEST12345" }),
    conversionEvent: z
      .enum(["Lead", "Purchase", "Purchase_Confirmed", "Purchase_Delivered"])
      .openapi({
        description: "Which moment counts as a conversion for THIS page's campaigns — independent of the store's choice.",
        example: "Purchase",
      }),
    testMode: z.boolean().openapi({ example: false }),
    enabled: z.boolean().openapi({
      description: "Switched off returns the page to the store pixel without losing what was configured.",
      example: true,
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("LandingPageTracking");

/**
 * The most recent Conversions API attempt for an order this page produced —
 * proof for the merchant that a newly pointed campaign is actually reporting,
 * without opening Events Manager. Present for pages with no override too: such
 * a page still sells through the store pixel.
 */
export const LandingPageTrackingActivitySchema = z
  .object({
    eventName: z.string().openapi({ example: "Purchase" }),
    stage: z.string().openapi({
      description: "Which business moment produced it: checkout, confirmed, or delivered.",
      example: "delivered",
    }),
    status: z.string().openapi({
      description: "sent | failed | skipped | claimed",
      example: "sent",
    }),
    pixelId: z.string().nullable().openapi({
      description: "Which pixel it went to. Null only for rows written before this was recorded.",
      example: "1234567890123456",
    }),
    error: z.string().nullable().openapi({
      description: "Meta's own message when the attempt failed.",
      example: null,
    }),
    sentAt: z.string().openapi({ example: "2026-09-19T18:42:39.682Z" }),
  })
  .openapi("LandingPageTrackingActivity");

/** What a landing page's tracking panel reads: the configuration and the proof. */
export const LandingPageTrackingStateSchema = z
  .object({
    config: LandingPageTrackingSchema.nullable().openapi({
      description: "The page's own pixel, or null when it inherits the store's.",
    }),
    lastEvent: LandingPageTrackingActivitySchema.nullable().openapi({
      description: "The last Conversions API attempt for this page, or null when there has been none.",
    }),
  })
  .openapi("LandingPageTrackingState");

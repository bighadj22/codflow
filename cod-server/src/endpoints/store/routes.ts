/**
 * Store API Routes
 *
 * Public storefront surface (cod-astro/theme01). Authenticated globally via
 * storeAuthMiddleware (X-Store-API-Key) applied to /store/* in src/index.ts —
 * a different credential from the dashboard X-API-Key.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import * as h from "./handlers";
import { storeOrderSchema, storeReviewSchema, validateCartSchema } from "./validation";
import {
  StoreConfigSchema,
  StoreProductListSchema,
  StoreProductDetailSchema,
  StoreLandingPageSchema,
  StoreOrderTrackingSchema,
  StorePagePublicSchema,
  ProductCategoryRowSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const countEnvelope = <T extends z.ZodType>(itemSchema: T) =>
  jsonContent(
    z.object({
      success: z.boolean().openapi({ example: true }),
      data: z.array(itemSchema),
      count: z.number().int().openapi({ description: "Number of items in `data`" }),
    })
  );

// ─── Request schemas ──────────────────────────────────────────────────────────

const productsQuerySchema = z.object({
  featured: z.enum(["true", "false"]).optional().openapi({
    description: "When true, only return products where `storeFeatured=true`.",
  }),
  categoryId: z.string().optional().openapi({ description: "Filter by category ID." }),
  limit: z.coerce.number().int().max(100).default(24).openapi({
    description: "Maximum number of products to return. Server cap: 100.",
  }),
});

const handleParams = z.object({
  handle: z.string().openapi({ example: "samsung-galaxy-a54" }),
});

const lpSlugParams = z.object({
  slug: z.string().openapi({ example: "lp-9f3a2b1c" }),
});

const pageSlugParams = z.object({
  slug: z.string().openapi({ example: "refund-policy" }),
});

const wilayaIdParams = z.object({
  wilayaId: z.coerce.number().int().min(1).max(58).openapi({
    description: "Wilaya number (1–58).",
    example: 16,
  }),
});

const reviewsQuerySchema = z.object({
  productId: z.string().min(1).openapi({
    description: "Product ID to fetch reviews for.",
  }),
  limit: z.coerce.number().int().max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const reviewItemSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
});

// ─── Config ───────────────────────────────────────────────────────────────────

const getStoreConfigRoute = defineRoute({
  method: "get",
  path: "/config",
  auth: "store",
  tags: ["Store API"],
  summary: "Get store configuration",
  description:
    "Get store settings used by the storefront (theme, locale, branding).",
  operationId: "getStoreConfig",
  responses: {
    200: {
      description: "Store configuration",
      content: jsonContent(SuccessResponseSchema(StoreConfigSchema)),
    },
  },
  handler: h.getStoreConfig,
});

// ─── Catalog ──────────────────────────────────────────────────────────────────

const listStoreProductsRoute = defineRoute({
  method: "get",
  path: "/products",
  auth: "store",
  tags: ["Store API"],
  summary: "List store products",
  description:
    "Get the public product catalog for the storefront. Only returns products where `status=ACTIVE`, `showInStore=true`, `visibility=true`, and `deletedAt=null`.",
  operationId: "listStoreProducts",
  query: productsQuerySchema,
  responses: {
    200: {
      description: "List of products",
      content: countEnvelope(StoreProductListSchema),
    },
  },
  handler: h.listStoreProducts,
});

const getStoreProductRoute = defineRoute({
  method: "get",
  path: "/products/{handle}",
  auth: "store",
  tags: ["Store API"],
  summary: "Get store product",
  description:
    "Get a single product by its URL handle. Same visibility filters as the list endpoint. Returns parsed `variantOptions`, `tags`, joined `category`, active `variants`, all `images`, and `offers` — the active Buy X Get Y promotions currently applicable to this product.",
  operationId: "getStoreProduct",
  params: handleParams,
  responses: {
    200: {
      description: "Product details",
      content: jsonContent(SuccessResponseSchema(StoreProductDetailSchema)),
    },
  },
  handler: h.getStoreProduct,
});

const getStoreLandingPageRoute = defineRoute({
  method: "get",
  path: "/landing-pages/{slug}",
  auth: "store",
  tags: ["Store API"],
  summary: "Get published landing page",
  description:
    "Get a published landing page by its public slug: the ordered image stack, spacing settings, and the linked product in its full store-product shape (variants, offers, inventory) so the storefront order form works unmodified. Store-hidden products (`showInStore=false`) still render here — the landing page is their sales channel; the catalog list and the product's own page stay hidden. Draft/archived/unknown slugs return 404. Each successful GET increments the page's view counter (non-unique in v1).",
  operationId: "getStoreLandingPage",
  params: lpSlugParams,
  responses: {
    200: {
      description: "Published landing page with its product",
      content: jsonContent(SuccessResponseSchema(StoreLandingPageSchema)),
    },
    404: { description: "Landing page not found, draft, or archived" },
  },
  handler: h.getStoreLandingPage,
});

const getStorePageRoute = defineRoute({
  method: "get",
  path: "/pages/{slug}",
  auth: "store",
  tags: ["Store API"],
  summary: "Get a published store page",
  description:
    "Get a Terms/Privacy/Refund/Shipping/custom page by its public slug, resolved to the store's own language — the storefront serves exactly one locale per store (stores.lang). Falls back to the platform default locale, then to whichever locale exists, only when the store's own language has no translation for this page; the actual locale served is in the response's `locale` field. Draft or unknown slugs return 404 — never a soft 200 with empty content.",
  operationId: "getStorePage",
  params: pageSlugParams,
  responses: {
    200: {
      description: "The resolved page, already-sanitised HTML — render with set:html, never re-sanitise",
      content: jsonContent(SuccessResponseSchema(StorePagePublicSchema)),
    },
    404: { description: "Page not found, or exists only as a draft" },
  },
  handler: h.getStorePage,
});

const getStoreOrderTrackingRoute = defineRoute({
  method: "get",
  path: "/orders/{id}/tracking",
  auth: "store",
  tags: ["Store API"],
  summary: "Get an order's tracking destination",
  description: `Which Meta pixel this order belongs to, and which browser event the thank-you page should fire for it.

The thank-you page cannot work this out for itself: it knows the order id and nothing about which landing page the shopper came from, and landing-page attribution is best-effort — an unknown, draft or archived slug leaves the order unattributed. A browser deciding independently would fire at a pixel the Conversions API never mirrors to, and Meta deduplicates per pixel, so that produces two conversions in two ad accounts instead of one.

Returns the decision, not the configuration. \`event\` is null when no browser event should fire — either tracking is off, or the merchant's conversion fires further down the funnel (phone confirmation, delivery) from the server only.

Deliberately narrow: nothing about the order itself is returned, and never an access token.`,
  operationId: "getStoreOrderTracking",
  params: z.object({
    id: z.string().openapi({ description: "Order UUID", example: "ord_abc123" }),
  }),
  responses: {
    200: {
      description: "The order's tracking destination",
      content: jsonContent(SuccessResponseSchema(StoreOrderTrackingSchema)),
    },
    404: { description: "Order not found" },
  },
  handler: h.getStoreOrderTracking,
});

const listStoreCategoriesRoute = defineRoute({
  method: "get",
  path: "/categories",
  auth: "store",
  tags: ["Store API"],
  summary: "List store categories",
  description: "Get product categories ordered by position.",
  operationId: "listStoreCategories",
  responses: {
    200: {
      description: "List of categories",
      content: countEnvelope(ProductCategoryRowSchema),
    },
  },
  handler: h.listStoreCategories,
});

// ─── Shipping ─────────────────────────────────────────────────────────────────

const getShippingRatesRoute = defineRoute({
  method: "get",
  path: "/shipping-rates",
  auth: "store",
  tags: ["Store API"],
  summary: "Get shipping rates",
  description:
    "Per-wilaya shipping rates for the order form. Returns wilayas that have a rule in the default shipping profile; absent wilayas should be treated as unknown/unsupported.",
  operationId: "getShippingRates",
  responses: {
    200: {
      description: "Shipping rates keyed by wilaya ID (as string)",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.record(
            z.string(),
            z.object({
              home: z.number().openapi({
                description: "Home delivery price (DZD)",
                example: 400,
              }),
              stopDesk: z.number().openapi({
                description: "Stop-desk / post-office pickup price (DZD)",
                example: 350,
              }),
            })
          ),
        })
      ),
    },
  },
  handler: h.getShippingRates,
});

const communesRoute = defineRoute({
  method: "get",
  path: "/communes/{wilayaId}",
  auth: "store",
  tags: ["Store API"],
  summary: "List communes for a wilaya",
  description:
    "Get all communes for a given wilaya. Use the returned `id` as `communeId` when submitting an order.",
  operationId: "listStoreCommunes",
  params: wilayaIdParams,
  responses: {
    200: {
      description: "List of communes for the wilaya",
      content: countEnvelope(
        z.object({
          id: z.string().openapi({
            description: "Commune ID — use as `communeId` in POST /store/orders. Format is not UUID.",
            example: "c-16-001",
          }),
          name: z.string().openapi({ example: "Bab El Oued" }),
          nameAr: z.string().openapi({ example: "باب الوادي" }),
        })
      ),
    },
    400: { description: "Invalid wilaya ID — must be 1–58 (VALUE_OUT_OF_RANGE)" },
  },
  handler: h.listStoreCommunes,
});

// ─── Orders ───────────────────────────────────────────────────────────────────

const createStoreOrderRoute = defineRoute({
  method: "post",
  path: "/orders",
  auth: "store",
  tags: ["Store API"],
  summary: "Create store order",
  description: `Submit a customer order from the public storefront. Finds or creates the customer by phone number.

**Basket (\`items\`):** send \`items\` to order several products in one go — up to 20 distinct lines, each up to 100 units. Lines with the same product AND variant are merged and their quantities summed. When \`items\` is absent the flat \`productId\`/\`quantity\` fields are used, so existing integrations are unaffected.

**Pricing is server-authoritative.** \`pricePerUnit\` is accepted for UI continuity and never trusted; every line is priced from the catalog row.

**All or nothing.** If any line cannot be satisfied — insufficient stock, missing SKU — the whole order is refused and nothing is written.

**Delivery fee** is resolved per basket: a product's own shipping profile overrides the store default, a commune-level override beats the wilaya rule, and a basket spanning two profiles pays the highest applicable rate. Delivery is refused (not silently free) when any product cannot be shipped to the destination.

**Offer selection:** send \`offerId\` to explicitly select the tier the customer chose. It is honoured only if it independently qualifies; otherwise the server picks the highest \`triggerQuantity\` actually satisfied. Trigger quantity counts a product across all its lines, so two variants of one shirt are two shirts.

**Buy X Get Y (\`discountType: "free"\`):** the reward product is appended as a \`$0\` line item. If the reward stock is unavailable, the offer is silently skipped and the order still succeeds. Reward lines never trigger further offers.

**Free Shipping (\`discountType: "free_shipping"\`):** the delivery fee is overridden to 0 — reflected in both \`deliveryFee\` and \`total\`. This applies only when the basket holds a **single distinct product**; in a multi-product basket free delivery is earned by the store's basket threshold instead, so one cheap promotional item cannot ship an expensive basket for free.

**Multi-unit variant orders:** when different variants are selected per unit, send \`variantSelections\` — one entry per unit. Identical variants are grouped into a single line and inventory deducts per-variant.`,
  operationId: "createStoreOrder",
  body: storeOrderSchema,
  responses: {
    201: {
      description: "Order created",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            orderId: z.string(),
            orderNumber: z.string().openapi({ example: "ORD-20260327-0042" }),
            price: z.number(),
            deliveryFee: z.number(),
            total: z.number().openapi({ description: "price + deliveryFee (after any offer)" }),
          }),
        })
      ),
    },
    404: { description: "Referenced SKU/product record missing (REQUIRED_FIELD_MISSING)" },
    422: {
      description:
        "Insufficient stock (INSUFFICIENT_STOCK) or missing SKU before accepting orders",
    },
  },
  handler: h.createStoreOrder,
});

// ─── Cart ─────────────────────────────────────────────────────────────────────

const validateCartRoute = defineRoute({
  method: "post",
  path: "/cart/validate",
  auth: "store",
  tags: ["Store API"],
  summary: "Re-price and check a basket",
  description: [
    "Read-only. Returns what the catalog says about a basket right now, so the cart can show the truth before the shopper commits. Nothing is written and no stock is reserved.",
    "",
    "Every line comes back with its CURRENT catalog price, the units still available (`maxQuantity`, null when the product is not stock-tracked), and a `blocker` when it cannot be ordered as requested:",
    "",
    "- `missing`: the product no longer exists",
    "- `unlisted`: it is no longer on sale (draft, hidden or removed)",
    "- `out_of_stock`: fewer units are available than requested",
    "",
    "Blocked lines are excluded from `subtotal`, from offer evaluation and from the free-delivery calculation, so the basket never promises something checkout would refuse.",
    "",
    "`freeDelivery` is subtotal-based and therefore answerable before the shopper types an address: use `remaining` for a \"spend X more\" prompt. The delivery fee itself depends on the wilaya and is resolved at checkout.",
  ].join("\n"),
  operationId: "validateStoreCart",
  body: validateCartSchema,
  responses: {
    200: {
      description: "Basket priced and checked against the live catalog",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            lines: z.array(
              z.object({
                productId: z.string(),
                variantId: z.string().nullable(),
                variantLabel: z.string().nullable(),
                productName: z.string(),
                quantity: z.number().int(),
                unitPrice: z.number(),
                lineTotal: z.number(),
                maxQuantity: z.number().int().nullable(),
                blocker: z
                  .enum(["missing", "unlisted", "out_of_stock"])
                  .nullable(),
              }),
            ),
            subtotal: z.number(),
            rewards: z.array(
              z.object({
                offerId: z.string(),
                productId: z.string().nullable(),
                productName: z.string().nullable(),
                quantity: z.number().int(),
              }),
            ),
            freeDelivery: z.object({
              fromOffer: z.boolean(),
              threshold: z.number().int().nullable(),
              qualified: z.boolean(),
              remaining: z.number(),
            }),
          }),
        }),
      ),
    },
    400: { description: "Basket exceeds its bounds (VALUE_OUT_OF_RANGE)" },
  },
  handler: h.validateCart,
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

const listStoreReviewsRoute = defineRoute({
  method: "get",
  path: "/reviews",
  auth: "store",
  tags: ["Store API"],
  summary: "List approved reviews for a product",
  description:
    "Get approved product reviews for the storefront. Returns only reviews with `status=approved`.",
  operationId: "listStoreReviews",
  query: reviewsQuerySchema,
  responses: {
    200: {
      description: "List of approved reviews",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(reviewItemSchema),
          count: z.number().int(),
          total: z.number().int().openapi({
            description: "Total approved reviews for this product",
          }),
        })
      ),
    },
    400: { description: "productId is required (REQUIRED_FIELD_MISSING)" },
  },
  handler: h.listProductReviews,
});

const submitStoreReviewRoute = defineRoute({
  method: "post",
  path: "/reviews",
  auth: "store",
  tags: ["Store API"],
  summary: "Submit a product review",
  description: `Submit a product review from the storefront.

**Identifier (important):** the request takes the customer-facing **order number** (\`ORD-YYYYMMDD-NNNN\`) — the same value shown on the thank-you page — not the internal UUID. The server resolves it to the underlying order internally before writing the review row.

Identity is derived from the resolved order — no customer login required. One review per order: a second submission returns **409 ORDER_ALREADY_REVIEWED**. Reviews are created with \`status=pending\` and require merchant approval before appearing publicly.`,
  operationId: "submitStoreReview",
  body: storeReviewSchema,
  responses: {
    201: {
      description: "Review submitted (pending moderation)",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({ id: z.string() }),
        })
      ),
    },
    404: { description: "No order in this store matches the supplied order number" },
    409: { description: "A review has already been submitted for this order (ORDER_ALREADY_REVIEWED)" },
  },
  handler: h.submitReview,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(getStoreConfigRoute.route, getStoreConfigRoute.handler);
router.openapi(listStoreProductsRoute.route, listStoreProductsRoute.handler);
router.openapi(getStoreProductRoute.route, getStoreProductRoute.handler);
router.openapi(getStoreLandingPageRoute.route, getStoreLandingPageRoute.handler);
router.openapi(getStorePageRoute.route, getStorePageRoute.handler);
router.openapi(getStoreOrderTrackingRoute.route, getStoreOrderTrackingRoute.handler);
router.openapi(listStoreCategoriesRoute.route, listStoreCategoriesRoute.handler);
router.openapi(getShippingRatesRoute.route, getShippingRatesRoute.handler);
router.openapi(communesRoute.route, communesRoute.handler);
router.openapi(createStoreOrderRoute.route, createStoreOrderRoute.handler);
router.openapi(validateCartRoute.route, validateCartRoute.handler);
router.openapi(listStoreReviewsRoute.route, listStoreReviewsRoute.handler);
router.openapi(submitStoreReviewRoute.route, submitStoreReviewRoute.handler);

export default router;

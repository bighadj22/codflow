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
import { storeOrderSchema, storeReviewSchema } from "./validation";
import {
  StoreConfigSchema,
  StoreProductListSchema,
  StoreProductDetailSchema,
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
  description: `Submit a customer order from the public storefront. Finds or creates the customer by phone number. Delivery fee is resolved from the default shipping profile.

**Offer selection:** send \`offerId\` to explicitly select the tier the customer chose. The server validates the offer is still active and the quantity qualifies; otherwise it falls back to auto-detecting the best applicable offer. Without \`offerId\`, the server picks the highest \`triggerQuantity\` satisfied.

**Buy X Get Y (\`discountType: "free"\`):** the reward product is appended as a \`$0\` line item. If the reward stock is unavailable, the offer is silently skipped and the order still succeeds.

**Free Shipping (\`discountType: "free_shipping"\`):** the delivery fee is overridden to 0 — reflected in both \`deliveryFee\` and \`total\`.

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
router.openapi(listStoreCategoriesRoute.route, listStoreCategoriesRoute.handler);
router.openapi(getShippingRatesRoute.route, getShippingRatesRoute.handler);
router.openapi(communesRoute.route, communesRoute.handler);
router.openapi(createStoreOrderRoute.route, createStoreOrderRoute.handler);
router.openapi(listStoreReviewsRoute.route, listStoreReviewsRoute.handler);
router.openapi(submitStoreReviewRoute.route, submitStoreReviewRoute.handler);

export default router;

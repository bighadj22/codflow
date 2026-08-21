/**
 * Stock Routes
 *
 * Inventory tracking, movement logging, and stock health monitoring.
 * Split across two routers by mount point (both mounted in src/index.ts):
 *   - stockRouter         → /api/stock/*          (overview, alerts)
 *   - productStockRouter  → /api/products/*       (adjust/history/threshold
 *     for simple products and variants, nested under the product path)
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import {
  adjustStockSchema,
  updateThresholdSchema,
  stockHistoryFiltersSchema,
  stockAlertsFiltersSchema,
} from "./validation";
import {
  StockMovementSchema,
  StockAlertItemSchema,
  StockOverviewSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const idParams = z.object({
  id: z.string().openapi({ description: "Product ID", example: "prod_abc123" }),
});

const variantIdParams = z.object({
  productId: z.string().openapi({ description: "Product ID", example: "prod_abc123" }),
  variantId: z.string().openapi({ description: "Variant ID", example: "var_abc123" }),
});

const adjustResponse = jsonContent(
  z.object({
    success: z.boolean().openapi({ example: true }),
    data: z.object({
      movement: StockMovementSchema,
      currentInventory: z.number().int().openapi({
        description: "Inventory level after the adjustment.",
        example: 15,
      }),
    }),
  })
);

const thresholdBody = jsonContent(updateThresholdSchema);
const adjustBody = jsonContent(adjustStockSchema);

// ─── /api/stock/* ─────────────────────────────────────────────────────────────

const getStockOverviewRoute = createRoute({
  method: "get",
  path: "/overview",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Stock"],
  summary: "Stock overview",
  description:
    "Returns aggregated inventory health metrics across all tracked SKUs. Includes counters, total inventory value, and segmented lists of out-of-stock and low-stock items.",
  operationId: "getStockOverview",
  responses: {
    200: {
      description: "Stock health overview",
      content: jsonContent(SuccessResponseSchema(StockOverviewSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires products:read"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getStockAlertsRoute = createRoute({
  method: "get",
  path: "/alerts",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Stock"],
  summary: "Low stock and out-of-stock alerts",
  description:
    "Paginated list of all SKUs at or below their low stock threshold (includes out-of-stock). Sorted: out-of-stock first, then by inventory ascending.",
  operationId: "getStockAlerts",
  request: {
    query: stockAlertsFiltersSchema,
  },
  responses: {
    200: {
      description: "Paginated alert items",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            items: z.array(StockAlertItemSchema),
            total: z.number().int().openapi({
              description: "Total alert items (for pagination).",
              example: 10,
            }),
          }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires products:read"),
  },
  security: [{ ApiKeyAuth: [] }],
});

export const stockRouter = new OpenAPIHono<AppContext>();
stockRouter.openapi(getStockOverviewRoute, h.getStockOverview);
stockRouter.openapi(getStockAlertsRoute, h.getStockAlerts);

// ─── Simple-product stock (/api/products/{id}/stock/*) ───────────────────────

const adjustProductStockRoute = createRoute({
  method: "post",
  path: "/{id}/stock/adjust",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Stock"],
  summary: "Adjust stock for a simple product",
  description:
    "Applies a signed integer delta to a simple product's inventory and appends a movement log entry.\n\n" +
    "**`reason` is required for types:** `ADJUSTMENT_ADD`, `ADJUSTMENT_REMOVE`, `OFFLINE_SALE`.\n\n" +
    "**Delta sign convention:** positive = stock arriving, negative = stock leaving. The server rejects adjustments that would result in negative inventory (HTTP 422).",
  operationId: "adjustProductStock",
  request: {
    params: idParams,
    body: {
      required: true,
      content: adjustBody,
    },
  },
  responses: {
    200: {
      description: "Stock adjusted successfully",
      content: adjustResponse,
    },
    400: errorResponse("Validation error — invalid type, zero delta, or missing reason (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires products:manage"),
    404: errorResponse("Product not found (PRODUCT_NOT_FOUND)"),
    422: errorResponse(
      "Adjustment would result in negative inventory (INSUFFICIENT_STOCK). Context includes `stockId`, `productName`, `available`, and `required`."
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getProductStockHistoryRoute = createRoute({
  method: "get",
  path: "/{id}/stock/history",
  middleware: [requireScope(SCOPES.PRODUCTS_READ)],
  tags: ["Stock"],
  summary: "Stock movement history for a product",
  description:
    "Paginated movement log for a product. Use `variantId` to narrow to a specific variant's history. Results are ordered newest-first.",
  operationId: "getProductStockHistory",
  request: {
    params: idParams,
    query: stockHistoryFiltersSchema,
  },
  responses: {
    200: {
      description: "Paginated movement history",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            movements: z.array(StockMovementSchema),
            total: z.number().int().openapi({
              description: "Total matching movements (for pagination).",
              example: 25,
            }),
          }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires products:read"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateProductThresholdRoute = createRoute({
  method: "patch",
  path: "/{id}/stock/threshold",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Stock"],
  summary: "Update low stock threshold for a simple product",
  description:
    "Sets the `lowStockThreshold` for a simple (non-variant) product. When inventory drops at or below this value, the product appears in stock alerts.",
  operationId: "updateProductThreshold",
  request: {
    params: idParams,
    body: {
      required: true,
      content: thresholdBody,
    },
  },
  responses: {
    200: {
      description: "Threshold updated",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    400: errorResponse("Validation error — non-integer, negative value, or value > 9999 (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires products:manage"),
    404: errorResponse("Product not found (PRODUCT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

// ─── Variant-level stock (/api/products/{productId}/variants/{variantId}/stock/*)

const adjustVariantStockRoute = createRoute({
  method: "post",
  path: "/{productId}/variants/{variantId}/stock/adjust",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Stock"],
  summary: "Adjust stock for a product variant",
  description:
    "Same semantics as the simple-product adjust endpoint but targets a specific variant. The `variantId` must belong to `productId`.",
  operationId: "adjustVariantStock",
  request: {
    params: variantIdParams,
    body: {
      required: true,
      content: adjustBody,
    },
  },
  responses: {
    200: {
      description: "Variant stock adjusted",
      content: adjustResponse,
    },
    400: errorResponse("Validation error — invalid type, zero delta, or missing reason (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires products:manage"),
    404: errorResponse("Variant not found or does not belong to the given product (VARIANT_NOT_FOUND)"),
    422: errorResponse("Adjustment would result in negative inventory (INSUFFICIENT_STOCK)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateVariantThresholdRoute = createRoute({
  method: "patch",
  path: "/{productId}/variants/{variantId}/stock/threshold",
  middleware: [requireScope(SCOPES.PRODUCTS_MANAGE)],
  tags: ["Stock"],
  summary: "Update low stock threshold for a variant",
  description:
    "Sets the `lowStockThreshold` for a specific product variant. The variant must belong to the specified product.",
  operationId: "updateVariantThreshold",
  request: {
    params: variantIdParams,
    body: {
      required: true,
      content: thresholdBody,
    },
  },
  responses: {
    200: {
      description: "Threshold updated",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    400: errorResponse("Validation error — non-integer, negative value, or value > 9999 (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires products:manage"),
    404: errorResponse("Variant not found or does not belong to the given product (VARIANT_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

export const productStockRouter = new OpenAPIHono<AppContext>();
productStockRouter.openapi(adjustProductStockRoute, h.adjustProductStock);
productStockRouter.openapi(getProductStockHistoryRoute, h.getProductStockHistory);
productStockRouter.openapi(updateProductThresholdRoute, h.updateProductThreshold);
productStockRouter.openapi(adjustVariantStockRoute, h.adjustVariantStock);
productStockRouter.openapi(updateVariantThresholdRoute, h.updateVariantThreshold);

/**
 * Stock Routes
 *
 * Inventory tracking, movement logging, and stock health monitoring.
 * Split across two routers by mount point (both mounted in src/index.ts):
 *   - stockRouter         → /api/stock/*          (overview, alerts)
 *   - productStockRouter  → /api/products/*       (adjust/history/threshold
 *     for simple products and variants, nested under the product path)
 *
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
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
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
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

// ─── /api/stock/* ─────────────────────────────────────────────────────────────

const getStockOverviewRoute = defineRoute({
  method: "get",
  path: "/overview",
  auth: { scope: SCOPES.PRODUCTS_READ },
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
  },
  handler: h.getStockOverview,
});

const getStockAlertsRoute = defineRoute({
  method: "get",
  path: "/alerts",
  auth: { scope: SCOPES.PRODUCTS_READ },
  tags: ["Stock"],
  summary: "Low stock and out-of-stock alerts",
  description:
    "Paginated list of all SKUs at or below their low stock threshold (includes out-of-stock). Sorted: out-of-stock first, then by inventory ascending.",
  operationId: "getStockAlerts",
  query: stockAlertsFiltersSchema,
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
  },
  handler: h.getStockAlerts,
});

export const stockRouter = new OpenAPIHono<AppContext>();
stockRouter.openapi(getStockOverviewRoute.route, getStockOverviewRoute.handler);
stockRouter.openapi(getStockAlertsRoute.route, getStockAlertsRoute.handler);

// ─── Simple-product stock (/api/products/{id}/stock/*) ───────────────────────

const adjustProductStockRoute = defineRoute({
  method: "post",
  path: "/{id}/stock/adjust",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Stock"],
  summary: "Adjust stock for a simple product",
  description:
    "Applies a signed integer delta to a simple product's inventory and appends a movement log entry.\n\n" +
    "**`reason` is required for types:** `ADJUSTMENT_ADD`, `ADJUSTMENT_REMOVE`, `OFFLINE_SALE`.\n\n" +
    "**Delta sign convention:** positive = stock arriving, negative = stock leaving. The server rejects adjustments that would result in negative inventory (HTTP 422).",
  operationId: "adjustProductStock",
  params: idParams,
  body: adjustStockSchema,
  responses: {
    200: {
      description: "Stock adjusted successfully",
      content: adjustResponse,
    },
    422: {
      description:
        "Adjustment would result in negative inventory (INSUFFICIENT_STOCK). Context includes `stockId`, `productName`, `available`, and `required`.",
    },
  },
  handler: h.adjustProductStock,
});

const getProductStockHistoryRoute = defineRoute({
  method: "get",
  path: "/{id}/stock/history",
  auth: { scope: SCOPES.PRODUCTS_READ },
  tags: ["Stock"],
  summary: "Stock movement history for a product",
  description:
    "Paginated movement log for a product. Use `variantId` to narrow to a specific variant's history. Results are ordered newest-first.",
  operationId: "getProductStockHistory",
  params: idParams,
  query: stockHistoryFiltersSchema,
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
  },
  handler: h.getProductStockHistory,
});

const updateProductThresholdRoute = defineRoute({
  method: "patch",
  path: "/{id}/stock/threshold",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Stock"],
  summary: "Update low stock threshold for a simple product",
  description:
    "Sets the `lowStockThreshold` for a simple (non-variant) product. When inventory drops at or below this value, the product appears in stock alerts.",
  operationId: "updateProductThreshold",
  params: idParams,
  body: updateThresholdSchema,
  responses: {
    200: {
      description: "Threshold updated",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: h.updateProductThreshold,
});

// ─── Variant-level stock (/api/products/{productId}/variants/{variantId}/stock/*)

const adjustVariantStockRoute = defineRoute({
  method: "post",
  path: "/{productId}/variants/{variantId}/stock/adjust",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Stock"],
  summary: "Adjust stock for a product variant",
  description:
    "Same semantics as the simple-product adjust endpoint but targets a specific variant. The `variantId` must belong to `productId`.",
  operationId: "adjustVariantStock",
  params: variantIdParams,
  body: adjustStockSchema,
  responses: {
    200: {
      description: "Variant stock adjusted",
      content: adjustResponse,
    },
    422: { description: "Adjustment would result in negative inventory (INSUFFICIENT_STOCK)" },
  },
  handler: h.adjustVariantStock,
});

const updateVariantThresholdRoute = defineRoute({
  method: "patch",
  path: "/{productId}/variants/{variantId}/stock/threshold",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Stock"],
  summary: "Update low stock threshold for a variant",
  description:
    "Sets the `lowStockThreshold` for a specific product variant. The variant must belong to the specified product.",
  operationId: "updateVariantThreshold",
  params: variantIdParams,
  body: updateThresholdSchema,
  responses: {
    200: {
      description: "Threshold updated",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: h.updateVariantThreshold,
});

export const productStockRouter = new OpenAPIHono<AppContext>();
productStockRouter.openapi(adjustProductStockRoute.route, adjustProductStockRoute.handler);
productStockRouter.openapi(getProductStockHistoryRoute.route, getProductStockHistoryRoute.handler);
productStockRouter.openapi(updateProductThresholdRoute.route, updateProductThresholdRoute.handler);
productStockRouter.openapi(adjustVariantStockRoute.route, adjustVariantStockRoute.handler);
productStockRouter.openapi(updateVariantThresholdRoute.route, updateVariantThresholdRoute.handler);

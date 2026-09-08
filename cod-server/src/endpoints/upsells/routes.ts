/**
 * Product Upsells Routes
 *
 * Admin endpoints to attach other products as upsell offers on a product.
 * Assignments are priced server-side (assignment override ?? product price for
 * simple products; first active variant price for variant products) and are
 * surfaced at storefront checkout only when `isActive` is true.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import { createUpsellSchema, updateUpsellSchema } from "./validation";
import {
  ProductUpsellSchema,
  ListResponseSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const upsellParams = z.object({
  productId: z.string().openapi({ description: "Parent product UUID", example: "prod_abc123" }),
});

const upsellItemParams = upsellParams.extend({
  upsellId: z.string().openapi({ description: "Upsell assignment UUID", example: "up_abc123" }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listProductUpsellsRoute = defineRoute({
  method: "get",
  path: "/{productId}/upsells",
  auth: { scope: SCOPES.PRODUCTS_READ },
  tags: ["Product Upsells"],
  summary: "List product upsells",
  description:
    "Get the upsell assignments attached to a product, resolved with the effective offer price (assignment override ?? product price for simple products; first active variant price for variant products).",
  operationId: "listProductUpsells",
  params: upsellParams,
  responses: {
    200: {
      description: "List of product upsell assignments",
      content: jsonContent(ListResponseSchema(ProductUpsellSchema)),
    },
  },
  handler: h.listProductUpsells,
});

const createProductUpsellRoute = defineRoute({
  method: "post",
  path: "/{productId}/upsells",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Product Upsells"],
  summary: "Create product upsell",
  description: `Attach another product as an upsell offer on this product.

- The parent product cannot upsell itself.
- Only one assignment per (product, upsell product) pair — a duplicate returns 409.
- Price overrides apply to simple products only; variant products always use the first active variant's price.`,
  operationId: "createProductUpsell",
  params: upsellParams,
  body: createUpsellSchema,
  responses: {
    201: {
      description: "Upsell created — returns the full updated assignment list",
      content: jsonContent(ListResponseSchema(ProductUpsellSchema)),
    },
  },
  handler: h.createProductUpsell,
});

const updateProductUpsellRoute = defineRoute({
  method: "patch",
  path: "/{productId}/upsells/{upsellId}",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Product Upsells"],
  summary: "Update product upsell",
  description:
    "Partially update an upsell assignment (price override, compare-at, active state, position). All fields are optional.",
  operationId: "updateProductUpsell",
  params: upsellItemParams,
  body: updateUpsellSchema,
  responses: {
    200: {
      description: "Updated — returns the full updated assignment list",
      content: jsonContent(ListResponseSchema(ProductUpsellSchema)),
    },
  },
  handler: h.updateProductUpsell,
});

const deleteProductUpsellRoute = defineRoute({
  method: "delete",
  path: "/{productId}/upsells/{upsellId}",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Product Upsells"],
  summary: "Delete product upsell",
  description:
    "Remove an upsell assignment. Placed orders are not affected.",
  operationId: "deleteProductUpsell",
  params: upsellItemParams,
  responses: {
    200: {
      description: "Deleted — returns the remaining assignment list",
      content: jsonContent(ListResponseSchema(ProductUpsellSchema)),
    },
  },
  handler: h.deleteProductUpsell,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listProductUpsellsRoute.route, listProductUpsellsRoute.handler);
router.openapi(createProductUpsellRoute.route, createProductUpsellRoute.handler);
router.openapi(updateProductUpsellRoute.route, updateProductUpsellRoute.handler);
router.openapi(deleteProductUpsellRoute.route, deleteProductUpsellRoute.handler);

export default router;
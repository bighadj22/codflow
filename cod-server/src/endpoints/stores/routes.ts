/**
 * Stores (Management) Routes
 *
 * Dashboard endpoints for reading and updating the store configuration and
 * Meta pixel tracking config. Single-tenant: the store is resolved from the
 * D1 database, not from the path. All routes are admin-only (requireAdmin).
 *
 * Not to be confused with /api/store/* — the public storefront API.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireAdmin } from "@/rbac/middleware";
import * as handlers from "./handlers";
import {
  StoreSchema,
  StorePixelConfigSchema,
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

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid hex color");

const getMyStoreRoute = createRoute({
  method: "get",
  path: "/me",
  middleware: [requireAdmin()],
  tags: ["Store Settings"],
  summary: "Get store configuration",
  description:
    "Returns the current store's configuration including branding, theme, localization, SEO, and storefront settings.",
  operationId: "getMyStore",
  responses: {
    200: {
      description: "Store configuration",
      content: jsonContent(SuccessResponseSchema(StoreSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("Store not found (code: STORE_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateMyStoreRoute = createRoute({
  method: "patch",
  path: "/me",
  middleware: [requireAdmin()],
  tags: ["Store Settings"],
  summary: "Update store configuration",
  description:
    "Partially updates the store configuration. All fields are optional — only include the fields you want to change. Set nullable fields to `null` to clear them.",
  operationId: "updateMyStore",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
          name: z.string().min(1).max(100).optional(),
          logoUrl: z.string().url().nullable().optional(),
          primaryColor: hexColor.optional(),
          accentColor: hexColor.optional(),
          bgColor: hexColor.optional(),
          fontFamily: z.string().min(1).max(200).optional(),
          fontUrl: z.string().url().nullable().optional(),
          lang: z.enum(["ar", "en"]).optional(),
          currencySymbol: z.string().min(1).max(10).optional(),
          contentJson: z.string().nullable().optional(),
          metaTitle: z.string().max(200).nullable().optional(),
          metaDescription: z.string().max(500).nullable().optional(),
          ogImage: z.string().url().nullable().optional(),
          announcementBar: z.string().max(500).nullable().optional(),
          reviewsEnabled: z.boolean().optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Updated store configuration",
      content: jsonContent(SuccessResponseSchema(StoreSchema)),
    },
    400: errorResponse("Validation error (e.g. invalid hex color)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("Store not found (code: STORE_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getPixelConfigRoute = createRoute({
  method: "get",
  path: "/pixel-config",
  middleware: [requireAdmin()],
  tags: ["Store Settings"],
  summary: "Get pixel configuration",
  description:
    "Returns the store's Meta pixel tracking configuration, or `null` when none has been configured yet.",
  operationId: "getPixelConfig",
  responses: {
    200: {
      description: "Pixel configuration (null when not configured)",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: StorePixelConfigSchema.nullable(),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("Store not found (code: STORE_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const savePixelConfigRoute = createRoute({
  method: "post",
  path: "/pixel-config",
  middleware: [requireAdmin()],
  tags: ["Store Settings"],
  summary: "Save pixel configuration",
  description:
    "Upserts the store's Meta pixel tracking configuration. Omitted optional fields fall back to defaults (`accessToken` empty, `enabled` true).",
  operationId: "savePixelConfig",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
          pixelId: z.string().min(1),
          accessToken: z.string().default(""),
          testEventCode: z.string().nullable().optional(),
          enabled: z.boolean().optional(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Saved pixel configuration",
      content: jsonContent(SuccessResponseSchema(StorePixelConfigSchema)),
    },
    400: errorResponse("Validation error (missing pixelId)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("Store not found (code: STORE_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(getMyStoreRoute, handlers.getMyStore);
router.openapi(updateMyStoreRoute, handlers.updateMyStore);
router.openapi(getPixelConfigRoute, handlers.getPixelConfig);
router.openapi(savePixelConfigRoute, handlers.savePixelConfig);

export default router;

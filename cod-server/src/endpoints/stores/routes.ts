/**
 * Stores (Management) Routes
 *
 * Dashboard endpoints for reading and updating the store configuration and
 * Meta pixel tracking config. Single-tenant: the store is resolved from the
 * D1 database, not from the path. All routes are admin-only.
 *
 * Not to be confused with /api/store/* — the public storefront API.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import * as handlers from "./handlers";
import {
  StoreSchema,
  StorePixelConfigSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid hex color");

// ─── Request schemas ──────────────────────────────────────────────────────────

const updateStoreBodySchema = z.object({
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
});

const savePixelBodySchema = z.object({
  pixelId: z.string().min(1),
  accessToken: z.string().default(""),
  testEventCode: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const getMyStoreRoute = defineRoute({
  method: "get",
  path: "/me",
  auth: "admin",
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
  },
  handler: handlers.getMyStore,
});

const updateMyStoreRoute = defineRoute({
  method: "patch",
  path: "/me",
  auth: "admin",
  tags: ["Store Settings"],
  summary: "Update store configuration",
  description:
    "Partially updates the store configuration. All fields are optional — only include the fields you want to change. Set nullable fields to `null` to clear them.",
  operationId: "updateMyStore",
  body: updateStoreBodySchema,
  responses: {
    200: {
      description: "Updated store configuration",
      content: jsonContent(SuccessResponseSchema(StoreSchema)),
    },
  },
  handler: handlers.updateMyStore,
});

const getPixelConfigRoute = defineRoute({
  method: "get",
  path: "/pixel-config",
  auth: "admin",
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
  },
  handler: handlers.getPixelConfig,
});

const savePixelConfigRoute = defineRoute({
  method: "post",
  path: "/pixel-config",
  auth: "admin",
  tags: ["Store Settings"],
  summary: "Save pixel configuration",
  description:
    "Upserts the store's Meta pixel tracking configuration. Omitted optional fields fall back to defaults (`accessToken` empty, `enabled` true).",
  operationId: "savePixelConfig",
  body: savePixelBodySchema,
  responses: {
    200: {
      description: "Saved pixel configuration",
      content: jsonContent(SuccessResponseSchema(StorePixelConfigSchema)),
    },
  },
  handler: handlers.savePixelConfig,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(getMyStoreRoute.route, getMyStoreRoute.handler);
router.openapi(updateMyStoreRoute.route, updateMyStoreRoute.handler);
router.openapi(getPixelConfigRoute.route, getPixelConfigRoute.handler);
router.openapi(savePixelConfigRoute.route, savePixelConfigRoute.handler);

export default router;

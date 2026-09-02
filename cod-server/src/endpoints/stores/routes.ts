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
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
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

// ─── WhatsApp OTP verification config (dzverify) ──────────────────────────────

const otpConfigResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      language: z.enum(["en", "fr", "ar"]),
      enabled: z.boolean(),
      apiKeyMasked: z.string().openapi({ example: "••••a9f2" }),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
    .nullable(),
});

const saveOtpConfigBodySchema = z.object({
  apiKey: z.string().default("").openapi({
    description:
      "dzverify API key. Empty string keeps the previously stored key (the key is never sent back to the client).",
  }),
  language: z.enum(["en", "fr", "ar"]).optional(),
  enabled: z.boolean().optional(),
});

const getOtpConfigRoute = defineRoute({
  method: "get",
  path: "/otp-config",
  auth: { scope: SCOPES.SETTINGS_VERIFICATION },
  tags: ["Store Settings"],
  summary: "Get WhatsApp OTP verification configuration",
  description:
    "Returns the store's dzverify OTP configuration, or `null` when never configured (verification disabled). The API key is never returned — only a masked hint.",
  operationId: "getOtpConfig",
  responses: {
    200: { description: "OTP configuration (null when not configured)", content: jsonContent(otpConfigResponse) },
  },
  handler: handlers.getOtpConfig,
});

const saveOtpConfigRoute = defineRoute({
  method: "post",
  path: "/otp-config",
  auth: { scope: SCOPES.SETTINGS_VERIFICATION },
  tags: ["Store Settings"],
  summary: "Save WhatsApp OTP verification configuration",
  description:
    "Upserts the store's dzverify OTP configuration. An empty `apiKey` keeps the stored key. Requires a key before enabling. No row = verification disabled (safe default).",
  operationId: "saveOtpConfig",
  body: saveOtpConfigBodySchema,
  responses: {
    200: { description: "Saved OTP configuration", content: jsonContent(otpConfigResponse) },
    400: { description: "No API key stored or submitted (REQUIRED_FIELD_MISSING)" },
  },
  handler: handlers.saveOtpConfig,
});

const testOtpConfigBodySchema = z.object({
  apiKey: z.string().optional().openapi({
    description: "Test this key instead of the stored one (pre-save validation).",
  }),
});

const testOtpConfigRoute = defineRoute({
  method: "post",
  path: "/otp-config/test",
  auth: { scope: SCOPES.SETTINGS_VERIFICATION },
  tags: ["Store Settings"],
  summary: "Test dzverify connection",
  description:
    "Checks the stored (or submitted) dzverify API key against the provider's quota endpoint. A key lacking the usage:read scope is reported as valid with quota unavailable. Negative outcomes return 200 with ok:false — the check itself succeeded.",
  operationId: "testOtpConnection",
  body: testOtpConfigBodySchema,
  responses: {
    200: {
      description: "Connection check executed",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          data: z.object({
            ok: z.boolean(),
            reason: z.string().optional(),
            message: z.string().optional(),
            balanceDa: z.number().optional(),
            otpEstimate: z.number().optional().openapi({ description: "How many more OTPs the balance covers" }),
            plan: z.string().optional(),
            outOfCredits: z.boolean().optional(),
          }),
        })
      ),
    },
    400: { description: "No API key stored or submitted (REQUIRED_FIELD_MISSING)" },
    502: { description: "dzverify unreachable (EXTERNAL_API_FAILURE)" },
  },
  handler: handlers.testOtpConnection,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(getMyStoreRoute.route, getMyStoreRoute.handler);
router.openapi(updateMyStoreRoute.route, updateMyStoreRoute.handler);
router.openapi(getPixelConfigRoute.route, getPixelConfigRoute.handler);
router.openapi(savePixelConfigRoute.route, savePixelConfigRoute.handler);
router.openapi(getOtpConfigRoute.route, getOtpConfigRoute.handler);
router.openapi(saveOtpConfigRoute.route, saveOtpConfigRoute.handler);
router.openapi(testOtpConfigRoute.route, testOtpConfigRoute.handler);

export default router;

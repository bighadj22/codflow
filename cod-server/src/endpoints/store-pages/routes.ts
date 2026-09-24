/**
 * Store Pages Routes
 *
 * Merchant management of Terms/Privacy/Refund/Shipping and custom content
 * pages. See report-md/LEGAL_PAGES_PLAN.md. Built with defineRoute().
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import {
  createCustomPageSchema,
  updateStorePageMetaSchema,
  saveTranslationSchema,
  upsertLegalProfileSchema,
} from "./validation";
import {
  StorePageSummarySchema,
  StorePageDetailSchema,
  StorePageTranslationBodySchema,
  StoreLegalProfileSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const idParams = z.object({
  id: z.string().openapi({ description: "Store Page UUID", example: "sp_abc123" }),
});

const translationParams = z.object({
  id: z.string().openapi({ description: "Store Page UUID", example: "sp_abc123" }),
  locale: z.enum(["ar", "en", "fr"]).openapi({ example: "ar" }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listStorePagesRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.STORE_PAGES_READ },
  tags: ["Store Pages"],
  summary: "List store pages",
  description:
    "Every page — the 4 seeded legal pages plus any custom pages — with per-locale title, source (template/merchant), and last-updated time.",
  operationId: "listStorePages",
  responses: {
    200: {
      description: "List of store pages",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(StorePageSummarySchema),
          count: z.number().int(),
        }),
      ),
    },
  },
  handler: h.listStorePages,
});

// Registered before "/{id}" — Hono's router matches static segments ahead of
// param segments regardless of order, but the explicit order also matches
// this repo's convention (landing-pages registers /compare before /{id}).
const getLegalProfileRoute = defineRoute({
  method: "get",
  path: "/legal-profile",
  auth: { scope: SCOPES.STORE_PAGES_READ },
  tags: ["Store Pages"],
  summary: "Get the legal profile",
  description:
    "The merchant facts (RC/NIF, contact, return and delivery windows) substituted into the legal templates. Never null-guarded on the client — an unset store returns an all-null row shape.",
  operationId: "getStoreLegalProfile",
  responses: {
    200: {
      description: "The legal profile, or null if never set",
      content: jsonContent(SuccessResponseSchema(StoreLegalProfileSchema.nullable())),
    },
  },
  handler: h.getLegalProfileHandler,
});

const upsertLegalProfileRoute = defineRoute({
  method: "put",
  path: "/legal-profile",
  auth: { scope: SCOPES.STORE_PAGES_MANAGE },
  tags: ["Store Pages"],
  summary: "Save the legal profile",
  description:
    "Partial update — send only the fields you want to change. Filling in a fact here does NOT retroactively edit already-seeded pages; use the reset endpoint per page to re-apply the template with the new facts.",
  operationId: "saveStoreLegalProfile",
  body: upsertLegalProfileSchema,
  responses: {
    200: {
      description: "Saved legal profile",
      content: jsonContent(SuccessResponseSchema(StoreLegalProfileSchema)),
    },
  },
  handler: h.upsertLegalProfileHandler,
});

const seedDefaultsRoute = defineRoute({
  method: "post",
  path: "/seed-defaults",
  auth: { scope: SCOPES.STORE_PAGES_MANAGE },
  tags: ["Store Pages"],
  summary: "Seed the 4 default legal pages",
  description:
    "Creates whichever of Terms/Privacy/Refund/Shipping this store does not already have. Idempotent — safe to call repeatedly; returns which kinds were newly created (empty array when all 4 already exist).",
  operationId: "seedStoreDefaultPages",
  responses: {
    200: {
      description: "Which kinds were created",
      content: jsonContent(
        SuccessResponseSchema(z.object({ created: z.array(z.string()) })),
      ),
    },
  },
  handler: h.seedDefaults,
});

const getStorePageRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.STORE_PAGES_READ },
  tags: ["Store Pages"],
  summary: "Get store page",
  description: "Full page detail: settings and the complete body for every locale that has been saved.",
  operationId: "getStorePage",
  params: idParams,
  responses: {
    200: {
      description: "Store page detail",
      content: jsonContent(SuccessResponseSchema(StorePageDetailSchema)),
    },
  },
  handler: h.getStorePage,
});

const createCustomPageRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.STORE_PAGES_MANAGE },
  tags: ["Store Pages"],
  summary: "Create a custom page",
  description:
    "Create a merchant-authored page (kind=custom) in one locale. Starts as a draft — publish it via PATCH. A taken slug returns 409.",
  operationId: "createCustomStorePage",
  body: createCustomPageSchema,
  responses: {
    201: {
      description: "Custom page created (draft)",
      content: jsonContent(SuccessResponseSchema(StorePageDetailSchema)),
    },
  },
  handler: h.createCustomPage,
});

const updateStorePageRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.STORE_PAGES_MANAGE },
  tags: ["Store Pages"],
  summary: "Update store page settings",
  description:
    "Partial update of slug, publish status, footer visibility, and footer position. To edit the page's words, use the translation endpoints. A taken slug returns 409.",
  operationId: "updateStorePage",
  params: idParams,
  body: updateStorePageMetaSchema,
  responses: {
    200: {
      description: "Store page updated",
      content: jsonContent(SuccessResponseSchema(StorePageDetailSchema)),
    },
  },
  handler: h.updateStorePage,
});

const deleteStorePageRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.STORE_PAGES_MANAGE },
  tags: ["Store Pages"],
  summary: "Delete a custom page",
  description:
    "Permanently delete a custom page. A legal page (terms/privacy/refund/shipping) cannot be deleted — unpublish it instead (PATCH status=draft). Refused with STORE_PAGE_CANNOT_DELETE_LEGAL otherwise.",
  operationId: "deleteStorePage",
  params: idParams,
  responses: {
    200: {
      description: "Page deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    422: { description: "Page is a legal kind and cannot be deleted (STORE_PAGE_CANNOT_DELETE_LEGAL)" },
  },
  handler: h.deleteStorePage,
});

const saveTranslationRoute = defineRoute({
  method: "put",
  path: "/{id}/translations/{locale}",
  auth: { scope: SCOPES.STORE_PAGES_MANAGE },
  tags: ["Store Pages"],
  summary: "Save a page's translation",
  description:
    "Save this page's title and body in one locale. The body is sanitised server-side (the same allow-list used for product descriptions) before it is stored — this is the only way to write a page's content. Marks this locale as merchant-reviewed (source=merchant).",
  operationId: "saveStorePageTranslation",
  params: translationParams,
  body: saveTranslationSchema,
  responses: {
    200: {
      description: "Saved translation",
      content: jsonContent(SuccessResponseSchema(StorePageTranslationBodySchema)),
    },
  },
  handler: h.saveTranslation,
});

const resetTranslationRoute = defineRoute({
  method: "post",
  path: "/{id}/translations/{locale}/reset",
  auth: { scope: SCOPES.STORE_PAGES_MANAGE },
  tags: ["Store Pages"],
  summary: "Reset a translation to the CodFlow template",
  description:
    "Discards whatever is currently saved for this locale and re-renders it from the current legal template and this store's legal profile. Only legal kinds have a template — called on a custom page it is refused with STORE_PAGE_NOT_LEGAL.",
  operationId: "resetStorePageTranslation",
  params: translationParams,
  responses: {
    200: {
      description: "Re-seeded translation",
      content: jsonContent(SuccessResponseSchema(StorePageTranslationBodySchema)),
    },
    422: { description: "Not a legal kind (STORE_PAGE_NOT_LEGAL)" },
  },
  handler: h.resetTranslation,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listStorePagesRoute.route, listStorePagesRoute.handler);
router.openapi(getLegalProfileRoute.route, getLegalProfileRoute.handler);
router.openapi(upsertLegalProfileRoute.route, upsertLegalProfileRoute.handler);
router.openapi(seedDefaultsRoute.route, seedDefaultsRoute.handler);
router.openapi(getStorePageRoute.route, getStorePageRoute.handler);
router.openapi(createCustomPageRoute.route, createCustomPageRoute.handler);
router.openapi(updateStorePageRoute.route, updateStorePageRoute.handler);
router.openapi(deleteStorePageRoute.route, deleteStorePageRoute.handler);
router.openapi(saveTranslationRoute.route, saveTranslationRoute.handler);
router.openapi(resetTranslationRoute.route, resetTranslationRoute.handler);

export default router;

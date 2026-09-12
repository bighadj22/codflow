/**
 * Landing Pages Routes
 *
 * Management endpoints for one-product marketing pages (image stack + COD
 * form). Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import {
  createLandingPageSchema,
  updateLandingPageSchema,
} from "./validation";
import {
  LandingPageSchema,
  LandingPageListItemSchema,
  LandingPageImageSchema,
  ListResponseSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const idParams = z.object({
  id: z.string().openapi({ description: "Landing Page UUID", example: "lp_abc123" }),
});

const imageIdParams = z.object({
  id: z.string().openapi({ description: "Landing Page UUID", example: "lp_abc123" }),
  imageId: z.string().openapi({ description: "Landing Page Image UUID", example: "lpimg_abc123" }),
});

const listQuery = z.object({
  productId: z.string().optional().openapi({ description: "Filter by product UUID" }),
  status: z.enum(["draft", "published", "archived"]).optional().openapi({
    description: "Filter by lifecycle status",
  }),
  limit: z.coerce.number().int().min(1).max(200).optional().openapi({
    description:
      "Opt-in page size (1-200). Omitted → the full list (the dashboard fetches everything; LLM-facing clients should set a limit).",
    example: 50,
  }),
  offset: z.coerce.number().int().min(0).optional().openapi({
    description: "Opt-in page offset — pair with limit. Rows are newest-first.",
    example: 0,
  }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listLandingPagesRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.LANDING_PAGES_READ },
  tags: ["Landing Pages"],
  summary: "List landing pages",
  description:
    "List landing pages (newest first) with per-page stats: views, attributed orders, revenue — orders count as placed regardless of status (cancelled/returned included). Filter by product or status. limit/offset are opt-in pagination; omitting them returns the full list.",
  operationId: "listLandingPages",
  query: listQuery,
  responses: {
    200: {
      description: "List of landing pages",
      content: jsonContent(ListResponseSchema(LandingPageListItemSchema)),
    },
  },
  handler: h.listLandingPages,
});

const compareLandingPagesRoute = defineRoute({
  method: "get",
  path: "/compare",
  auth: { scope: SCOPES.LANDING_PAGES_READ },
  tags: ["Landing Pages"],
  summary: "Compare landing pages of one product",
  description:
    "The A/B view: every landing page of one product side by side with views, orders, revenue — orders count as placed regardless of status (cancelled/returned included). Conversion rate = orders / views (undefined on zero views — compute client-side).",
  operationId: "compareLandingPages",
  query: z.object({
    productId: z.string().openapi({ description: "Product UUID to compare pages for" }),
  }),
  responses: {
    200: {
      description: "Landing pages of the product with stats",
      content: jsonContent(ListResponseSchema(LandingPageListItemSchema)),
    },
  },
  handler: h.compareLandingPages,
});

const getLandingPageRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.LANDING_PAGES_READ },
  tags: ["Landing Pages"],
  summary: "Get landing page",
  description:
    "Full landing page detail: settings, the ordered image stack, the linked product, and stats.",
  operationId: "getLandingPage",
  params: idParams,
  responses: {
    200: {
      description: "Landing page details",
      content: jsonContent(SuccessResponseSchema(LandingPageSchema)),
    },
  },
  handler: h.getLandingPage,
});

const createLandingPageRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Create landing page",
  description: `Create a draft landing page for a product. The slug defaults to \`lp-<8 chars>\` and is editable later. The page charges the product's catalog price — there is no price override (the price story lives in the images).

**Validation:** the product must exist; a taken slug returns 409.`,
  operationId: "createLandingPage",
  body: createLandingPageSchema,
  responses: {
    201: {
      description: "Landing page created (draft)",
      content: jsonContent(SuccessResponseSchema(LandingPageSchema)),
    },
  },
  handler: h.createLandingPage,
});

const duplicateLandingPageRoute = defineRoute({
  method: "post",
  path: "/{id}/duplicate",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Duplicate landing page",
  description: `Create a quick copy: a fresh DRAFT with a new slug, the same product, spacing, SEO meta, and image stack (images share the original immutable R2 objects — deleting an image elsewhere only removes the storage object when the last reference goes). Views, orders, revenue, and published state are never copied — a duplicate is a fresh creative test.`,
  operationId: "duplicateLandingPage",
  params: idParams,
  responses: {
    201: {
      description: "Landing page duplicated (draft)",
      content: jsonContent(SuccessResponseSchema(LandingPageSchema)),
    },
  },
  handler: h.duplicateLandingPage,
});

const updateLandingPageRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Update landing page",
  description:
    "Partial update — send only the fields you want to change (name, slug, spacing settings, SEO meta). A taken slug returns 409.",
  operationId: "updateLandingPage",
  params: idParams,
  body: updateLandingPageSchema,
  responses: {
    200: {
      description: "Landing page updated",
      content: jsonContent(SuccessResponseSchema(LandingPageSchema)),
    },
  },
  handler: h.updateLandingPage,
});

const deleteLandingPageRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Delete landing page",
  description:
    "Permanently delete a landing page with NO attributed orders. Refused with LANDING_PAGE_HAS_ORDERS otherwise — archive instead so history stays intact. Images cascade.",
  operationId: "deleteLandingPage",
  params: idParams,
  responses: {
    200: {
      description: "Landing page deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    422: { description: "Landing page has attributed orders (LANDING_PAGE_HAS_ORDERS) — archive instead" },
  },
  handler: h.deleteLandingPage,
});

const publishLandingPageRoute = defineRoute({
  method: "post",
  path: "/{id}/publish",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Publish landing page",
  description: "Make the page live at /lp/<slug> and start counting views.",
  operationId: "publishLandingPage",
  params: idParams,
  responses: {
    200: {
      description: "Landing page published",
      content: jsonContent(SuccessResponseSchema(LandingPageSchema)),
    },
  },
  handler: h.publishLandingPage,
});

const unpublishLandingPageRoute = defineRoute({
  method: "post",
  path: "/{id}/unpublish",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Unpublish landing page",
  description: "Return the page to draft — the link stops resolving (404) but history stays.",
  operationId: "unpublishLandingPage",
  params: idParams,
  responses: {
    200: {
      description: "Landing page unpublished",
      content: jsonContent(SuccessResponseSchema(LandingPageSchema)),
    },
  },
  handler: h.unpublishLandingPage,
});

const archiveLandingPageRoute = defineRoute({
  method: "post",
  path: "/{id}/archive",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Archive landing page",
  description: "Retire the page while keeping its order history intact. The link stops resolving.",
  operationId: "archiveLandingPage",
  params: idParams,
  responses: {
    200: {
      description: "Landing page archived",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: h.archiveLandingPage,
});

const listLandingPageImagesRoute = defineRoute({
  method: "get",
  path: "/{id}/images",
  auth: { scope: SCOPES.LANDING_PAGES_READ },
  tags: ["Landing Pages"],
  summary: "List landing page images",
  description: "The image stack ordered by position (1 = top of the page).",
  operationId: "listLandingPageImages",
  params: idParams,
  responses: {
    200: {
      description: "Image stack",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(LandingPageImageSchema),
        }),
      ),
    },
  },
  handler: h.listLandingPageImages,
});

const saveLandingPageImageRoute = defineRoute({
  method: "post",
  path: "/{id}/images",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Save landing page image",
  description:
    "Append an already-uploaded R2 image to the stack. Upload first via POST /api/images/presign with folder=landing, then call this with the returned key and URL.",
  operationId: "saveLandingPageImage",
  params: idParams,
  body: z.object({
    key: z.string().min(1).openapi({
      description: "R2 object key returned by the presign upload",
      example: "landing/abc123def456.jpg",
    }),
    src: z.string().min(1).openapi({
      description: "Public URL of the image",
      example: "https://media.codflow.store/landing/abc123.jpg",
    }),
    altText: z.string().nullable().optional().openapi({
      description: "Alt text for accessibility",
    }),
    position: z.number().int().min(1).optional().openapi({
      description: "Stack position (auto-appended at the end if not provided)",
    }),
    width: z.number().int().min(1).max(20000).nullable().optional().openapi({
      description: "Intrinsic pixel width (client-measured at upload) — lets the storefront reserve layout space",
      example: 1080,
    }),
    height: z.number().int().min(1).max(20000).nullable().optional().openapi({
      description: "Intrinsic pixel height (client-measured at upload)",
      example: 1350,
    }),
  }),
  responses: {
    201: {
      description: "Image added — returns the full reordered stack",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(LandingPageImageSchema),
        }),
      ),
    },
  },
  handler: h.saveLandingPageImage,
});

const reorderLandingPageImagesRoute = defineRoute({
  method: "patch",
  path: "/{id}/images/reorder",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Reorder landing page images",
  description:
    "Set the stack order. Send the complete ordered array of image IDs — every existing image ID exactly once.",
  operationId: "reorderLandingPageImages",
  params: idParams,
  body: z.object({
    imageIds: z
      .array(z.string().min(1))
      .min(1)
      .openapi({
        description:
          "Complete ordered list of all image IDs for this landing page — no duplicates, no omissions.",
        example: ["uuid-b", "uuid-a", "uuid-c"],
      }),
  }),
  responses: {
    200: {
      description: "Images reordered — returns the stack in new order",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(LandingPageImageSchema),
        }),
      ),
    },
    422: { description: "Duplicate IDs, foreign IDs, or incomplete set" },
  },
  handler: h.reorderLandingPageImages,
});

const deleteLandingPageImageRoute = defineRoute({
  method: "delete",
  path: "/{id}/images/{imageId}",
  auth: { scope: SCOPES.LANDING_PAGES_MANAGE },
  tags: ["Landing Pages"],
  summary: "Delete landing page image",
  description:
    "Remove an image from the stack. The R2 object is deleted first — a storage failure aborts so no DB row points at a missing object.",
  operationId: "deleteLandingPageImage",
  params: imageIdParams,
  responses: {
    200: {
      description: "Image deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: h.deleteLandingPageImage,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listLandingPagesRoute.route, listLandingPagesRoute.handler);
router.openapi(compareLandingPagesRoute.route, compareLandingPagesRoute.handler);
router.openapi(getLandingPageRoute.route, getLandingPageRoute.handler);
router.openapi(createLandingPageRoute.route, createLandingPageRoute.handler);
router.openapi(duplicateLandingPageRoute.route, duplicateLandingPageRoute.handler);
router.openapi(updateLandingPageRoute.route, updateLandingPageRoute.handler);
router.openapi(deleteLandingPageRoute.route, deleteLandingPageRoute.handler);
router.openapi(publishLandingPageRoute.route, publishLandingPageRoute.handler);
router.openapi(unpublishLandingPageRoute.route, unpublishLandingPageRoute.handler);
router.openapi(archiveLandingPageRoute.route, archiveLandingPageRoute.handler);
router.openapi(listLandingPageImagesRoute.route, listLandingPageImagesRoute.handler);
router.openapi(saveLandingPageImageRoute.route, saveLandingPageImageRoute.handler);
router.openapi(reorderLandingPageImagesRoute.route, reorderLandingPageImagesRoute.handler);
router.openapi(deleteLandingPageImageRoute.route, deleteLandingPageImageRoute.handler);

export default router;

/**
 * Reviews Routes
 *
 * CRM endpoints for moderation of product reviews submitted via the storefront.
 * All routes require an API key with the appropriate reviews scope.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import {
  ReviewSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── Response schemas ─────────────────────────────────────────────────────────

const reviewListResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.array(ReviewSchema),
  count: z.number().int().openapi({ description: "Number of items in data" }),
  total: z.number().int().openapi({ description: "Total matching records (for pagination)" }),
  pendingCount: z.number().int().openapi({
    description: "Total pending reviews regardless of filters — used for dashboard badge",
  }),
});

// ─── Request schemas ──────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional().openapi({
    description: "Filter by moderation status",
  }),
  productId: z.string().optional().openapi({
    description: "Filter by product ID",
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    description: "Maximum number of reviews to return",
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Number of reviews to skip",
  }),
});

const idParams = z.object({
  id: z.string().openapi({ description: "Review ID", example: "rev_123" }),
});

const updateBodySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).openapi({
    description: "New moderation status",
  }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listReviewsRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.REVIEWS_READ },
  tags: ["Reviews"],
  summary: "List reviews",
  description: "Get all product reviews with optional status and product filters. Requires `reviews:read` scope.",
  operationId: "listReviews",
  query: listQuerySchema,
  responses: {
    200: {
      description: "List of reviews",
      content: jsonContent(reviewListResponseSchema),
    },
  },
  handler: h.listReviews,
});

const updateReviewRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.REVIEWS_MANAGE },
  tags: ["Reviews"],
  summary: "Update review status",
  description: "Approve or reject a review. Requires `reviews:manage` scope.",
  operationId: "updateReview",
  params: idParams,
  body: updateBodySchema,
  responses: {
    200: {
      description: "Updated review",
      content: jsonContent(SuccessResponseSchema(ReviewSchema)),
    },
  },
  handler: h.updateReview,
});

const deleteReviewRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.REVIEWS_MANAGE },
  tags: ["Reviews"],
  summary: "Delete review",
  description: "Permanently delete a review. Requires `reviews:manage` scope.",
  operationId: "deleteReview",
  params: idParams,
  responses: {
    200: {
      description: "Review deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
        })
      ),
    },
  },
  handler: h.deleteReview,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listReviewsRoute.route, listReviewsRoute.handler);
router.openapi(updateReviewRoute.route, updateReviewRoute.handler);
router.openapi(deleteReviewRoute.route, deleteReviewRoute.handler);

export default router;

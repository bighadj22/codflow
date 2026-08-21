/**
 * Reviews Routes
 *
 * CRM endpoints for moderation of product reviews submitted via the storefront.
 * All routes require an API key with the appropriate reviews scope.
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
  ReviewSchema,
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

const reviewListResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.array(ReviewSchema),
  count: z.number().int().openapi({ description: "Number of items in data" }),
  total: z.number().int().openapi({ description: "Total matching records (for pagination)" }),
  pendingCount: z.number().int().openapi({
    description: "Total pending reviews regardless of filters — used for dashboard badge",
  }),
});

const listReviewsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Reviews"],
  summary: "List reviews",
  description: "Get all product reviews with optional status and product filters. Requires `reviews:read` scope.",
  operationId: "listReviews",
  request: {
    query: z.object({
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
    }),
  },
  responses: {
    200: {
      description: "List of reviews",
      content: jsonContent(reviewListResponseSchema),
    },
    400: errorResponse("Invalid filter value (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires reviews:read"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateReviewRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Reviews"],
  summary: "Update review status",
  description: "Approve or reject a review. Requires `reviews:manage` scope.",
  operationId: "updateReview",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Review ID", example: "rev_123" }),
    }),
    body: {
      content: jsonContent(
        z.object({
          status: z.enum(["pending", "approved", "rejected"]).openapi({
            description: "New moderation status",
          }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Updated review",
      content: jsonContent(SuccessResponseSchema(ReviewSchema)),
    },
    400: errorResponse("Validation error — invalid or missing status (VALIDATION_FAILED)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires reviews:manage"),
    404: errorResponse("Review not found (REVIEW_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteReviewRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Reviews"],
  summary: "Delete review",
  description: "Permanently delete a review. Requires `reviews:manage` scope.",
  operationId: "deleteReview",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Review ID", example: "rev_123" }),
    }),
  },
  responses: {
    200: {
      description: "Review deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Insufficient scope — requires reviews:manage"),
    404: errorResponse("Review not found (REVIEW_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.use("/", requireScope(SCOPES.REVIEWS_READ));
router.use("/:id", requireScope(SCOPES.REVIEWS_MANAGE));

router.openapi(listReviewsRoute, h.listReviews);
router.openapi(updateReviewRoute, h.updateReview);
router.openapi(deleteReviewRoute, h.deleteReview);

export default router;


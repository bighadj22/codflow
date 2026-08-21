/**
 * Product Groups Routes
 *
 * CRUD endpoints for the product category/collection hierarchy.
 * All routes require an API key with the appropriate product_groups scope.
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
  ProductCategorySchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const groupBaseFields = {
  name: z.string().min(1).openapi({ example: "Electronics" }),
  slug: z
    .string()
    .regex(slugRegex, "Slug must be lowercase letters, numbers and hyphens")
    .optional()
    .openapi({
      example: "electronics",
      description: "Auto-generated from name with a unique suffix when omitted",
    }),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional().openapi({
    description: "Parent group ID to nest under; null/omitted for top-level",
  }),
  imageUrl: z.string().url().nullable().optional(),
  metaTitle: z.string().max(60).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  metaKeywords: z.string().nullable().optional(),
};

const listGroupsRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.PRODUCT_GROUPS_READ)],
  tags: ["Product Groups"],
  summary: "List product groups",
  description:
    "Get all product categories/groups, ordered by position. Each item includes productsCount (active, non-deleted products).",
  operationId: "listProductGroups",
  request: {
    query: z.object({
      search: z.string().optional().openapi({ description: "Search by name" }),
      parentId: z.string().optional().openapi({
        description: "Filter to direct sub-categories of this parent group ID",
      }),
    }),
  },
  responses: {
    200: {
      description: "List of product groups",
      content: jsonContent(ListResponseSchema(ProductCategorySchema)),
    },
    400: errorResponse("Validation error - invalid query parameters"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing product_groups:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createGroupRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.PRODUCT_GROUPS_MANAGE)],
  tags: ["Product Groups"],
  summary: "Create product group",
  description:
    "Create a new product category/group. Provide parentId to create a sub-category; slug is auto-generated from name when omitted.",
  operationId: "createProductGroup",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
          ...groupBaseFields,
          position: z.number().int().min(0).default(0),
        })
      ),
    },
  },
  responses: {
    201: {
      description: "Group created",
      content: jsonContent(SuccessResponseSchema(ProductCategorySchema)),
    },
    400: errorResponse("Validation error (missing name, invalid slug or URL)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing product_groups:manage scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getGroupRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.PRODUCT_GROUPS_READ)],
  tags: ["Product Groups"],
  summary: "Get product group",
  description:
    "Returns the group with its immediate children (sub-categories) and productsCount.",
  operationId: "getProductGroup",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Product group ID", example: "cat_123" }),
    }),
  },
  responses: {
    200: {
      description: "Group details with children and product count",
      content: jsonContent(SuccessResponseSchema(ProductCategorySchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing product_groups:read scope"),
    404: errorResponse("Product group not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateGroupRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.PRODUCT_GROUPS_MANAGE)],
  tags: ["Product Groups"],
  summary: "Update product group",
  description:
    "Partial update — only include fields you want to change. Set parentId to null to move a group to the top level; set SEO fields to null to clear them.",
  operationId: "updateProductGroup",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Product group ID", example: "cat_123" }),
    }),
    body: {
      required: true,
      content: jsonContent(
        z.object({
          ...groupBaseFields,
          position: z.number().int().min(0).optional(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Group updated",
      content: jsonContent(SuccessResponseSchema(ProductCategorySchema)),
    },
    400: errorResponse("Validation error (invalid slug or URL)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing product_groups:manage scope"),
    404: errorResponse("Product group not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteGroupRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.PRODUCT_GROUPS_MANAGE)],
  tags: ["Product Groups"],
  summary: "Delete product group",
  description:
    "Permanently deletes a product group. Blocked while the group still has active products — reassign or remove those products first.",
  operationId: "deleteProductGroup",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Product group ID", example: "cat_123" }),
    }),
  },
  responses: {
    200: {
      description: "Group deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing product_groups:manage scope"),
    404: errorResponse("Product group not found"),
    422: errorResponse("Product group has existing products - cannot delete"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listGroupsRoute, h.listGroups);
router.openapi(createGroupRoute, h.createGroup);
router.openapi(getGroupRoute, h.getGroup);
router.openapi(updateGroupRoute, h.updateGroup);
router.openapi(deleteGroupRoute, h.deleteGroup);

export default router;

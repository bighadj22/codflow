/**
 * Product Groups Routes
 *
 * CRUD endpoints for the product category/collection hierarchy.
 * All routes require an API key with the appropriate product_groups scope.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import {
  ProductCategorySchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ─── Request schemas ──────────────────────────────────────────────────────────

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

const listQuerySchema = z.object({
  search: z.string().optional().openapi({ description: "Search by name" }),
  parentId: z.string().optional().openapi({
    description: "Filter to direct sub-categories of this parent group ID",
  }),
});

const createBodySchema = z.object({
  ...groupBaseFields,
  position: z.number().int().min(0).default(0),
});

const idParams = z.object({
  id: z.string().openapi({ description: "Product group ID", example: "cat_123" }),
});

const updateBodySchema = z.object({
  ...groupBaseFields,
  position: z.number().int().min(0).optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listGroupsRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.PRODUCT_GROUPS_READ },
  tags: ["Product Groups"],
  summary: "List product groups",
  description:
    "Get all product categories/groups, ordered by position. Each item includes productsCount (active, non-deleted products).",
  operationId: "listProductGroups",
  query: listQuerySchema,
  responses: {
    200: {
      description: "List of product groups",
      content: jsonContent(ListResponseSchema(ProductCategorySchema)),
    },
  },
  handler: h.listGroups,
});

const createGroupRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.PRODUCT_GROUPS_MANAGE },
  tags: ["Product Groups"],
  summary: "Create product group",
  description:
    "Create a new product category/group. Provide parentId to create a sub-category; slug is auto-generated from name when omitted.",
  operationId: "createProductGroup",
  body: createBodySchema,
  responses: {
    201: {
      description: "Group created",
      content: jsonContent(SuccessResponseSchema(ProductCategorySchema)),
    },
  },
  handler: h.createGroup,
});

const getGroupRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.PRODUCT_GROUPS_READ },
  tags: ["Product Groups"],
  summary: "Get product group",
  description:
    "Returns the group with its immediate children (sub-categories) and productsCount.",
  operationId: "getProductGroup",
  params: idParams,
  responses: {
    200: {
      description: "Group details with children and product count",
      content: jsonContent(SuccessResponseSchema(ProductCategorySchema)),
    },
  },
  handler: h.getGroup,
});

const updateGroupRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.PRODUCT_GROUPS_MANAGE },
  tags: ["Product Groups"],
  summary: "Update product group",
  description:
    "Partial update — only include fields you want to change. Set parentId to null to move a group to the top level; set SEO fields to null to clear them.",
  operationId: "updateProductGroup",
  params: idParams,
  body: updateBodySchema,
  responses: {
    200: {
      description: "Group updated",
      content: jsonContent(SuccessResponseSchema(ProductCategorySchema)),
    },
  },
  handler: h.updateGroup,
});

const deleteGroupRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.PRODUCT_GROUPS_MANAGE },
  tags: ["Product Groups"],
  summary: "Delete product group",
  description:
    "Permanently deletes a product group. Blocked while the group still has active products — reassign or remove those products first.",
  operationId: "deleteProductGroup",
  params: idParams,
  responses: {
    200: {
      description: "Group deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
        })
      ),
    },
    422: { description: "Product group has existing products - cannot delete" },
  },
  handler: h.deleteGroup,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listGroupsRoute.route, listGroupsRoute.handler);
router.openapi(createGroupRoute.route, createGroupRoute.handler);
router.openapi(getGroupRoute.route, getGroupRoute.handler);
router.openapi(updateGroupRoute.route, updateGroupRoute.handler);
router.openapi(deleteGroupRoute.route, deleteGroupRoute.handler);

export default router;

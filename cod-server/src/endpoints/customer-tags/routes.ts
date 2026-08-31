/**
 * Customer Tags Routes
 *
 * CRUD and assignment endpoints for customer tags.
 * All routes require an API key with the appropriate customer_tags scope.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import {
  CustomerTagSchema,
  SuccessResponseSchema,
  SuccessWithMessageSchema,
  MessageResponseSchema,
  ListResponseSchema,
  IdParamSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── Request schemas ──────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  search: z.string().optional().openapi({
    description: "Search by name",
  }),
  limit: z.coerce.number().int().positive().max(100).default(50).openapi({
    description: "Maximum number of tags to return",
    example: 50,
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Number of tags to skip",
    example: 0,
  }),
});

const createBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(50).openapi({
    example: "VIP",
  }),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .default("#64748b")
    .optional()
    .openapi({
      example: "#FF5733",
    }),
});

const customersQuerySchema = z.object({
  customers: z.enum(["true", "false"]).optional().openapi({
    description: "Set to `true` to include the `customers` array in the response",
  }),
});

const updateBodySchema = z.object({
  name: z.string().min(1).max(50).optional().openapi({ example: "VIP" }),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .optional()
    .openapi({ example: "#FF5733" }),
});

const assignBodySchema = z.object({
  customerId: z.string().min(1, "Customer ID is required").openapi({ example: "cust_123" }),
});

const unassignParamsSchema = IdParamSchema.extend({
  customerId: z.string().openapi({ description: "Customer ID", example: "cust_123" }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listTagsRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.CUSTOMER_TAGS_READ },
  tags: ["Customer Tags"],
  summary: "List customer tags",
  description: "Get all customer tags with optional search filter and pagination",
  operationId: "listCustomerTags",
  query: listQuerySchema,
  responses: {
    200: {
      description: "List of customer tags",
      content: jsonContent(ListResponseSchema(CustomerTagSchema)),
    },
  },
  handler: h.listTags,
});

const createTagRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.CUSTOMER_TAGS_MANAGE },
  tags: ["Customer Tags"],
  summary: "Create customer tag",
  description: "Create a new customer tag",
  operationId: "createCustomerTag",
  body: createBodySchema,
  responses: {
    201: {
      description: "Tag created",
      content: jsonContent(SuccessWithMessageSchema(CustomerTagSchema)),
    },
    409: { description: "Duplicate tag name" },
  },
  handler: h.createTag,
});

const getTagRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMER_TAGS_READ },
  tags: ["Customer Tags"],
  summary: "Get customer tag",
  description:
    "Returns the tag. Pass `?customers=true` to include the full list of assigned customers (each with `assignedAt` timestamp).",
  operationId: "getCustomerTag",
  params: IdParamSchema,
  query: customersQuerySchema,
  responses: {
    200: {
      description:
        "Tag detail. When `?customers=true`, includes a `customers` array of customer summaries.",
      content: jsonContent(SuccessResponseSchema(CustomerTagSchema)),
    },
  },
  handler: h.getTag,
});

const updateTagRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMER_TAGS_MANAGE },
  tags: ["Customer Tags"],
  summary: "Update customer tag",
  description: "Partial update — only include fields you want to change.",
  operationId: "updateCustomerTag",
  params: IdParamSchema,
  body: updateBodySchema,
  responses: {
    200: {
      description: "Tag updated",
      content: jsonContent(SuccessResponseSchema(CustomerTagSchema)),
    },
    409: { description: "Duplicate tag name" },
  },
  handler: h.updateTag,
});

const deleteTagRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMER_TAGS_MANAGE },
  tags: ["Customer Tags"],
  summary: "Delete customer tag",
  description:
    "Deletes the tag and all its customer assignments. Customers themselves are not affected.",
  operationId: "deleteCustomerTag",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Tag deleted",
      content: jsonContent(MessageResponseSchema),
    },
    422: { description: "Tag has assignments - cannot delete" },
  },
  handler: h.deleteTag,
});

const assignTagRoute = defineRoute({
  method: "post",
  path: "/{id}/assignments",
  auth: { scope: SCOPES.CUSTOMER_TAGS_MANAGE },
  tags: ["Customer Tags"],
  summary: "Assign tag to customer",
  description:
    "Assigns the tag to a customer. Idempotent — silently succeeds if already assigned. Increments `assignmentCount`.",
  operationId: "assignTag",
  params: IdParamSchema,
  body: assignBodySchema,
  responses: {
    200: {
      description: "Tag assigned",
      content: jsonContent(MessageResponseSchema),
    },
  },
  handler: h.assignTag,
});

const unassignTagRoute = defineRoute({
  method: "delete",
  path: "/{id}/assignments/{customerId}",
  auth: { scope: SCOPES.CUSTOMER_TAGS_MANAGE },
  tags: ["Customer Tags"],
  summary: "Unassign tag from customer",
  description:
    "Removes the tag from a customer. Idempotent — succeeds silently if not assigned. Decrements `assignmentCount`.",
  operationId: "unassignTag",
  params: unassignParamsSchema,
  responses: {
    200: {
      description: "Tag unassigned",
      content: jsonContent(MessageResponseSchema),
    },
  },
  handler: h.unassignTag,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listTagsRoute.route, listTagsRoute.handler);
router.openapi(createTagRoute.route, createTagRoute.handler);
router.openapi(getTagRoute.route, getTagRoute.handler);
router.openapi(updateTagRoute.route, updateTagRoute.handler);
router.openapi(deleteTagRoute.route, deleteTagRoute.handler);
router.openapi(assignTagRoute.route, assignTagRoute.handler);
router.openapi(unassignTagRoute.route, unassignTagRoute.handler);

export default router;

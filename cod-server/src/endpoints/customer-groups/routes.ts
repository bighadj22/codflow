/**
 * Customer Groups Routes
 *
 * CRUD and member management endpoints for customer segmentation groups.
 * All routes require an API key with the appropriate customer_groups scope.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import {
  CustomerGroupSchema,
  SuccessResponseSchema,
  SuccessWithMessageSchema,
  MessageResponseSchema,
  ListResponseSchema,
  IdParamSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── Request schemas ─────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  search: z.string().optional().openapi({
    description: "Search by name",
  }),
  limit: z.coerce.number().int().positive().max(100).default(50).openapi({
    description: "Maximum number of groups to return",
    example: 50,
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Number of groups to skip",
    example: 0,
  }),
});

const createBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100).openapi({
    example: "Wholesale Customers",
  }),
  description: z.string().max(500).nullable().optional().openapi({
    example: "High volume buyers",
  }),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .default("#6366f1")
    .optional()
    .openapi({
      example: "#3B82F6",
    }),
});

const membersQuerySchema = z.object({
  members: z.enum(["true", "false"]).optional().openapi({
    description: "Set to `true` to include the `members` array in the response",
  }),
});

const updateBodySchema = z.object({
  name: z.string().min(1).max(100).optional().openapi({ example: "VIP Customers" }),
  description: z.string().max(500).nullable().optional().openapi({ example: "Updated description" }),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .optional()
    .openapi({ example: "#10B981" }),
});

const addMemberBodySchema = z.object({
  customerId: z.string().min(1, "Customer ID is required").openapi({ example: "cust_123" }),
});

const removeMemberParamsSchema = IdParamSchema.extend({
  customerId: z.string().openapi({ description: "Customer ID", example: "cust_123" }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listGroupsRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_READ },
  tags: ["Customer Groups"],
  summary: "List customer groups",
  description: "Get all customer groups with optional search filter and pagination",
  operationId: "listCustomerGroups",
  query: listQuerySchema,
  responses: {
    200: {
      description: "List of customer groups",
      content: jsonContent(ListResponseSchema(CustomerGroupSchema)),
    },
  },
  handler: h.listGroups,
});

const createGroupRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_MANAGE },
  tags: ["Customer Groups"],
  summary: "Create customer group",
  description: "Create a new customer segment group",
  operationId: "createCustomerGroup",
  body: createBodySchema,
  responses: {
    201: {
      description: "Group created",
      content: jsonContent(SuccessWithMessageSchema(CustomerGroupSchema)),
    },
    409: { description: "Duplicate group name" },
  },
  handler: h.createGroup,
});

const getGroupRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_READ },
  tags: ["Customer Groups"],
  summary: "Get customer group",
  description:
    "Returns the group. Pass `?members=true` to include the full member list (each with `assignedAt` timestamp).",
  operationId: "getCustomerGroup",
  params: IdParamSchema,
  query: membersQuerySchema,
  responses: {
    200: {
      description:
        "Group detail. When `?members=true`, includes a `members` array of customer summaries.",
      content: jsonContent(SuccessResponseSchema(CustomerGroupSchema)),
    },
  },
  handler: h.getGroup,
});

const updateGroupRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_MANAGE },
  tags: ["Customer Groups"],
  summary: "Update customer group",
  description:
    "Partial update — only include fields you want to change. Set `description` to `null` to clear it.",
  operationId: "updateCustomerGroup",
  params: IdParamSchema,
  body: updateBodySchema,
  responses: {
    200: {
      description: "Group updated",
      content: jsonContent(SuccessResponseSchema(CustomerGroupSchema)),
    },
    409: { description: "Duplicate group name" },
  },
  handler: h.updateGroup,
});

const deleteGroupRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_MANAGE },
  tags: ["Customer Groups"],
  summary: "Delete customer group",
  description:
    "Deletes the group and all its member associations. Customers themselves are not affected.",
  operationId: "deleteCustomerGroup",
  params: IdParamSchema,
  responses: {
    200: {
      description: "Group deleted",
      content: jsonContent(MessageResponseSchema),
    },
    422: { description: "Group has members - cannot delete" },
  },
  handler: h.deleteGroup,
});

const addMemberRoute = defineRoute({
  method: "post",
  path: "/{id}/members",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_MANAGE },
  tags: ["Customer Groups"],
  summary: "Add member to group",
  description:
    "Adds a customer to the group. Idempotent — silently succeeds if already a member. Increments `memberCount`.",
  operationId: "addMember",
  params: IdParamSchema,
  body: addMemberBodySchema,
  responses: {
    200: {
      description: "Member added",
      content: jsonContent(MessageResponseSchema),
    },
  },
  handler: h.addMember,
});

const removeMemberRoute = defineRoute({
  method: "delete",
  path: "/{id}/members/{customerId}",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_MANAGE },
  tags: ["Customer Groups"],
  summary: "Remove member from group",
  description:
    "Removes a customer from the group. Idempotent — succeeds silently if not a member. Decrements `memberCount`.",
  operationId: "removeMember",
  params: removeMemberParamsSchema,
  responses: {
    200: {
      description: "Member removed",
      content: jsonContent(MessageResponseSchema),
    },
  },
  handler: h.removeMember,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listGroupsRoute.route, listGroupsRoute.handler);
router.openapi(createGroupRoute.route, createGroupRoute.handler);
router.openapi(getGroupRoute.route, getGroupRoute.handler);
router.openapi(updateGroupRoute.route, updateGroupRoute.handler);
router.openapi(deleteGroupRoute.route, deleteGroupRoute.handler);
router.openapi(addMemberRoute.route, addMemberRoute.handler);
router.openapi(removeMemberRoute.route, removeMemberRoute.handler);

export default router;

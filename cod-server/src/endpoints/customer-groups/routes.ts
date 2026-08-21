/**
 * Customer Groups Routes
 *
 * CRUD and member management endpoints for customer segmentation groups.
 * All routes require an API key with the appropriate customer_groups scope.
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
  CustomerGroupSchema,
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

const listGroupsRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_READ)],
  tags: ["Customer Groups"],
  summary: "List customer groups",
  description: "Get all customer groups with optional search filter and pagination",
  operationId: "listCustomerGroups",
  request: {
    query: z.object({
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
    }),
  },
  responses: {
    200: {
      description: "List of customer groups",
      content: jsonContent(ListResponseSchema(CustomerGroupSchema)),
    },
    400: errorResponse("Validation error - invalid query parameters"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createGroupRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE)],
  tags: ["Customer Groups"],
  summary: "Create customer group",
  description: "Create a new customer segment group",
  operationId: "createCustomerGroup",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
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
        })
      ),
    },
  },
  responses: {
    201: {
      description: "Group created",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: CustomerGroupSchema,
          message: z.string().openapi({ example: "Group created" }),
        })
      ),
    },
    400: errorResponse("Validation error (missing name, invalid hex color)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:manage scope"),
    409: errorResponse("Duplicate group name"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getGroupRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_READ)],
  tags: ["Customer Groups"],
  summary: "Get customer group",
  description:
    "Returns the group. Pass `?members=true` to include the full member list (each with `assignedAt` timestamp).",
  operationId: "getCustomerGroup",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer group ID", example: "grp_123" }),
    }),
    query: z.object({
      members: z.enum(["true", "false"]).optional().openapi({
        description: "Set to `true` to include the `members` array in the response",
      }),
    }),
  },
  responses: {
    200: {
      description:
        "Group detail. When `?members=true`, includes a `members` array of customer summaries.",
      content: jsonContent(SuccessResponseSchema(CustomerGroupSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:read scope"),
    404: errorResponse("Group not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateGroupRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE)],
  tags: ["Customer Groups"],
  summary: "Update customer group",
  description:
    "Partial update — only include fields you want to change. Set `description` to `null` to clear it.",
  operationId: "updateCustomerGroup",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer group ID", example: "grp_123" }),
    }),
    body: {
      required: true,
      content: jsonContent(
        z.object({
          name: z.string().min(1).max(100).optional().openapi({ example: "VIP Customers" }),
          description: z.string().max(500).nullable().optional().openapi({ example: "Updated description" }),
          color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
            .optional()
            .openapi({ example: "#10B981" }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Group updated",
      content: jsonContent(SuccessResponseSchema(CustomerGroupSchema)),
    },
    400: errorResponse("Validation error (invalid hex color)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:manage scope"),
    404: errorResponse("Group not found"),
    409: errorResponse("Duplicate group name"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteGroupRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE)],
  tags: ["Customer Groups"],
  summary: "Delete customer group",
  description:
    "Deletes the group and all its member associations. Customers themselves are not affected.",
  operationId: "deleteCustomerGroup",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer group ID", example: "grp_123" }),
    }),
  },
  responses: {
    200: {
      description: "Group deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Group deleted" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:manage scope"),
    404: errorResponse("Group not found"),
    422: errorResponse("Group has members - cannot delete"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const addMemberRoute = createRoute({
  method: "post",
  path: "/{id}/members",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE)],
  tags: ["Customer Groups"],
  summary: "Add member to group",
  description:
    "Adds a customer to the group. Idempotent — silently succeeds if already a member. Increments `memberCount`.",
  operationId: "addMember",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer group ID", example: "grp_123" }),
    }),
    body: {
      required: true,
      content: jsonContent(
        z.object({
          customerId: z.string().min(1, "Customer ID is required").openapi({ example: "cust_123" }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Member added",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Member added" }),
        })
      ),
    },
    400: errorResponse("Validation error (missing customerId)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:manage scope"),
    404: errorResponse("Group or customer not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const removeMemberRoute = createRoute({
  method: "delete",
  path: "/{id}/members/{customerId}",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_MANAGE)],
  tags: ["Customer Groups"],
  summary: "Remove member from group",
  description:
    "Removes a customer from the group. Idempotent — succeeds silently if not a member. Decrements `memberCount`.",
  operationId: "removeMember",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer group ID", example: "grp_123" }),
      customerId: z.string().openapi({ description: "Customer ID", example: "cust_123" }),
    }),
  },
  responses: {
    200: {
      description: "Member removed",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Member removed" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:manage scope"),
    404: errorResponse("Group not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listGroupsRoute, h.listGroups);
router.openapi(createGroupRoute, h.createGroup);
router.openapi(getGroupRoute, h.getGroup);
router.openapi(updateGroupRoute, h.updateGroup);
router.openapi(deleteGroupRoute, h.deleteGroup);
router.openapi(addMemberRoute, h.addMember);
router.openapi(removeMemberRoute, h.removeMember);

export default router;

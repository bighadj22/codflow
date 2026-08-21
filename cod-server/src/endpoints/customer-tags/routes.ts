/**
 * Customer Tags Routes
 *
 * CRUD and assignment endpoints for customer tags.
 * All routes require an API key with the appropriate customer_tags scope.
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
  CustomerTagSchema,
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

const listTagsRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_READ)],
  tags: ["Customer Tags"],
  summary: "List customer tags",
  description: "Get all customer tags with optional search filter and pagination",
  operationId: "listCustomerTags",
  request: {
    query: z.object({
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
    }),
  },
  responses: {
    200: {
      description: "List of customer tags",
      content: jsonContent(ListResponseSchema(CustomerTagSchema)),
    },
    400: errorResponse("Validation error - invalid query parameters"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createTagRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_MANAGE)],
  tags: ["Customer Tags"],
  summary: "Create customer tag",
  description: "Create a new customer tag",
  operationId: "createCustomerTag",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
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
        })
      ),
    },
  },
  responses: {
    201: {
      description: "Tag created",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: CustomerTagSchema,
          message: z.string().openapi({ example: "Tag created" }),
        })
      ),
    },
    400: errorResponse("Validation error (missing name, invalid hex color)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:manage scope"),
    409: errorResponse("Duplicate tag name"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getTagRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_READ)],
  tags: ["Customer Tags"],
  summary: "Get customer tag",
  description:
    "Returns the tag. Pass `?customers=true` to include the full list of assigned customers (each with `assignedAt` timestamp).",
  operationId: "getCustomerTag",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer tag ID", example: "tag_123" }),
    }),
    query: z.object({
      customers: z.enum(["true", "false"]).optional().openapi({
        description: "Set to `true` to include the `customers` array in the response",
      }),
    }),
  },
  responses: {
    200: {
      description:
        "Tag detail. When `?customers=true`, includes a `customers` array of customer summaries.",
      content: jsonContent(SuccessResponseSchema(CustomerTagSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:read scope"),
    404: errorResponse("Tag not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateTagRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_MANAGE)],
  tags: ["Customer Tags"],
  summary: "Update customer tag",
  description: "Partial update — only include fields you want to change.",
  operationId: "updateCustomerTag",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer tag ID", example: "tag_123" }),
    }),
    body: {
      required: true,
      content: jsonContent(
        z.object({
          name: z.string().min(1).max(50).optional().openapi({ example: "VIP" }),
          color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
            .optional()
            .openapi({ example: "#FF5733" }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Tag updated",
      content: jsonContent(SuccessResponseSchema(CustomerTagSchema)),
    },
    400: errorResponse("Validation error (invalid hex color)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:manage scope"),
    404: errorResponse("Tag not found"),
    409: errorResponse("Duplicate tag name"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteTagRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_MANAGE)],
  tags: ["Customer Tags"],
  summary: "Delete customer tag",
  description:
    "Deletes the tag and all its customer assignments. Customers themselves are not affected.",
  operationId: "deleteCustomerTag",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer tag ID", example: "tag_123" }),
    }),
  },
  responses: {
    200: {
      description: "Tag deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Tag deleted" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:manage scope"),
    404: errorResponse("Tag not found"),
    422: errorResponse("Tag has assignments - cannot delete"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const assignTagRoute = createRoute({
  method: "post",
  path: "/{id}/assignments",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_MANAGE)],
  tags: ["Customer Tags"],
  summary: "Assign tag to customer",
  description:
    "Assigns the tag to a customer. Idempotent — silently succeeds if already assigned. Increments `assignmentCount`.",
  operationId: "assignTag",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer tag ID", example: "tag_123" }),
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
      description: "Tag assigned",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Tag assigned" }),
        })
      ),
    },
    400: errorResponse("Validation error (missing customerId)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:manage scope"),
    404: errorResponse("Tag or customer not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const unassignTagRoute = createRoute({
  method: "delete",
  path: "/{id}/assignments/{customerId}",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_MANAGE)],
  tags: ["Customer Tags"],
  summary: "Unassign tag from customer",
  description:
    "Removes the tag from a customer. Idempotent — succeeds silently if not assigned. Decrements `assignmentCount`.",
  operationId: "unassignTag",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Customer tag ID", example: "tag_123" }),
      customerId: z.string().openapi({ description: "Customer ID", example: "cust_123" }),
    }),
  },
  responses: {
    200: {
      description: "Tag unassigned",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Tag unassigned" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:manage scope"),
    404: errorResponse("Tag not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listTagsRoute, h.listTags);
router.openapi(createTagRoute, h.createTag);
router.openapi(getTagRoute, h.getTag);
router.openapi(updateTagRoute, h.updateTag);
router.openapi(deleteTagRoute, h.deleteTag);
router.openapi(assignTagRoute, h.assignTag);
router.openapi(unassignTagRoute, h.unassignTag);

export default router;


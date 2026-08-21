/**
 * Customers Routes
 *
 * Customer management endpoints: CRUD, order history, and group/tag
 * membership lookups. All routes require an API key with the appropriate
 * scope (customers:* for profile access, customer_groups:read /
 * customer_tags:read for membership lookups).
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as handlers from "./handlers";
import {
  CustomerSchema,
  CustomerOrderSummarySchema,
  CustomerGroupMembershipSchema,
  CustomerTagMembershipSchema,
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

const phoneRegex = /^0[5-7]\d{8}$/;

const phoneField = () =>
  z.string().regex(phoneRegex, "Invalid Algerian phone number").openapi({
    pattern: phoneRegex.source,
    description: "Algerian mobile number starting with 05, 06, or 07",
    example: "0551234567",
  });

const idParams = z.object({
  id: z.string().openapi({ description: "Customer ID", example: "550e8400-e29b-41d4-a716-446655440000" }),
});

const listCustomersRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.CUSTOMERS_READ)],
  tags: ["Customers"],
  summary: "List customers",
  description:
    "Returns a paginated list of customers. Use `groupId` or `tagId` to filter by segment. Use `wilayaId` to filter by wilaya.",
  operationId: "listCustomers",
  request: {
    query: z.object({
      wilayaId: z.coerce.number().int().min(1).max(58).optional().openapi({
        description: "Filter by wilaya ID (1–58)",
      }),
      search: z.string().optional().openapi({ description: "Search by customer name or phone" }),
      groupId: z.string().optional().openapi({
        description: "Filter to customers in a specific customer group",
      }),
      tagId: z.string().optional().openapi({
        description: "Filter to customers with a specific tag",
      }),
      limit: z.coerce.number().int().positive().max(100).default(50).openapi({
        description: "Maximum number of results to return",
      }),
      offset: z.coerce.number().int().min(0).default(0).openapi({
        description: "Number of results to skip for pagination",
      }),
    }),
  },
  responses: {
    200: {
      description: "List of customers",
      content: jsonContent(ListResponseSchema(CustomerSchema)),
    },
    400: errorResponse("Validation error - invalid query parameters"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customers:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createCustomerRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireScope(SCOPES.CUSTOMERS_CREATE)],
  tags: ["Customers"],
  summary: "Create customer",
  description:
    "Register a new customer profile. Resolves wilayaId/communeId to their Arabic display names automatically.",
  operationId: "createCustomer",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
          name: z.string().min(1, "Name is required").openapi({ example: "Ahmed Benali" }),
          phone: phoneField(),
          phone2: z.preprocess(
            (v) => (v === "" || v == null ? undefined : v),
            z.string().regex(phoneRegex, "Invalid Algerian phone number").optional()
          ).openapi({ description: "Secondary phone number (optional)" }),
          wilayaId: z.number().int().min(1).max(58).openapi({
            description: "Official wilaya number (1–58)",
            example: 16,
          }),
          communeId: z.string().min(1, "Commune is required").openapi({
            description: "Commune UUID from /api/wilayas/{id}/communes",
            example: "550e8400-e29b-41d4-a716-446655440000",
          }),
          address: z.string().optional().openapi({ example: "12 Rue Didouche Mourad" }),
        })
      ),
    },
  },
  responses: {
    201: {
      description:
        "Customer created. Response includes the full customer record with recentOrders (empty array for new customers).",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: CustomerSchema,
          message: z.string().openapi({ example: "Customer created successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid phone format, missing required fields)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customers:create scope"),
    409: errorResponse("Duplicate phone number - a customer with this phone already exists (code: DUPLICATE_PHONE)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getCustomerRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMERS_READ)],
  tags: ["Customers"],
  summary: "Get customer",
  description: "Returns the full customer record plus `recentOrders` (up to 10 most recent orders).",
  operationId: "getCustomer",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Customer detail including recentOrders",
      content: jsonContent(SuccessResponseSchema(CustomerSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customers:read scope"),
    404: errorResponse("Customer not found (code: CUSTOMER_NOT_FOUND)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateCustomerRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMERS_UPDATE)],
  tags: ["Customers"],
  summary: "Update customer",
  description:
    "Partial update — only include fields you want to change. Set `phone2`, `communeId`, or `address` to null to clear them.",
  operationId: "updateCustomer",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          name: z.string().min(1, "Name is required").optional().openapi({ example: "Ahmed Benali" }),
          phone: phoneField().optional(),
          phone2: z.preprocess(
            (v) => (v === "" ? null : v),
            z.string().regex(phoneRegex, "Invalid Algerian phone number").nullable().optional()
          ).openapi({ description: "Secondary phone. Set to null to clear it." }),
          wilayaId: z.number().int().min(1).max(58).optional().openapi({
            description: "Official wilaya number (1–58)",
            example: 16,
          }),
          communeId: z.string().min(1, "Commune is required").nullable().optional().openapi({
            description: "Commune UUID. Set to null to clear.",
          }),
          address: z.string().nullable().optional().openapi({
            description: "Street address. Set to null to clear it.",
          }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Customer updated. Returns the full updated customer record.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: CustomerSchema,
          message: z.string().openapi({ example: "Customer updated successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid phone format)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customers:update scope"),
    404: errorResponse("Customer not found (code: CUSTOMER_NOT_FOUND)"),
    409: errorResponse("Duplicate phone number - a customer with this phone already exists (code: DUPLICATE_PHONE)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteCustomerRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.CUSTOMERS_DELETE)],
  tags: ["Customers"],
  summary: "Delete customer",
  description:
    "Permanently deletes the customer. **Blocked with 422 if the customer has any orders** — remove or reassign the orders first.",
  operationId: "deleteCustomer",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "Customer permanently deleted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          message: z.string().openapi({ example: "Customer deleted successfully" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customers:delete scope"),
    404: errorResponse("Customer not found (code: CUSTOMER_NOT_FOUND)"),
    422: errorResponse(
      "Cannot delete customer with existing orders (code: CUSTOMER_HAS_ORDERS). The context includes orderCount."
    ),
  },
  security: [{ ApiKeyAuth: [] }],
});

const listCustomerOrdersRoute = createRoute({
  method: "get",
  path: "/{id}/orders",
  middleware: [requireScope(SCOPES.CUSTOMERS_READ)],
  tags: ["Customers"],
  summary: "Get customer orders",
  description:
    "Returns all orders for a customer in reverse chronological order, each with `statusHistory` included.",
  operationId: "getCustomerOrders",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "List of customer orders (each includes statusHistory)",
      content: jsonContent(ListResponseSchema(CustomerOrderSummarySchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customers:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const listCustomerGroupsRoute = createRoute({
  method: "get",
  path: "/{id}/groups",
  middleware: [requireScope(SCOPES.CUSTOMER_GROUPS_READ)],
  tags: ["Customers"],
  summary: "Get customer groups",
  description:
    "Returns all customer groups the customer belongs to, including the `assignedAt` timestamp for each membership.",
  operationId: "getCustomerGroups",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "List of groups the customer belongs to",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(CustomerGroupMembershipSchema),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_groups:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const listCustomerTagsRoute = createRoute({
  method: "get",
  path: "/{id}/tags",
  middleware: [requireScope(SCOPES.CUSTOMER_TAGS_READ)],
  tags: ["Customers"],
  summary: "Get customer tags",
  description:
    "Returns all tags assigned to the customer, including the `assignedAt` timestamp for each assignment.",
  operationId: "getCustomerTags",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "List of tags assigned to the customer",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(CustomerTagMembershipSchema),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing customer_tags:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listCustomersRoute, handlers.listCustomers);
router.openapi(createCustomerRoute, handlers.createCustomer);
router.openapi(getCustomerRoute, handlers.getCustomer);
router.openapi(updateCustomerRoute, handlers.updateCustomer);
router.openapi(deleteCustomerRoute, handlers.deleteCustomer);
router.openapi(listCustomerOrdersRoute, handlers.listCustomerOrders);
router.openapi(listCustomerGroupsRoute, handlers.listCustomerGroups);
router.openapi(listCustomerTagsRoute, handlers.listCustomerTags);

export default router;

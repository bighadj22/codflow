/**
 * Customers Routes
 *
 * Customer management endpoints: CRUD, order history, and group/tag
 * membership lookups. All routes require an API key with the appropriate
 * scope (customers:* for profile access, customer_groups:read /
 * customer_tags:read for membership lookups).
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as handlers from "./handlers";
import {
  CustomerSchema,
  CustomerOrderSummarySchema,
  CustomerGroupMembershipSchema,
  CustomerTagMembershipSchema,
  SuccessResponseSchema,
  SuccessWithMessageSchema,
  MessageResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
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

// ─── Request schemas ──────────────────────────────────────────────────────────

const listQuerySchema = z.object({
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
});

const createBodySchema = z.object({
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
});

const updateBodySchema = z.object({
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
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const listCustomersRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.CUSTOMERS_READ },
  tags: ["Customers"],
  summary: "List customers",
  description:
    "Returns a paginated list of customers. Use `groupId` or `tagId` to filter by segment. Use `wilayaId` to filter by wilaya.",
  operationId: "listCustomers",
  query: listQuerySchema,
  responses: {
    200: {
      description: "List of customers",
      content: jsonContent(ListResponseSchema(CustomerSchema)),
    },
  },
  handler: handlers.listCustomers,
});

const createCustomerRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.CUSTOMERS_CREATE },
  tags: ["Customers"],
  summary: "Create customer",
  description:
    "Register a new customer profile. Resolves wilayaId/communeId to their Arabic display names automatically.",
  operationId: "createCustomer",
  body: createBodySchema,
  responses: {
    201: {
      description:
        "Customer created. Response includes the full customer record with recentOrders (empty array for new customers).",
      content: jsonContent(SuccessWithMessageSchema(CustomerSchema)),
    },
    409: {
      description:
        "Duplicate phone number - a customer with this phone already exists (code: DUPLICATE_PHONE)",
    },
  },
  handler: handlers.createCustomer,
});

const getCustomerRoute = defineRoute({
  method: "get",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMERS_READ },
  tags: ["Customers"],
  summary: "Get customer",
  description: "Returns the full customer record plus `recentOrders` (up to 10 most recent orders).",
  operationId: "getCustomer",
  params: idParams,
  responses: {
    200: {
      description: "Customer detail including recentOrders",
      content: jsonContent(SuccessResponseSchema(CustomerSchema)),
    },
  },
  handler: handlers.getCustomer,
});

const updateCustomerRoute = defineRoute({
  method: "patch",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMERS_UPDATE },
  tags: ["Customers"],
  summary: "Update customer",
  description:
    "Partial update — only include fields you want to change. Set `phone2`, `communeId`, or `address` to null to clear them.",
  operationId: "updateCustomer",
  params: idParams,
  body: updateBodySchema,
  responses: {
    200: {
      description: "Customer updated. Returns the full updated customer record.",
      content: jsonContent(SuccessWithMessageSchema(CustomerSchema)),
    },
    409: {
      description:
        "Duplicate phone number - a customer with this phone already exists (code: DUPLICATE_PHONE)",
    },
  },
  handler: handlers.updateCustomer,
});

const deleteCustomerRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.CUSTOMERS_DELETE },
  tags: ["Customers"],
  summary: "Delete customer",
  description:
    "Permanently deletes the customer. **Blocked with 422 if the customer has any orders** — remove or reassign the orders first.",
  operationId: "deleteCustomer",
  params: idParams,
  responses: {
    200: {
      description: "Customer permanently deleted",
      content: jsonContent(MessageResponseSchema),
    },
    422: {
      description:
        "Cannot delete customer with existing orders (code: CUSTOMER_HAS_ORDERS). The context includes orderCount.",
    },
  },
  handler: handlers.deleteCustomer,
});

const listCustomerOrdersRoute = defineRoute({
  method: "get",
  path: "/{id}/orders",
  auth: { scope: SCOPES.CUSTOMERS_READ },
  tags: ["Customers"],
  summary: "Get customer orders",
  description:
    "Returns all orders for a customer in reverse chronological order, each with `statusHistory` included.",
  operationId: "getCustomerOrders",
  params: idParams,
  responses: {
    200: {
      description: "List of customer orders (each includes statusHistory)",
      content: jsonContent(ListResponseSchema(CustomerOrderSummarySchema)),
    },
  },
  handler: handlers.listCustomerOrders,
});

const listCustomerGroupsRoute = defineRoute({
  method: "get",
  path: "/{id}/groups",
  auth: { scope: SCOPES.CUSTOMER_GROUPS_READ },
  tags: ["Customers"],
  summary: "Get customer groups",
  description:
    "Returns all customer groups the customer belongs to, including the `assignedAt` timestamp for each membership.",
  operationId: "getCustomerGroups",
  params: idParams,
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
  },
  handler: handlers.listCustomerGroups,
});

const listCustomerTagsRoute = defineRoute({
  method: "get",
  path: "/{id}/tags",
  auth: { scope: SCOPES.CUSTOMER_TAGS_READ },
  tags: ["Customers"],
  summary: "Get customer tags",
  description:
    "Returns all tags assigned to the customer, including the `assignedAt` timestamp for each assignment.",
  operationId: "getCustomerTags",
  params: idParams,
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
  },
  handler: handlers.listCustomerTags,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listCustomersRoute.route, listCustomersRoute.handler);
router.openapi(createCustomerRoute.route, createCustomerRoute.handler);
router.openapi(getCustomerRoute.route, getCustomerRoute.handler);
router.openapi(updateCustomerRoute.route, updateCustomerRoute.handler);
router.openapi(deleteCustomerRoute.route, deleteCustomerRoute.handler);
router.openapi(listCustomerOrdersRoute.route, listCustomerOrdersRoute.handler);
router.openapi(listCustomerGroupsRoute.route, listCustomerGroupsRoute.handler);
router.openapi(listCustomerTagsRoute.route, listCustomerTagsRoute.handler);

export default router;

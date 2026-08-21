/**
 * Shared Zod schemas for OpenAPI route definitions.
 *
 * Import `z` from "@hono/zod-openapi" (not "zod") in this file and in any
 * route file that attaches `.openapi()` metadata — the re-export guarantees
 * `extendZodWithOpenApi` has run before `.openapi()` is called.
 *
 * Domain schemas are ported from the hand-written definitions in
 * src/openapi/generator.ts, which is being retired endpoint-by-endpoint.
 * Keep examples/descriptions identical so the generated spec is a drop-in
 * replacement for the hand-written one.
 */

import { z } from "@hono/zod-openapi";
import { ERROR_CATEGORIES } from "../../../cod-shared/errors/codes";

const errorCategoryEnum = z.enum([
  ERROR_CATEGORIES.VALIDATION,
  ERROR_CATEGORIES.AUTHENTICATION,
  ERROR_CATEGORIES.BUSINESS_LOGIC,
  ERROR_CATEGORIES.SYSTEM,
]);

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "Resource not found" }),
    code: z.string().openapi({ example: "RESOURCE_NOT_FOUND" }),
    category: errorCategoryEnum.openapi({ example: "BUSINESS_LOGIC" }),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({ description: "Additional context about the error (optional)" }),
  })
  .openapi("ErrorResponse", {
    description: "Standard error envelope returned by all non-2xx responses.",
  });

export function SuccessResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.boolean().openapi({ example: true }),
    data: dataSchema,
  });
}

export function ListResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    success: z.boolean().openapi({ example: true }),
    data: z.array(itemSchema),
    count: z.number().int().openapi({ description: "Number of items returned" }),
  });
}

export const WilayaSchema = z
  .object({
    id: z
      .number()
      .int()
      .min(1)
      .max(58)
      .openapi({ example: 16, description: "Official wilaya number (1–58)" }),
    name: z.string().openapi({ example: "Alger" }),
    nameAr: z.string().openapi({ example: "الجزائر" }),
  })
  .openapi("Wilaya");

export const CommuneSchema = z
  .object({
    id: z.string().openapi({ example: "16001" }),
    wilayaId: z.number().int().openapi({ example: 16 }),
    name: z.string().openapi({ example: "Bir Mourad Raïs" }),
    nameAr: z.string().openapi({ example: "بئر مراد رايس" }),
    postalCode: z.string().nullable().openapi({ example: "16012" }),
  })
  .openapi("Commune");

export const ActivityLogSchema = z
  .object({
    id: z.string(),
    actorId: z.string(),
    actorName: z.string().openapi({ example: "Ahmed Benali" }),
    actorRole: z.enum(["admin", "staff"]),
    action: z.string().openapi({
      description:
        'Dot-notation action identifier. Valid values: `order.created`, `order.status_changed`, `order.driver_assigned`, `order.dispatched`, `order.deleted`, `customer.created`, `customer.updated`, `customer.deleted`, `customer_group.created`, `customer_group.updated`, `customer_group.deleted`, `customer_group.member_added`, `customer_group.member_removed`, `customer_tag.created`, `customer_tag.updated`, `customer_tag.deleted`, `customer_tag.assigned`, `customer_tag.unassigned`, `driver.created`, `driver.updated`, `driver.status_changed`, `driver.deleted`, `product.created`, `product.updated`, `product.status_changed`, `product.deleted`, `review.approved`, `review.rejected`, `review.deleted`, `user.created`, `user.updated`, `user.role_changed`, `user.scope_granted`, `user.scope_revoked`, `user.api_key_generated`, `user.api_key_revoked`',
      example: "order.created",
    }),
    entityType: z.string().openapi({
      description:
        'Entity category the action applies to. Valid values: `order`, `customer`, `customer_group`, `customer_tag`, `driver`, `product`, `review`, `user`',
      example: "order",
    }),
    entityId: z.string(),
    entityLabel: z.string().nullable().openapi({
      example: "ORD-0042",
      description:
        "Human-readable label at the time of action (order number, customer name, etc.)",
    }),
    metadata: z.string().nullable().openapi({
      description:
        "JSON-encoded extra context. Shape varies by action: `{ from, to }` for `order.status_changed`, `{ amount }` for payments, `{ scope }` for permission changes, `{ role }` for role changes, `{ rating, orderNumber }` for review actions",
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("ActivityLog");

export const DeliveryCompanySchema = z
  .object({
    id: z.string().openapi({ example: "comp_abc123" }),
    name: z.string().openapi({ example: "Yalidine" }),
    nameAr: z.string().openapi({ example: "ياليدين" }),
    code: z.string().openapi({ example: "yalidine" }),
    website: z.string().url().nullable().openapi({ example: "https://www.yalidine.com" }),
    active: z.boolean().openapi({ example: true }),
    apiEndpoint: z.string().url().nullable().openapi({ example: "https://api.yalidine.app/v1" }),
    isConnected: z.boolean().openapi({
      description: "True when API credentials are stored. Credentials themselves are never returned.",
      example: true,
    }),
    supportsHomeDelivery: z.boolean().openapi({ example: true }),
    supportsStopDesk: z.boolean().openapi({ example: true }),
    supportsTracking: z.boolean().openapi({ example: false }),
    autoValidate: z.boolean().nullable().openapi({
      description:
        "When true, the server calls `validateShipment` immediately after `createShipment` on dispatch. " +
        "The order is locked at the carrier (no edits/deletes). When false, the order stays editable and the team must manually confirm it. " +
        "If omitted/null, a provider-specific default is used.",
      example: true,
    }),
    notes: z.string().nullable().openapi({ example: "Primary carrier for Algiers region" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("DeliveryCompany", {
    description: "Third-party delivery company integration",
  });

export const StopDeskSchema = z
  .object({
    id: z.string().openapi({ example: "desk_xyz789" }),
    companyId: z.string().openapi({ example: "comp_abc123" }),
    code: z.string().openapi({
      example: "16A",
      description:
        "Station code to use as `stationCode` when dispatching a stop-desk order. " +
        "Format differs by provider: Noest = alphanumeric code (e.g. \"16A\"); " +
        "Yalidine = numeric center_id (e.g. \"160101\"); " +
        "ZR Express = territory UUID; EcoTrack = postal code string.",
    }),
    name: z.string().openapi({ example: "Agence Alger Centre" }),
    commune: z.string().nullable().openapi({ example: "Bir Mourad Raïs" }),
    wilayaId: z.number().int().nullable().openapi({ example: 16 }),
    address: z.string().nullable().openapi({ example: "5 Rue Didouche Mourad, Alger" }),
    phones: z.array(z.string()).openapi({
      example: ["0555123456"],
      description: "Contact phone numbers for the stop-desk station.",
    }),
    active: z.boolean().openapi({
      example: true,
      description: "Admin toggle. When false, this stop desk is hidden from merchant UI. Survives re-sync.",
    }),
    syncedAt: z.string().datetime().openapi({
      description: "Last time this row was fetched from the carrier API (via POST .../sync-stop-desks).",
    }),
  })
  .openapi("StopDesk");

export const ReviewSchema = z
  .object({
    id: z.string().openapi({ example: "rev_123" }),
    storeId: z.string().openapi({ example: "store_123" }),
    productId: z.string().openapi({ example: "prod_123" }),
    orderId: z.string().openapi({ example: "ord_123" }),
    orderNumber: z.string().openapi({ example: "ORD-20240101-0042" }),
    customerName: z.string().openapi({ example: "أحمد بن علي" }),
    rating: z.number().int().min(1).max(5).openapi({ example: 5 }),
    title: z.string().nullable().openapi({ example: "منتج ممتاز" }),
    body: z.string().openapi({ example: "جودة عالية وسعر مناسب" }),
    status: z.enum(["pending", "approved", "rejected"]).openapi({ example: "pending" }),
    helpfulCount: z.number().int().openapi({ example: 0 }),
    productName: z.string().nullable().optional().openapi({ example: "Product Name" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Review", {
    description: "Product review submitted via storefront",
  });

export const CustomerGroupMemberSchema = z
  .object({
    id: z.string().openapi({ example: "cust_123" }),
    name: z.string().openapi({ example: "Ahmed Benali" }),
    phone: z.string().openapi({ example: "0555123456" }),
    wilaya: z.string().nullable().openapi({ example: "Alger" }),
    totalOrders: z.number().int().openapi({ example: 5 }),
    totalSpent: z.number().openapi({ example: 15000 }),
    assignedAt: z.string().datetime().openapi({ example: "2024-01-15T10:30:00.000Z" }),
  })
  .openapi("CustomerGroupMember");

export const CustomerGroupSchema = z
  .object({
    id: z.string().openapi({ example: "grp_123" }),
    name: z.string().openapi({ example: "Wholesale Customers" }),
    description: z.string().nullable().openapi({ example: "High volume buyers" }),
    color: z.string().openapi({ example: "#6366f1" }),
    memberCount: z.number().int().openapi({
      example: 12,
      description: "Denormalized count, kept in sync on add/remove member",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    members: z
      .array(CustomerGroupMemberSchema)
      .optional()
      .openapi({
        description:
          "Included only when `?members=true` is passed to GET /api/customer-groups/{id}.",
      }),
  })
  .openapi("CustomerGroup", {
    description: "Group for segmenting customers",
  });

export const CustomerTagCustomerSchema = z
  .object({
    id: z.string().openapi({ example: "cust_123" }),
    name: z.string().openapi({ example: "Ahmed Benali" }),
    phone: z.string().openapi({ example: "0555123456" }),
    wilaya: z.string().nullable().openapi({ example: "Alger" }),
    totalOrders: z.number().int().openapi({ example: 5 }),
    totalSpent: z.number().openapi({ example: 15000 }),
    assignedAt: z.string().datetime().openapi({ example: "2024-01-15T10:30:00.000Z" }),
  })
  .openapi("CustomerTagCustomer");

export const CustomerTagSchema = z
  .object({
    id: z.string().openapi({ example: "tag_123" }),
    name: z.string().openapi({ example: "VIP" }),
    color: z.string().openapi({ example: "#64748b" }),
    assignmentCount: z.number().int().openapi({
      example: 8,
      description: "Denormalized count, kept in sync on assign/unassign",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    customers: z
      .array(CustomerTagCustomerSchema)
      .optional()
      .openapi({
        description:
          "Included only when `?customers=true` is passed to GET /api/customer-tags/{id}.",
      }),
  })
  .openapi("CustomerTag", {
    description: "Label for tagging customers",
  });



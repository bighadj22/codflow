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

export const CustomerSchema = z
  .object({
    id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    name: z.string().openapi({ example: "Ahmed Benali" }),
    phone: z.string().openapi({
      example: "0551234567",
      description: "Algerian mobile number starting with 05, 06, or 07",
    }),
    phone2: z.string().nullable().openapi({ description: "Secondary phone number", example: null }),
    wilayaId: z.number().int().min(1).max(58).nullable().openapi({
      description: "Official wilaya number (1–58)",
      example: 16,
    }),
    communeId: z.string().nullable().openapi({
      description: "Commune UUID from reference table",
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
    wilaya: z.string().openapi({
      description: "Wilaya Arabic name — denormalized display value, derived from wilayaId",
      example: "الجزائر",
    }),
    commune: z.string().nullable().openapi({
      description: "Commune Arabic name — denormalized display value, derived from communeId",
      example: "بئر مراد رايس",
    }),
    address: z.string().nullable(),
    totalOrders: z.number().int().openapi({
      example: 5,
      description: "Denormalized count, incremented on each order created",
    }),
    totalSpent: z.number().openapi({ example: 25000 }),
    createdAt: z.string().datetime(),
    lastOrderAt: z.string().datetime().nullable(),
    recentOrders: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .openapi({
        description:
          "Up to 10 most recent full order records (same shape as the Orders API), newest first. Included only in GET /api/customers/{id}; not present in list responses.",
      }),
  })
  .openapi("Customer", {
    description: "Customer profile with denormalized purchase statistics",
  });

export const CustomerOrderStatusSchema = z
  .object({
    id: z.string(),
    orderId: z.string(),
    status: z.string(),
    timestamp: z.string().datetime(),
    by: z.string().nullable(),
  })
  .openapi("CustomerOrderStatus");

export const CustomerOrderSummarySchema = z
  .object({
    id: z.string(),
    orderNumber: z.string().openapi({ example: "ORD-20260327-0042" }),
    status: z.string().openapi({ example: "new" }),
    price: z.number().openapi({ example: 9000 }),
    createdAt: z.string().datetime(),
    wilayaId: z.number().int().nullable(),
    communeId: z.string().nullable(),
    wilaya: z.string().nullable().openapi({
      description: "Wilaya Arabic name, joined from reference table",
      example: "الجزائر",
    }),
    commune: z.string().nullable().openapi({
      description: "Commune Arabic name, joined from reference table",
      example: "بئر مراد رايس",
    }),
    statusHistory: z.array(CustomerOrderStatusSchema),
  })
  .openapi("CustomerOrderSummary", {
    description:
      "Order summary returned by GET /api/customers/{id}/orders, each with its full statusHistory",
  });

export const ShippingRuleSchema = z
  .object({
    id: z.string().openapi({ example: "rule_abc123" }),
    profileId: z.string().openapi({ example: "profile_123" }),
    wilayaId: z.number().int().min(1).max(58).openapi({ example: 16 }),
    wilayaName: z.string().openapi({
      description: "Wilaya French/name — joined from reference table",
      example: "Alger",
    }),
    wilayaNameAr: z.string().openapi({ example: "الجزائر" }),
    homePrice: z.number().openapi({ example: 400 }),
    stopDeskPrice: z.number().openapi({ example: 250 }),
    homeEnabled: z.boolean().openapi({ example: true }),
    stopDeskEnabled: z.boolean().openapi({ example: false }),
    createdAt: z.string().datetime(),
  })
  .openapi("ShippingRule", {
    description: "Per-wilaya customer delivery rate within a shipping profile",
  });

export const ShippingProfileWithRulesSchema = z
  .object({
    id: z.string().openapi({ example: "profile_123" }),
    name: z.string().openapi({ example: "Standard Rates" }),
    isDefault: z.boolean().openapi({
      description:
        "Exactly one profile is always the default; its rates auto-apply on order creation",
      example: false,
    }),
    notes: z.string().nullable().openapi({ example: null }),
    productCount: z.number().int().openapi({
      description: "How many products are assigned to this profile",
      example: 3,
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    rules: z.array(ShippingRuleSchema),
  })
  .openapi("ShippingProfileWithRules", {
    description: "Shipping profile with its full list of wilaya rules",
  });

export const ShippingProfileSchema = ShippingProfileWithRulesSchema.omit({
  rules: true,
}).extend({
  ruleCount: z.number().int().openapi({
    description: "Number of wilaya rules in this profile",
    example: 58,
  }),
}).openapi("ShippingProfile", {
  description:
    "Shipping rate profile. List responses include ruleCount; detail responses include the rules array instead.",
});

export const CommuneOverrideSchema = z
  .object({
    communeId: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    communeName: z.string().openapi({ example: "Bab Ezzouar" }),
    communeNameAr: z.string().openapi({ example: "باب الزوار" }),
    postalCode: z.string().nullable(),
    homeEnabled: z.boolean().nullable().openapi({
      description: "null = inherited from wilaya rule",
    }),
    stopDeskEnabled: z.boolean().nullable().openapi({
      description: "null = inherited from wilaya rule",
    }),
    homePrice: z.number().nullable().openapi({
      description: "null = inherited from wilaya rule",
    }),
    stopDeskPrice: z.number().nullable().openapi({
      description: "null = inherited from wilaya rule",
    }),
    effectiveHomeEnabled: z.boolean(),
    effectiveStopDeskEnabled: z.boolean(),
    effectiveHomePrice: z.number(),
    effectiveStopDeskPrice: z.number(),
    hasOverride: z.boolean(),
  })
  .openapi("CommuneOverride", {
    description:
      "A commune within a wilaya rule, showing both the raw override fields (null = inherited) and the effective values used at fee-resolution time.",
  });

export const DriverSchema = z
  .object({
    id: z.string().openapi({ example: "drv_123" }),
    firstName: z.string().openapi({ example: "Mohamed" }),
    lastName: z.string().openapi({ example: "Amiri" }),
    phone: z.string().openapi({
      description: "Algerian mobile number starting with 05, 06, or 07",
      example: "0551234567",
    }),
    phone2: z.string().nullable().openapi({ description: "Optional secondary phone", example: null }),
    vehicleType: z.enum(["motorcycle", "car", "van"]).nullable().openapi({
      description: "Type of vehicle; null if unknown",
      example: "van",
    }),
    status: z.enum(["available", "busy", "inactive"]).openapi({ example: "available" }),
    totalDelivered: z.number().int().openapi({
      description: "Cumulative deliveries completed (incremented on status → delivered)",
      example: 50,
    }),
    totalEarnings: z.number().openapi({
      description: "Cumulative delivery fees earned (incremented on status → delivered)",
      example: 25000,
    }),
    pendingCash: z.number().openapi({
      description: "COD cash collected by driver but not yet remitted to the business",
      example: 5000,
    }),
    totalPaid: z.number().openapi({
      description: "Total COD cash remitted to the business",
      example: 20000,
    }),
    notes: z.string().nullable().openapi({
      description: "Internal notes about the driver (not visible to customers)",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    compensationWilayaCount: z.number().int().openapi({
      description:
        "Number of wilayas with a configured per-delivery fee for this driver",
      example: 12,
    }),
    recentOrders: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .openapi({
        description:
          "Up to 10 most recent orders assigned to this driver, newest first. Included only in detail/create/update responses; not present in list responses.",
      }),
  })
  .openapi("Driver", {
    description: "Delivery driver profile with denormalized earnings statistics",
  });

export const DriverCompensationRowSchema = z
  .object({
    wilayaId: z.number().int().min(1).max(58).openapi({ example: 16 }),
    wilayaName: z.string().openapi({ example: "Alger" }),
    wilayaNameAr: z.string().openapi({ example: "الجزائر" }),
    feePerDelivery: z.number().nullable().openapi({
      description: "DZD per delivery; `null` when not configured.",
      example: 350,
    }),
  })
  .openapi("DriverCompensationRow", {
    description:
      "Per-wilaya compensation entry. GET /{id}/compensations always returns all 58 wilayas; a null fee means no row is configured.",
  });

export const UserSchema = z
  .object({
    id: z.string().openapi({ example: "a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8" }),
    name: z.string().openapi({ example: "Ahmed Benali" }),
    email: z.string().email().openapi({ example: "staff@example.com" }),
    emailVerified: z.boolean().openapi({ example: true }),
    image: z.string().nullable().openapi({ description: "Avatar image URL", example: null }),
    role: z.enum(["admin", "staff"]).openapi({ example: "staff" }),
    status: z.enum(["active", "inactive"]).openapi({ example: "active" }),
    language: z.string().openapi({
      description: 'UI language preference for emails: "ar" | "en"',
      example: "en",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    scopes: z.array(z.string()).openapi({
      description:
        'Permission scopes for this user. Always `["*"]` for admins. The `apiKey` field is never included in these responses — use POST /{id}/api-key/rotate for a one-time key reveal.',
      example: ["orders:read", "customers:read"],
    }),
  })
  .openapi("User", {
    description: "Team member record with permission scopes",
  });

export const StoreSchema = z
  .object({
    id: z.string().openapi({ example: "store_01" }),
    name: z.string().openapi({ example: "My Shop" }),
    domain: z.string().nullable().openapi({ description: "Custom storefront domain", example: null }),
    logoUrl: z.string().url().nullable().openapi({ example: "https://cdn.example.com/logo.png" }),
    themeId: z.string().openapi({
      description: 'Active theme slug: "theme01", "theme02", etc.',
      example: "theme01",
    }),
    primaryColor: z.string().openapi({ description: "Primary CTA color (hex)", example: "#3b82f6" }),
    accentColor: z.string().openapi({ description: "Accent / highlight color (hex)", example: "#f97316" }),
    bgColor: z.string().openapi({ description: "Background color (hex)", example: "#ffffff" }),
    fontFamily: z.string().openapi({ description: "CSS font-family string", example: "Cairo" }),
    fontUrl: z.string().url().nullable().openapi({
      description: "Google Fonts import URL (optional override)",
      example: "https://fonts.googleapis.com/css2?family=Cairo",
    }),
    lang: z.enum(["ar", "en"]).openapi({ description: "Store UI language", example: "ar" }),
    currency: z.string().openapi({ example: "DZD" }),
    currencySymbol: z.string().openapi({ example: "دج" }),
    contentJson: z.string().nullable().openapi({
      description: "Serialized JSON of every text string shown in the storefront",
    }),
    metaTitle: z.string().nullable().openapi({ example: "My Shop — Best Products" }),
    metaDescription: z.string().nullable().openapi({ example: "Find the best products at My Shop." }),
    ogImage: z.string().url().nullable().openapi({ example: "https://cdn.example.com/og.png" }),
    announcementBar: z.string().nullable().openapi({
      description: "Top announcement bar text (null = hidden)",
      example: "Free delivery on orders above 3000 دج",
    }),
    reviewsEnabled: z.boolean().openapi({
      description: "When false, reviews are hidden on the storefront and submission is disabled",
      example: true,
    }),
    status: z.enum(["active", "inactive"]).openapi({ example: "active" }),
    storeApiKey: z.string().nullable().openapi({
      description:
        "Plaintext storefront API key — visible to the merchant in Store Settings. Not the dashboard API key.",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Store", {
    description:
      "Single-tenant store configuration: branding, theme, localization, SEO, and feature flags",
  });

export const StorePixelConfigSchema = z
  .object({
    id: z.string(),
    storeId: z.string(),
    pixelId: z.string().openapi({ example: "1234567890123456" }),
    accessToken: z.string().openapi({ description: "Meta access token used for server-side events" }),
    testEventCode: z.string().nullable().openapi({
      description: "Meta test event code — used during integration testing only. Set to null in production.",
    }),
    enabled: z.boolean().openapi({ example: true }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("StorePixelConfig", {
    description: "Meta pixel tracking configuration for server-side conversion events",
  });

export const CustomerGroupMembershipSchema = z
  .object({
    id: z.string().openapi({ example: "grp_123" }),
    name: z.string().openapi({ example: "Wholesale Customers" }),
    color: z.string().openapi({ example: "#6366f1" }),
    description: z.string().nullable(),
    memberCount: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    assignedAt: z.string().datetime().openapi({
      description: "When the customer was added to this group",
    }),
  })
  .openapi("CustomerGroupMembership");

export const CustomerTagMembershipSchema = z
  .object({
    id: z.string().openapi({ example: "tag_123" }),
    name: z.string().openapi({ example: "VIP" }),
    color: z.string().openapi({ example: "#64748b" }),
    assignmentCount: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    assignedAt: z.string().datetime().openapi({
      description: "When the tag was assigned to this customer",
    }),
  })
  .openapi("CustomerTagMembership");

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

export const ProductCategoryRowSchema = z.object({
  id: z.string().openapi({ example: "cat_123" }),
  name: z.string().openapi({ example: "Electronics" }),
  slug: z.string().openapi({
    example: "electronics",
    description: "Lowercase letters, numbers and hyphens; auto-generated from name with a unique suffix when omitted",
  }),
  description: z.string().nullable().openapi({ example: "Electronic products" }),
  parentId: z.string().nullable().openapi({
    description: "Parent group ID for nested hierarchies; null for top-level groups",
    example: null,
  }),
  imageUrl: z.string().url().nullable().openapi({ example: "https://example.com/img.jpg" }),
  metaTitle: z.string().nullable().openapi({
    description: "SEO page title (max 60 chars)",
    example: "Electronics | CodFlow",
  }),
  metaDescription: z.string().nullable().openapi({
    description: "SEO description (max 160 chars)",
    example: "Phones, laptops and accessories",
  }),
  metaKeywords: z.string().nullable().openapi({
    description: "Comma-separated SEO keywords",
    example: "electronics, gadgets",
  }),
  position: z.number().int().min(0).openapi({
    example: 0,
    description: "Display order; lower values come first",
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProductCategorySchema = ProductCategoryRowSchema.extend({
  productsCount: z.number().int().openapi({
    example: 5,
    description: "Number of active (non-deleted) products assigned to this group",
  }),
  children: z.array(ProductCategoryRowSchema).optional().openapi({
    description: "Immediate sub-categories. Included only in GET /api/product-groups/{id}.",
  }),
}).openapi("ProductCategory", {
  description: "Product category/collection group in the catalog hierarchy",
});

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

export const ProductVariantOptionSchema = z.object({
  name: z.string().openapi({ example: "Color" }),
  values: z
    .array(
      z.object({
        value: z.string().openapi({ example: "Red" }),
        hexColor: z.string().nullable().optional().openapi({ example: "#FF0000" }),
      })
    )
    .min(1),
});

export const ProductImageSchema = z
  .object({
    id: z.string().openapi({ example: "img_abc123" }),
    productId: z.string().openapi({ example: "prod_abc123" }),
    src: z.string().openapi({
      format: "uri",
      description: "Original URL of the image",
      example: "https://cdn.example.com/products/abc123.jpg",
    }),
    r2Key: z.string().nullable().openapi({
      description: "R2 object key; null when the image is stored off-origin",
      example: "products/abc123def456.jpg",
    }),
    srcSm: z.string().url().nullable().openapi({ example: null }),
    srcMd: z.string().url().nullable().openapi({ example: null }),
    srcLg: z.string().url().nullable().openapi({ example: null }),
    altText: z.string().nullable().openapi({
      description: "Alt text for accessibility",
      example: "Galaxy A54 front view",
    }),
    width: z.number().int().nullable().openapi({ example: null }),
    height: z.number().int().nullable().openapi({ example: null }),
    type: z.number().int().openapi({
      description: "1 = image, 2 = video",
      example: 1,
    }),
    position: z.number().int().min(1).openapi({
      description: "Display order (1 = first)",
      example: 1,
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ProductImage");

export const ProductVariantSchema = z
  .object({
    id: z.string().openapi({ example: "var_abc123" }),
    productId: z.string().openapi({ example: "prod_abc123" }),
    variations: z.record(z.string(), z.string()).openapi({
      description: "Key-value map matching the product's variantOptions axes",
      example: { Color: "Red", Size: "M" },
    }),
    currency: z.string().openapi({ example: "DZD" }),
    price: z.number().int().min(0).openapi({
      description: "Price in DZD",
      example: 45000,
    }),
    compareAtPrice: z.number().int().min(0).nullable().openapi({ example: null }),
    sku: z.string().openapi({
      description:
        "Unique stock-keeping unit identifier. Used for order tracking and inventory management.",
      example: "GALAXY-A54-RED-M",
    }),
    barcode: z.string().nullable().openapi({ example: null }),
    inventory: z.number().int().min(0).openapi({ example: 25 }),
    lowStockThreshold: z.number().int().min(0).openapi({
      description: "Alert when this variant's stock drops to this level.",
      example: 5,
    }),
    weightKg: z.number().min(0).nullable().openapi({ example: null }),
    imageId: z.string().nullable().openapi({
      description: "Product image ID associated with this variant",
      example: null,
    }),
    isDefault: z.boolean().openapi({ example: false }),
    active: z.boolean().openapi({ example: true }),
    position: z.number().int().min(1).openapi({ example: 1 }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ProductVariant");

export const ProductSchema = z
  .object({
    id: z.string().openapi({ example: "prod_abc123" }),
    name: z.string().openapi({ example: "Samsung Galaxy A54" }),
    description: z.string().nullable().openapi({
      example: "6.4-inch display, 5000mAh battery",
    }),
    handle: z.string().openapi({
      description: "URL slug — auto-generated from name if not provided",
      example: "samsung-galaxy-a54-1a2b3c4d",
    }),
    currency: z.string().openapi({ example: "DZD" }),
    price: z.number().int().min(0).openapi({
      description: "Price in DZD (smallest unit)",
      example: 45000,
    }),
    compareAtPrice: z.number().int().min(0).nullable().openapi({ example: null }),
    costPrice: z.number().int().min(0).nullable().openapi({ example: null }),
    type: z.enum(["PHYSICAL", "DIGITAL"]).openapi({ example: "PHYSICAL" }),
    hasVariants: z.boolean().openapi({ example: true }),
    variantOptions: z.array(ProductVariantOptionSchema).nullable().openapi({
      description:
        "Variant option axes. Parsed from JSON storage — null when the product has no options.",
    }),
    sku: z.string().nullable().openapi({
      description:
        "Only used by simple products (hasVariants=false); variant products carry SKU on each variant.",
      example: null,
    }),
    inventory: z.number().int().min(0).openapi({
      description: "Stock for simple products; ignored for variant products.",
      example: 0,
    }),
    lowStockThreshold: z.number().int().min(0).openapi({
      description: "Alert when stock drops to this level. Ignored for variant products (threshold is per-variant).",
      example: 5,
    }),
    trackInventory: z.boolean().openapi({ example: true }),
    categoryId: z.string().nullable().openapi({ example: "cat_123" }),
    tags: z.array(z.string()).openapi({
      description: "Parsed from JSON storage.",
      example: ["samsung", "smartphone"],
    }),
    visibility: z.boolean().openapi({ example: true }),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).openapi({ example: "ACTIVE" }),
    showInStore: z.boolean().openapi({ example: true }),
    storeFeatured: z.boolean().openapi({ example: false }),
    deletedAt: z.string().datetime().nullable().openapi({
      description: "Soft-delete timestamp; products with a value are excluded from all responses",
      example: null,
    }),
    publishedAt: z.string().datetime().nullable().openapi({
      description: "Auto-set when status changes to ACTIVE",
      example: "2026-01-15T09:30:00.000Z",
    }),
    shippingProfileId: z.string().nullable().openapi({
      description:
        "Shipping profile ID for this product. Null = store default profile is used.",
      example: null,
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),

    variantsCount: z.number().int().openapi({
      description: "Number of variants attached to this product",
      example: 3,
    }),
    totalInventory: z.number().int().openapi({
      description:
        "Sum of variant inventory for variant products; product.inventory for simple products",
      example: 75,
    }),
    variants: z.array(ProductVariantSchema).openapi({
      description: "Variants ordered by position; variations are parsed into objects",
    }),

    primaryImageSrc: z.string().nullable().optional().openapi({
      description: "First image URL by position. Included in list responses only.",
      example: "https://cdn.example.com/products/abc123.jpg",
    }),
    reviewCount: z.number().int().optional().openapi({
      description: "Approved review count. Included in list responses only.",
      example: 12,
    }),
    avgRating: z.number().nullable().optional().openapi({
      description: "Average approved rating (1 decimal), null when unreviewed. Included in list responses only.",
      example: 4.5,
    }),

    category: ProductCategoryRowSchema.nullable().optional().openapi({
      description: "Full category record. Included only in GET /{id} detail responses.",
    }),
    images: z.array(ProductImageSchema).optional().openapi({
      description: "Images ordered by position. Included only in GET /{id} detail and mutation responses.",
    }),
  })
  .openapi("Product");

export const StockMovementSchema = z
  .object({
    id: z.string().openapi({ example: "mov_abc123" }),
    productId: z.string().openapi({ example: "prod_abc123" }),
    variantId: z.string().nullable().openapi({
      description: "Variant ID for variant-level movements; null for simple products",
      example: null,
    }),
    type: z.enum([
      "PURCHASE",
      "ADJUSTMENT_ADD",
      "ADJUSTMENT_REMOVE",
      "ORDER_DEDUCTED",
      "ORDER_CANCELLED",
      "ORDER_RETURNED",
      "OFFLINE_SALE",
    ]),
    delta: z.number().int().openapi({
      description: "Positive = stock in, negative = stock out. Never zero.",
      example: 10,
    }),
    qtyBefore: z.number().int().openapi({ example: 5 }),
    qtyAfter: z.number().int().openapi({ example: 15 }),
    reason: z.string().nullable().openapi({
      description:
        "User-supplied note. Required by the API for ADJUSTMENT_ADD, ADJUSTMENT_REMOVE and OFFLINE_SALE.",
      example: "Restocked from supplier",
    }),
    reference: z.string().nullable().openapi({
      description: "orderId for ORDER_* movement types; null otherwise.",
      example: null,
    }),
    createdBy: z.string(),
    createdByName: z.string().openapi({ example: "Ahmed Benali" }),
    createdAt: z.string().datetime(),
  })
  .openapi("StockMovement");

export const StockAlertItemSchema = z
  .object({
    productId: z.string().openapi({ example: "prod_abc123" }),
    variantId: z.string().nullable().openapi({ example: null }),
    productName: z.string().openapi({ example: "Samsung Galaxy A54" }),
    variantLabel: z.string().nullable().openapi({
      description:
        "Concatenated variant option values, e.g. 'Red / M'. Null for simple products.",
      example: "أحمر / M",
    }),
    inventory: z.number().int().openapi({ example: 2 }),
    lowStockThreshold: z.number().int().openapi({ example: 5 }),
    isOutOfStock: z.boolean().openapi({ example: false }),
  })
  .openapi("StockAlertItem");

export const StockOverviewSchema = z
  .object({
    totalSkus: z.number().int().openapi({
      description: "Total number of tracked SKUs (simple + variants).",
      example: 42,
    }),
    outOfStockCount: z.number().int().openapi({ example: 3 }),
    lowStockCount: z.number().int().openapi({ example: 7 }),
    totalInventoryValue: z.number().int().openapi({
      description: "Sum of (inventory × price) across all tracked SKUs, in DZD.",
      example: 1250000,
    }),
    currency: z.string().openapi({ example: "DZD" }),
    outOfStockItems: z.array(StockAlertItemSchema),
    lowStockItems: z.array(StockAlertItemSchema).openapi({
      description: "Items at or below their low stock threshold (but still in stock).",
    }),
    allItems: z.array(StockAlertItemSchema).openapi({
      description:
        "Every tracked SKU. Sorted: out-of-stock first, then by inventory ascending. Used by the inventory table.",
    }),
  })
  .openapi("StockOverview");

export const OfferSchema = z
  .object({
    id: z.string().openapi({ description: "Offer UUID", example: "off_abc123" }),
    name: z.string().openapi({
      description: "Merchant-facing display name.",
      example: "اشتري 2 واحصل على 1 مجاناً",
    }),
    triggerProduct: z
      .object({
        id: z.string().openapi({ description: "Product UUID" }),
        name: z.string().openapi({ example: "Samsung Galaxy A54" }),
        handle: z.string().openapi({
          description: "URL-friendly product handle",
          example: "samsung-galaxy-a54",
        }),
      })
      .nullable()
      .openapi({
        description:
          "The product the customer must purchase to trigger this offer. Null when the trigger product no longer exists.",
      }),
    triggerVariant: z
      .object({
        id: z.string().openapi({ description: "Variant UUID" }),
        label: z.string().openapi({
          description: "Human-readable label built from variation values.",
          example: "أزرق / 128 GB",
        }),
      })
      .nullable()
      .openapi({
        description:
          "Specific variant required to trigger the offer. null = any variant of the trigger product.",
      }),
    triggerQuantity: z.number().int().min(1).openapi({
      description: "Minimum quantity of the trigger product the customer must order.",
      example: 2,
    }),
    rewardProduct: z
      .object({
        id: z.string().openapi({ description: "Product UUID" }),
        name: z.string().openapi({ example: "Samsung Galaxy Buds" }),
        handle: z.string().openapi({
          description: "URL-friendly product handle",
          example: "samsung-galaxy-buds",
        }),
      })
      .nullable()
      .openapi({
        description:
          "The product the customer receives for free when the offer triggers. null for `free_shipping` offers.",
      }),
    rewardVariant: z
      .object({
        id: z.string().openapi({ description: "Variant UUID" }),
        label: z.string().openapi({
          description: "Human-readable label built from variation values.",
          example: "أبيض",
        }),
      })
      .nullable()
      .openapi({
        description:
          "Specific variant given as the reward. null = same variant as the ordered item (when same product) or the first active variant (when different product). Always null for `free_shipping` offers.",
      }),
    rewardQuantity: z.number().int().min(0).openapi({
      description: "Number of free reward units added to the order. 0 for `free_shipping` offers.",
      example: 1,
    }),
    discountType: z.enum(["free", "free_shipping"]).openapi({
      description:
        "`free` = reward product added at price 0. `free_shipping` = delivery fee waived (no reward product).",
    }),
    startsAt: z.string().datetime().nullable().openapi({
      description: "UTC ISO-8601 datetime when the offer becomes active. null = no start restriction.",
      example: null,
    }),
    endsAt: z.string().datetime().nullable().openapi({
      description: "UTC ISO-8601 datetime when the offer expires. null = no end restriction.",
      example: null,
    }),
    status: z.enum(["active", "inactive"]).openapi({
      description: "Only `active` offers within the schedule window are auto-applied to store orders.",
      example: "active",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Offer");

export const DriverPaymentSchema = z
  .object({
    id: z.string().openapi({ example: "pay_abc123" }),
    driverId: z.string().openapi({ description: "UUID of the driver this payment is for" }),
    type: z.enum(["cod_remittance", "fee_payment", "net_settlement"]).openapi({
      description:
        "`cod_remittance`: driver hands COD cash to business. `fee_payment`: business pays driver fees. `net_settlement`: both at once (driver hands COD − fees net amount).",
      example: "cod_remittance",
    }),
    amount: z.number().openapi({
      description:
        "Settled amount, computed server-side from frozen order values: COD total (`cod_remittance`), fee total (`fee_payment`), or COD − fees (`net_settlement`).",
      example: 95000,
    }),
    orderCount: z.number().int().openapi({
      description: "Number of orders included in this payment batch.",
      example: 3,
    }),
    notes: z.string().nullable().openapi({
      description: "Optional internal note about this payment record.",
      example: null,
    }),
    createdBy: z.string().openapi({
      description: "User ID of the team member who recorded this payment.",
    }),
    createdByName: z.string().openapi({
      description: "Denormalised display name for audit trail.",
      example: "Ahmed Benali",
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("DriverPayment");

export const UploadedImageSchema = z
  .object({
    key: z.string().openapi({
      description: "R2 object key — pass to POST /api/products/{id}/images as `key`",
      example: "products/abc123def456.jpg",
    }),
    url: z.string().url().openapi({
      description: "Public URL for the uploaded image",
      example: "https://cdn.example.com/products/abc123def456.jpg",
    }),
  })
  .openapi("UploadedImage");

export const PresignedUploadSchema = z
  .object({
    presignedUrl: z.string().url().openapi({
      description: "PUT this URL directly from the browser to upload the file",
    }),
    key: z.string().openapi({
      description: "R2 object key — pass to POST /api/products/{id}/images as `key`",
      example: "products/abc123def456.jpg",
    }),
    publicUrl: z.string().url().openapi({
      description: "Permanent public URL served via custom domain",
    }),
  })
  .openapi("PresignedUpload");

// ─── Orders ───────────────────────────────────────────────────────────────────

export const OrderStatusEnum = z.enum([
  "new",
  "confirmed",
  "unreachable",
  "preparing",
  "ready",
  "assigned",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "returned",
  "cancelled",
]);

export const StatusHistoryItemSchema = z
  .object({
    id: z.string(),
    orderId: z.string(),
    status: OrderStatusEnum,
    timestamp: z.string().datetime().openapi({
      description: "When the status change happened",
    }),
    by: z.string().nullable().openapi({
      description: "User ID who triggered the status change",
    }),
    byName: z.string().nullable().openapi({
      description: "User display name",
    }),
  })
  .openapi("StatusHistoryItem");

export const OrderProductSchema = z
  .object({
    id: z.string(),
    orderId: z.string(),
    productId: z.string(),
    productName: z.string(),
    variantId: z.string().nullable(),
    variantLabel: z.string().nullable(),
    sku: z.string().nullable().openapi({
      description: "Denormalized SKU at time of order",
    }),
    quantity: z.number().int().openapi({ example: 2 }),
    pricePerUnit: z.number().openapi({ example: 4500 }),
    lineTotal: z.number().openapi({ example: 9000 }),
    status: z.enum(["fulfilled", "partially_returned", "returned"]).openapi({
      description:
        "Per-line fulfilment outcome — updated via PATCH /orders/{id}/products/{productLineId}/return",
    }),
    returnedQuantity: z.number().int().openapi({
      description:
        "Units the customer refused at the door. Always 0 when status=fulfilled, = quantity when status=returned.",
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("OrderProduct");

export const OrderSchema = z
  .object({
    id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    orderNumber: z.string().openapi({ example: "ORD-20260327-0042" }),
    customerId: z.string(),
    customerName: z.string().openapi({ example: "Ahmed Benali" }),
    phone: z.string().openapi({ example: "0551234567" }),
    wilayaId: z.number().int().min(1).max(58).nullable().openapi({ example: 16 }),
    wilaya: z.string().nullable().openapi({
      description: "Wilaya Arabic name, joined from reference table",
      example: "الجزائر",
    }),
    communeId: z.string().nullable(),
    commune: z.string().nullable().openapi({
      description: "Commune Arabic name, joined from reference table",
      example: "بئر مراد رايس",
    }),
    city: z.string().nullable(),
    address: z.string().nullable(),
    price: z.number().openapi({
      description: "Product subtotal (excluding delivery fee)",
      example: 9000,
    }),
    notes: z.string().nullable(),
    status: OrderStatusEnum,
    orderType: z.enum(["online", "offline"]),
    deliveryMethod: z.enum(["unassigned", "driver", "company"]).openapi({
      description:
        "Default 'unassigned' at creation; flips to 'driver' or 'company' on assignment.",
    }),
    driverId: z.string().nullable(),
    driverName: z.string().nullable().openapi({
      description: "Driver display name, joined from drivers table",
    }),
    companyId: z.string().nullable(),
    assignedAt: z.string().datetime().nullable(),
    assignedBy: z.string().nullable(),
    assignmentNotes: z.string().nullable(),
    trackingNumber: z.string().nullable(),
    trackingUrl: z.string().nullable(),
    externalOrderId: z.string().nullable(),
    deliveryType: z.enum(["home", "stop_desk"]),
    stationCode: z.string().nullable(),
    deliveryFee: z.number().openapi({ example: 400 }),
    driverFee: z.number().openapi({
      description:
        "What the store pays the driver for this delivery, looked up from driver_compensations by (driverId, wilayaId). 0 when no compensation row exists or no driver assigned.",
      example: 250,
    }),
    codAmount: z.number().nullable().openapi({
      description: "Amount the driver collects from customer: price + deliveryFee",
      example: 9400,
    }),
    pickupTime: z.string().datetime().nullable(),
    deliveryTime: z.string().datetime().nullable(),
    deliveryAttempts: z.number().int().nullable(),
    photos: z.string().nullable().openapi({
      description: "JSON array of photo URLs — delivery proof photos",
    }),
    codPaymentId: z.string().nullable(),
    feePaymentId: z.string().nullable(),
    weight: z.number().nullable().openapi({
      description: "Parcel weight in kg — sent to carrier API when set",
    }),
    isFragile: z.boolean().nullable().openapi({
      description: "Fragile parcel flag — sent to carrier API when set",
    }),
    hasReview: z.number().int().optional().openapi({
      description: "1 if a customer review exists for this order, 0 otherwise. Included in list responses only (GET /api/orders).",
    }),
    lastUpdatedBy: z.string().nullable().optional().openapi({
      description: "User ID of the last status-change actor. Included in list responses only (GET /api/orders).",
    }),
    products: z.array(OrderProductSchema).optional().openapi({
      description: "Order line items. Included in GET /api/orders/{id} (detail view only).",
    }),
    statusHistory: z.array(StatusHistoryItemSchema).optional().openapi({
      description: "Full status change log. Included in GET /api/orders/{id} (detail view only).",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Order");







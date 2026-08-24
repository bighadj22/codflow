/**
 * Orders API Response Schemas
 *
 * Clean, organized schemas for Orders API responses. Follows best practices:
 * - Input validation stays in endpoints/orders/validation.ts
 * - Response documentation lives here
 * - Use schema composition to avoid duplication
 * - Consistent naming: *Schema for entities, *ResponseSchema for API responses
 *
 * Related files:
 * - endpoints/orders/validation.ts: Request input schemas
 * - endpoints/orders/handlers.ts: CRUD handlers
 * - endpoints/orders/routes.ts: OpenAPI route definitions
 */

import { z } from "@hono/zod-openapi";

// ─── Enums & Constants ────────────────────────────────────────────────────────

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

export const DeliveryMethodEnum = z.enum(["unassigned", "driver", "company"]);
export const DeliveryTypeEnum = z.enum(["home", "stop_desk"]);
export const OrderTypeEnum = z.enum(["online", "offline"]);
export const OrderProductStatusEnum = z.enum(["fulfilled", "partially_returned", "returned"]);

// ─── Nested/Child Schemas ─────────────────────────────────────────────────────

/**
 * Single status change entry in order history
 */
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

/**
 * Single product line in an order
 */
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
    status: OrderProductStatusEnum.openapi({
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

// ─── Base Order Schema (shared fields) ────────────────────────────────────────

/**
 * Base order fields shared across list and detail views
 */
const OrderBaseSchema = z.object({
  id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  orderNumber: z.string().openapi({ example: "ORD-20260327-0042" }),
  customerId: z.string(),
  customerName: z.string().openapi({ example: "Ahmed Benali" }),
  phone: z.string().openapi({ example: "0551234567" }),
  
  // Location (with joins)
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

  // Pricing
  price: z.number().openapi({
    description: "Product subtotal (excluding delivery fee)",
    example: 9000,
  }),
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

  // Status & workflow
  status: OrderStatusEnum,
  orderType: OrderTypeEnum,
  deliveryMethod: DeliveryMethodEnum.openapi({
    description:
      "Default 'unassigned' at creation; flips to 'driver' or 'company' on assignment.",
  }),
  deliveryType: DeliveryTypeEnum,

  // Assignment & dispatch
  driverId: z.string().nullable(),
  driverName: z.string().nullable().openapi({
    description: "Driver display name, joined from drivers table",
  }),
  companyId: z.string().nullable(),
  assignedAt: z.string().datetime().nullable(),
  assignedBy: z.string().nullable(),
  assignmentNotes: z.string().nullable(),
  
  // Carrier integration
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  externalOrderId: z.string().nullable(),
  stationCode: z.string().nullable(),

  // Delivery tracking
  pickupTime: z.string().datetime().nullable(),
  deliveryTime: z.string().datetime().nullable(),
  deliveryAttempts: z.number().int().nullable(),
  
  // Metadata
  notes: z.string().nullable(),
  photos: z.string().nullable().openapi({
    description: "JSON array of photo URLs — delivery proof photos",
  }),
  weight: z.number().nullable().openapi({
    description: "Parcel weight in kg — sent to carrier API when set",
  }),
  isFragile: z.boolean().nullable().openapi({
    description: "Fragile parcel flag — sent to carrier API when set",
  }),

  // Payment reconciliation
  codPaymentId: z.string().nullable(),
  feePaymentId: z.string().nullable(),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ─── List View (for GET /orders) ──────────────────────────────────────────────

/**
 * Order list item - includes joins but not heavy nested arrays
 */
export const OrderListItemSchema = OrderBaseSchema.extend({
  hasReview: z.number().int().optional().openapi({
    description:
      "1 if a customer review exists for this order, 0 otherwise. Included in list responses only (GET /api/orders).",
  }),
  lastUpdatedBy: z.string().nullable().optional().openapi({
    description:
      "User ID of the last status-change actor. Included in list responses only (GET /api/orders).",
  }),
}).openapi("OrderListItem", {
  description: "Order summary for list view - includes joins but not nested arrays",
});

// ─── Detail View (for GET /orders/{id}) ───────────────────────────────────────

/**
 * Full order detail - includes products and status history
 */
export const OrderDetailSchema = OrderBaseSchema.extend({
  products: z.array(OrderProductSchema).optional().openapi({
    description: "Order line items. Included in GET /api/orders/{id} (detail view only).",
  }),
  statusHistory: z.array(StatusHistoryItemSchema).optional().openapi({
    description: "Full status change log. Included in GET /api/orders/{id} (detail view only).",
  }),
}).openapi("Order", {
  description: "Complete order record with products and status history",
});

// For backward compatibility - routes.ts currently uses "OrderSchema"
export const OrderSchema = OrderDetailSchema;

// ─── Create Order Response ────────────────────────────────────────────────────

/**
 * Response data returned after successfully creating an order
 */
export const OrderCreatedDataSchema = z
  .object({
    id: z.string().openapi({ description: "Newly created order ID" }),
    orderNumber: z.string().openapi({ example: "ORD-20260327-0042" }),
    deliveryFee: z.number().openapi({
      description: "Calculated delivery fee (from shipping profile or admin override)",
      example: 600,
    }),
    price: z.number().openapi({
      description: "Product subtotal (excluding delivery fee)",
      example: 2500,
    }),
    codAmount: z.number().openapi({
      description: "Total amount to collect (price + deliveryFee)",
      example: 3100,
    }),
    customerId: z.string(),
    customerName: z.string(),
    phone: z.string(),
    wilayaId: z.number().int(),
    communeId: z.string().nullable(),
    deliveryType: DeliveryTypeEnum,
    orderType: OrderTypeEnum,
    status: z.string().openapi({ description: "Initial order status", example: "new" }),
  })
  .openapi("OrderCreatedData");

// ─── Dispatch/Shipment Responses ──────────────────────────────────────────────

/**
 * Data returned after successfully dispatching an order to a carrier
 */
export const ShipmentCreatedDataSchema = z
  .object({
    shipmentId: z.string().openapi({ description: "Internal shipment record ID" }),
    trackingNumber: z.string().openapi({ example: "NE123456789DZ" }),
    labelUrl: z.string().nullable().openapi({
      description: "PDF label URL, if provided by the company",
    }),
  })
  .openapi("ShipmentCreatedData");

/**
 * Single order result in bulk dispatch operation
 */
export const BulkDispatchResultItemSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  labelUrl: z.string().optional(),
  error: z.string().optional().openapi({
    description: "Error message when this specific order failed to dispatch",
  }),
});

/**
 * Response data for bulk dispatch operation
 */
export const BulkDispatchDataSchema = z
  .object({
    results: z.array(BulkDispatchResultItemSchema),
  })
  .openapi("BulkDispatchData");

// ─── Return Product Response ──────────────────────────────────────────────────

/**
 * Response after recording a product line return
 */
export const ReturnProductDataSchema = z
  .object({
    returnedQuantity: z.number().int(),
    status: OrderProductStatusEnum,
  })
  .openapi("ReturnProductData");

// ─── Tracking & Shipment Operations ───────────────────────────────────────────

/**
 * Generic array of records for carrier-specific responses (tracking, remarks)
 */
export const CarrierRecordsArraySchema = z.array(z.record(z.string(), z.unknown())).openapi({
  description: "Structure varies by carrier API.",
});

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type OrderStatus = z.infer<typeof OrderStatusEnum>;
export type DeliveryMethod = z.infer<typeof DeliveryMethodEnum>;
export type DeliveryType = z.infer<typeof DeliveryTypeEnum>;
export type OrderType = z.infer<typeof OrderTypeEnum>;
export type OrderProductStatus = z.infer<typeof OrderProductStatusEnum>;


// ─── Abandoned Orders ─────────────────────────────────────────────────────────

export const AbandonedOrderStatusEnum = z.enum([
  "pending",
  "abandoned",
  "contacted",
  "converted",
]);

export const AbandonedOrderSchema = z
  .object({
    id: z.string().openapi({ example: "ab_abc123" }),
    sessionId: z.string().openapi({
      description: "Storefront session ID — unique per abandoned checkout",
    }),
    customerName: z.string().openapi({ example: "Ahmed Benali" }),
    phone: z.string().openapi({ example: "0551234567" }),
    wilayaId: z.number().int().min(1).max(58).nullable().openapi({ example: 16 }),
    communeId: z.string().nullable(),
    wilayaName: z.string().nullable().openapi({ example: "الجزائر" }),
    communeName: z.string().nullable(),
    productId: z.string().nullable(),
    productName: z.string().nullable().openapi({ example: "Samsung Galaxy A54" }),
    variantId: z.string().nullable(),
    variantLabel: z.string().nullable().openapi({ example: "أحمر / XL" }),
    price: z.number().nullable().openapi({
      description: "Cart value at abandonment",
      example: 9000,
    }),
    deliveryType: z.enum(["home", "stop_desk"]).nullable(),
    fbc: z.string().nullable().openapi({
      description: "_fbc cookie captured at input — links recovery back to the ad click",
    }),
    fbp: z.string().nullable().openapi({ description: "_fbp browser identity cookie" }),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    status: AbandonedOrderStatusEnum,
    convertedOrderId: z.string().nullable().openapi({
      description: "Set when the customer completes an order after contact",
    }),
    convertedOrderNumber: z.string().nullable(),
    recoveryAttempts: z.number().int().openapi({ example: 0 }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("AbandonedOrder");

export const AbandonedOrderStatsSchema = z
  .object({
    totalAbandoned: z.number().int().openapi({
      description: "Orders currently in `abandoned` status",
      example: 34,
    }),
    totalConverted: z.number().int().openapi({ example: 12 }),
    conversionRate: z.number().int().openapi({
      description: "Recovered percentage: converted / (abandoned + converted), rounded",
      example: 26,
    }),
    estimatedLostRevenue: z.number().openapi({
      description: "Sum of cart values still sitting in `abandoned` status, in DZD",
      example: 306000,
    }),
  })
  .openapi("AbandonedOrderStats");

export type AbandonedOrderStatus = z.infer<typeof AbandonedOrderStatusEnum>;

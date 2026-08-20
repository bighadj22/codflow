/**
 * Orders Validation Schemas
 * 
 * Zod schemas for request validation.
 */

import { z } from "zod";

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  phone: z.string().regex(/^0[5-7]\d{8}$/, "Invalid Algerian phone number"),
  wilayaId: z.number().int().min(1).max(58),
  communeId: z.string().min(1, "Commune is required"),
  city: z.string().nullish(),
  address: z.string().nullish(),
  price: z.number().positive(),
  notes: z.string().nullish(),
  orderType: z.enum(["online", "offline"]).default("online"),
  deliveryType: z.enum(["home", "stop_desk"]).default("home"),
  /** Optional explicit fee — for offline/dashboard orders. Online orders ignore this and auto-resolve from shipping profile. */
  deliveryFee: z.number().min(0).optional(),
  companyId: z.string().min(1).nullish(),
  products: z.array(
    z.object({
      productId: z.string().min(1),
      productName: z.string(),
      variantId: z.string().min(1).nullish(),
      variantLabel: z.string().nullish(),
      quantity: z.number().int().positive(),
      pricePerUnit: z.number().positive(),
      lineTotal: z.number().positive(),
    })
  ).min(1, "At least one product is required"),
}).superRefine((data, ctx) => {
  if (data.deliveryType === "home" && !data.address?.trim()) {
    ctx.addIssue({ code: "custom", path: ["address"], message: "Address is required for home delivery" });
  }
});

export const ORDER_STATUSES = [
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
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const assignDriverSchema = z.object({
  driverId: z.string().min(1),
});

/**
 * PATCH /orders/:id/products/:productLineId/return
 * Records how many units on a single order line the customer refused at the door.
 * Server computes status ("fulfilled" | "partially_returned" | "returned") from
 * the ratio of returnedQuantity to the line's original quantity.
 */
export const returnOrderProductSchema = z.object({
  returnedQuantity: z.number().int().min(0),
});

export const orderFiltersSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  wilayaId: z.coerce.number().int().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * POST /orders/bulk-dispatch — dispatch multiple existing orders to a delivery company.
 * Uses the provider's bulk creation API (up to 100 orders per request).
 */
export const bulkDispatchSchema = z.object({
  companyId: z.string().min(1),
  orderIds: z.array(z.string().min(1)).min(1).max(100, "Maximum 100 orders per bulk dispatch"),
});

export type BulkDispatchInput = z.infer<typeof bulkDispatchSchema>;

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
export type OrderFiltersInput = z.infer<typeof orderFiltersSchema>;
export type ReturnOrderProductInput = z.infer<typeof returnOrderProductSchema>;

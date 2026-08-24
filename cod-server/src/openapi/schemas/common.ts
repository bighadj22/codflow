/**
 * Common Response Schemas
 *
 * Shared response wrappers and utility schemas used across all API endpoints.
 * These provide consistent envelope formats for success, error, and list responses.
 */

import { z } from "@hono/zod-openapi";
import { ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";

// ─── Error Responses ──────────────────────────────────────────────────────────

const errorCategoryEnum = z.enum([
  ERROR_CATEGORIES.VALIDATION,
  ERROR_CATEGORIES.AUTHENTICATION,
  ERROR_CATEGORIES.BUSINESS_LOGIC,
  ERROR_CATEGORIES.SYSTEM,
]);

/**
 * Standard error envelope returned by all non-2xx responses
 */
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

// ─── Success Response Wrappers ────────────────────────────────────────────────

/**
 * Generic success envelope with typed data payload
 * 
 * @example
 * SuccessResponseSchema(OrderSchema)
 * // Returns: { success: true, data: Order }
 */
export function SuccessResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.boolean().openapi({ example: true }),
    data: dataSchema,
  });
}

/**
 * Success envelope with data and message
 * 
 * @example
 * SuccessWithMessageSchema(OrderCreatedDataSchema)
 * // Returns: { success: true, data: OrderCreatedData, message: string }
 */
export function SuccessWithMessageSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.boolean().openapi({ example: true }),
    data: dataSchema,
    message: z.string().openapi({ example: "Operation completed successfully" }),
  });
}

/**
 * Simple success message (no data payload)
 * 
 * @example
 * { success: true, message: "Order deleted" }
 */
export const MessageResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string(),
  })
  .openapi("MessageResponse");

// ─── List Response Wrappers ───────────────────────────────────────────────────

/**
 * Paginated list envelope with count
 * 
 * @example
 * ListResponseSchema(OrderListItemSchema)
 * // Returns: { success: true, data: OrderListItem[], count: number }
 */
export function ListResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    success: z.boolean().openapi({ example: true }),
    data: z.array(itemSchema),
    count: z.number().int().openapi({ description: "Number of items returned" }),
  });
}

/**
 * List envelope with both count (returned) and total (available)
 * 
 * @example
 * ListWithTotalResponseSchema(ReviewSchema)
 * // Returns: { success: true, data: Review[], count: 20, total: 145 }
 */
export function ListWithTotalResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    success: z.boolean().openapi({ example: true }),
    data: z.array(itemSchema),
    count: z.number().int().openapi({ description: "Number of items in this response" }),
    total: z.number().int().openapi({ description: "Total items available" }),
  });
}

// ─── Utility Schemas ──────────────────────────────────────────────────────────

/**
 * Standard ID path parameter
 */
export const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Resource ID" }),
});

/**
 * Standard pagination query parameters
 */
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    description: "Maximum number of items to return",
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Number of items to skip",
  }),
});

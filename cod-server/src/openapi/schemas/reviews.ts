/**
 * Review Schemas
 *
 * Product reviews submitted by customers.
 */

import { z } from "@hono/zod-openapi";

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

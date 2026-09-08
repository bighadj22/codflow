import { z } from "zod";

export const createUpsellSchema = z.object({
  upsellProductId: z.string().min(1).max(200),
  /** Integer DZD override; null = inherit the upsell product's own price. */
  price: z.number().int().min(0).nullable().optional(),
  compareAtPrice: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(1).optional(),
});

export const updateUpsellSchema = createUpsellSchema.partial().omit({ upsellProductId: true });

export type CreateUpsellInput = z.infer<typeof createUpsellSchema>;
export type UpdateUpsellInput = z.infer<typeof updateUpsellSchema>;
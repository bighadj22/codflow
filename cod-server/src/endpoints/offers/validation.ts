import { z } from "zod";

// Base object — no refinements so .partial() works cleanly for updates
const offerBaseSchema = z.object({
  name: z.string().min(2).max(200),
  discountType: z.enum(["free", "free_shipping"]).default("free"),
  triggerProductId: z.string().min(1),
  triggerVariantId: z.string().min(1).optional(),
  triggerQuantity: z.number().int().min(1).max(1000),
  // Required for 'free' type; omitted for 'free_shipping'
  rewardProductId: z.string().min(1).optional(),
  rewardVariantId: z.string().min(1).optional(),
  // 0 is valid for 'free_shipping' (no product reward)
  rewardQuantity: z.number().int().min(0).max(1000).default(1),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

// Create: add cross-field rule — rewardProductId required when discountType = 'free'
export const createOfferSchema = offerBaseSchema.superRefine((data, ctx) => {
  if (data.discountType === "free" && !data.rewardProductId) {
    ctx.addIssue({
      code: "custom",
      message: "rewardProductId is required for 'free' discount type",
      path: ["rewardProductId"],
    });
  }
});

// Update: all fields optional — .partial() on the base object, no refinement needed
export const updateOfferSchema = offerBaseSchema.partial();

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

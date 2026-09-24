import { z } from "zod";

// Base object — no refinements so .partial() works cleanly for updates
const landingPageBaseSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]{3,60}$/, "Slug must be 3-60 chars: lowercase letters, digits, hyphens")
    .optional(),
  productId: z.string().min(1),
  /** Pixels between stacked images — the only spacing setting. */
  imageGap: z.number().int().min(0).max(200).default(0),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(300).nullable().optional(),
});

export const createLandingPageSchema = landingPageBaseSchema;

export const updateLandingPageSchema = landingPageBaseSchema
  .omit({ productId: true })
  .partial();

export const reorderLandingPageImagesSchema = z.object({
  imageIds: z
    .array(z.string().min(1))
    .min(1),
});

export const saveLandingPageImageSchema = z.object({
  key: z.string().min(1),
  src: z.string().min(1),
  altText: z.string().nullable().optional(),
  position: z.number().int().min(1).optional(),
  /** Intrinsic pixel dimensions (client-measured at upload) — optional,
   *  fail-open: an image without dims still saves, the storefront just
   *  can't reserve its layout space. */
  width: z.number().int().min(1).max(20000).nullable().optional(),
  height: z.number().int().min(1).max(20000).nullable().optional(),
});

/**
 * A landing page's own Meta Pixel + Conversions API configuration.
 *
 * `conversionEvent` is required, exactly as it is for the store: which moment
 * counts as a conversion is a spend decision, and defaulting it silently would
 * have Meta optimising for something the merchant never chose.
 *
 * `accessToken` may be empty on an UPDATE — the dashboard only ever holds a
 * masked hint, so an untouched field arrives blank and the stored value is
 * kept. A CREATE with no token is refused in the handler, which is the only
 * place that knows whether a row already exists.
 */
export const landingPageTrackingSchema = z
  .object({
    pixelId: z.string().min(1).max(64),
    accessToken: z.string().max(512).optional(),
    adAccountName: z.string().max(200).nullable().optional(),
    testEventCode: z.string().max(64).nullable().optional(),
    conversionEvent: z.enum(["Lead", "Purchase", "Purchase_Confirmed", "Purchase_Delivered"]),
    testMode: z.boolean().optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    // Test mode with no code sends nothing to Meta's test stream and
    // everything to production measurement — the opposite of the intent.
    if (value.testMode && !value.testEventCode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["testEventCode"],
        message: "A test event code is required while test mode is on",
      });
    }
  });

export type LandingPageTrackingInput = z.infer<typeof landingPageTrackingSchema>;

export type CreateLandingPageInput = z.infer<typeof createLandingPageSchema>;
export type UpdateLandingPageInput = z.infer<typeof updateLandingPageSchema>;
export type SaveLandingPageImageInput = z.infer<typeof saveLandingPageImageSchema>;

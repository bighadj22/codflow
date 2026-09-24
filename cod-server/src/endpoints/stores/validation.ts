import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid hex color");

export const updateStoreSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  /**
   * The storefront's custom domain (e.g. "demo.codflow.store"). Merchants
   * connect their own domain and set it here; landing page links and share
   * URLs are built from it. No scheme — https is always assumed. null clears
   * it (links fall back to the deployment's storefront URL or relative paths).
   */
  domain: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i, "Domain must be a hostname like store.example.com")
    .max(200)
    .nullable()
    .optional(),
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  bgColor: hexColor.optional(),
  fontFamily: z.string().min(1).max(200).optional(),
  fontUrl: z.string().url().nullable().optional(),
  lang: z.enum(["ar", "en"]).optional(),
  currencySymbol: z.string().min(1).max(10).optional(),
  contentJson: z.string().nullable().optional(),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
  ogImage: z.string().url().nullable().optional(),
  announcementBar: z.string().max(500).nullable().optional(),
  reviewsEnabled: z.boolean().optional(),
  /**
   * Shopping cart opt-in. Strictly boolean: a form posting the string "false"
   * is truthy in JS, so the schema is what has to refuse it. Omit the field to
   * leave the setting unchanged; null is not a way to say "off".
   */
  cartEnabled: z.boolean().optional(),
  /**
   * Order subtotal (DZD) at or above which delivery is free.
   * null turns the feature OFF. A minimum of 1 is deliberate: 0 would mean
   * every order ships free, which is a different intention and must be
   * expressed by setting the threshold to 1, not by a value that reads as
   * "unset". Guarding it here keeps the ambiguity out of the database.
   */
  freeShippingThreshold: z
    .number()
    .int()
    .min(1, "Threshold must be at least 1 DZD — use null to turn it off")
    .max(10_000_000)
    .nullable()
    .optional(),
  /** Which rate a basket spanning several shipping profiles pays. */
  cartShippingMode: z.enum(["highest", "default_profile"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

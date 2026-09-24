import { z } from "zod";
import { PAGE_SLUG_MAX, PAGE_SLUG_MIN, PAGE_SLUG_PATTERN } from "../../../../cod-shared/legal/kinds";

export const slugSchema = z
  .string()
  .min(PAGE_SLUG_MIN)
  .max(PAGE_SLUG_MAX)
  .regex(PAGE_SLUG_PATTERN, "Slug must be lowercase letters, digits, and single hyphens");

export const localeSchema = z.enum(["ar", "en", "fr"]);

export const createCustomPageSchema = z.object({
  slug: slugSchema,
  locale: localeSchema,
  title: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(300).nullable().optional(),
  showInFooter: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateStorePageMetaSchema = z.object({
  slug: slugSchema.optional(),
  status: z.enum(["published", "draft"]).optional(),
  showInFooter: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const saveTranslationSchema = z.object({
  title: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(300).nullable().optional(),
});

export const upsertLegalProfileSchema = z.object({
  legalName: z.string().max(200).nullable().optional(),
  rcNumber: z.string().max(60).nullable().optional(),
  nif: z.string().max(60).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  returnWindowDays: z.number().int().min(0).max(90).optional(),
  deliveryMinDays: z.number().int().min(0).max(60).optional(),
  deliveryMaxDays: z.number().int().min(0).max(60).optional(),
});

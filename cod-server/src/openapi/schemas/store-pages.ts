/**
 * Store Page Schemas
 *
 * Merchant-owned content pages: Terms, Privacy, Refund/Return, Shipping, and
 * any custom page. See report-md/LEGAL_PAGES_PLAN.md.
 */

import { z } from "@hono/zod-openapi";

export const StorePageKindEnum = z.enum(["terms", "privacy", "refund", "shipping", "custom"]);
export const StorePageStatusEnum = z.enum(["published", "draft"]);
export const PageLocaleEnum = z.enum(["ar", "en", "fr"]);
export const TranslationSourceEnum = z.enum(["template", "merchant"]);

export const StorePageTranslationSummarySchema = z
  .object({
    locale: PageLocaleEnum,
    title: z.string().openapi({ example: "سياسة الإرجاع والاسترجاع" }),
    source: TranslationSourceEnum.openapi({
      description:
        "'template' = still the seeded text, never reviewed. 'merchant' = edited at least once.",
      example: "template",
    }),
    updatedAt: z.string().datetime(),
  })
  .openapi("StorePageTranslationSummary");

export const StorePageSummarySchema = z
  .object({
    id: z.string().openapi({ example: "sp_abc123" }),
    kind: StorePageKindEnum,
    slug: z.string().openapi({
      description: "Public URL segment — /pages/<slug>",
      example: "refund-policy",
    }),
    status: StorePageStatusEnum,
    showInFooter: z.boolean(),
    position: z.number().int(),
    templateVersion: z.number().int().nullable().openapi({
      description: "Which template revision this page's prose was last seeded/reset from. Null for custom pages.",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    translations: z.array(StorePageTranslationSummarySchema),
  })
  .openapi("StorePageSummary");

export const StorePageTranslationBodySchema = z
  .object({
    pageId: z.string(),
    locale: PageLocaleEnum,
    title: z.string(),
    bodyHtml: z.string().openapi({
      description: "Sanitised HTML — h2/p/strong/ul/li/etc. Render with set:html, never re-sanitise.",
    }),
    bodyPlain: z.string(),
    metaTitle: z.string().nullable(),
    metaDescription: z.string().nullable(),
    source: TranslationSourceEnum,
    updatedAt: z.string().datetime(),
  })
  .openapi("StorePageTranslationBody");

export const StorePageDetailSchema = StorePageSummarySchema.extend({
  bodies: z
    .object({
      ar: StorePageTranslationBodySchema.optional(),
      en: StorePageTranslationBodySchema.optional(),
      fr: StorePageTranslationBodySchema.optional(),
    })
    .openapi({ description: "Full body per locale. A locale never saved is absent, not null." }),
}).openapi("StorePageDetail");

export const StoreLegalProfileSchema = z
  .object({
    storeId: z.string(),
    legalName: z.string().nullable(),
    rcNumber: z.string().nullable().openapi({ description: "Registre de Commerce number" }),
    nif: z.string().nullable().openapi({ description: "Numéro d'Identification Fiscale" }),
    address: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    returnWindowDays: z.number().int().min(0).openapi({
      description: "0 = no post-delivery return window offered; the refund page's return clause is dropped.",
    }),
    deliveryMinDays: z.number().int().min(0),
    deliveryMaxDays: z.number().int().min(0),
    updatedAt: z.string().datetime(),
  })
  .openapi("StoreLegalProfile");

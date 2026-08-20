/**
 * Product form — client-side Zod validation
 *
 * Validates the raw string-based form state (prices are kept as strings
 * in <input type="number"> until submit).
 *
 * Usage:
 *   const schema = createProductFormSchema(locale);
 *   const result = schema.safeParse(formData);
 */

import { z } from "zod";
import type { Locale } from "@/lib/i18n-context";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true for an empty string (field left blank) or a non-negative number. */
const isOptionalNonNegative = (v: string) =>
  v === "" || (!isNaN(Number(v)) && Number(v) >= 0);

/** Returns true for a non-empty string that is a non-negative number. */
const isNonNegative = (v: string) =>
  v !== "" && !isNaN(Number(v)) && Number(v) >= 0;

// ── Per-locale validation messages ────────────────────────────────────────────
const MESSAGES = {
  ar: {
    name:           { required: "اسم المنتج مطلوب" },
    sku:            { required: "رمز SKU مطلوب للمنتجات البسيطة" },
    variantSku:     { required: "رمز SKU مطلوب لكل متغير" },
    price:          { required: "السعر مطلوب", invalid: "يجب أن يكون السعر صفراً أو أكثر" },
    compareAtPrice: { invalid: "يجب أن يكون سعر المقارنة صفراً أو أكثر" },
    costPrice:      { invalid: "يجب أن يكون سعر التكلفة صفراً أو أكثر" },
    variantPrice:   { invalid: "أسعار المتغيرات يجب أن تكون صفراً أو أكثر" },
  },
  en: {
    name:           { required: "Product name is required" },
    sku:            { required: "SKU is required for simple products" },
    variantSku:     { required: "SKU is required for every variant" },
    price:          { required: "Price is required", invalid: "Price must be 0 or more" },
    compareAtPrice: { invalid: "Compare-at price must be 0 or more" },
    costPrice:      { invalid: "Cost price must be 0 or more" },
    variantPrice:   { invalid: "Variant prices must be 0 or more" },
  },
  fr: {
    name:           { required: "Le nom du produit est obligatoire" },
    sku:            { required: "Le SKU est obligatoire pour les produits simples" },
    variantSku:     { required: "Le SKU est obligatoire pour chaque variante" },
    price:          { required: "Le prix est obligatoire", invalid: "Le prix doit être ≥ 0" },
    compareAtPrice: { invalid: "Le prix de comparaison doit être ≥ 0" },
    costPrice:      { invalid: "Le prix de revient doit être ≥ 0" },
    variantPrice:   { invalid: "Les prix des variantes doivent être ≥ 0" },
  },
} satisfies Record<Locale, unknown>;

// ── Schema factory ─────────────────────────────────────────────────────────────
export function createProductFormSchema(locale: Locale, hasVariants: boolean) {
  const m = MESSAGES[locale];

  const variantRowSchema = z.object({
    sku:   z.string().min(1, m.variantSku.required),
    price: z.string().refine(isNonNegative, m.variantPrice.invalid),
  });

  return z.object({
    name:           z.string().min(1, m.name.required),
    sku:            hasVariants
                      ? z.string().optional()
                      : z.string().min(1, m.sku.required),
    price:          z.string().min(1, m.price.required).refine(isNonNegative, m.price.invalid),
    compareAtPrice: z.string().refine(isOptionalNonNegative, m.compareAtPrice.invalid),
    costPrice:      z.string().refine(isOptionalNonNegative, m.costPrice.invalid),
    variantRows:    z.array(variantRowSchema).optional(),
  });
}

// ── Exported types ─────────────────────────────────────────────────────────────
export type ProductFormSchema = ReturnType<typeof createProductFormSchema>;
export type ProductFormValues = z.infer<ProductFormSchema>;
export type ProductFormErrors = {
  name?: string;
  sku?: string;
  price?: string;
  compareAtPrice?: string;
  costPrice?: string;
  variantRows?: string;      // one message covers all row-level price errors
  variantRowsSku?: string;   // one message covers all row-level SKU errors
};

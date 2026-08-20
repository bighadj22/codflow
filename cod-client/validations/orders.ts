/**
 * Order form — client-side Zod validation
 *
 * Usage:
 *   const schema = createOrderFormSchema(locale);
 *   const result = schema.safeParse(formData);
 */

import { z } from "zod";
import type { Locale } from "@/lib/i18n-context";

// ── Algerian mobile number: 0[5-7]XXXXXXXX ───────────────────────────────────
const ALGERIAN_PHONE = /^0[5-7]\d{8}$/;

// ── Per-locale validation messages ───────────────────────────────────────────
const MESSAGES = {
  ar: {
    customerName: { required: "اسم العميل مطلوب" },
    phone:        { required: "رقم الهاتف مطلوب", invalid: "رقم هاتف غير صحيح (مثال: 0551234567)" },
    wilayaId:     { required: "يرجى اختيار الولاية" },
    commune:      { required: "يرجى اختيار البلدية" },
    address:      { required: "العنوان مطلوب للتوصيل المنزلي" },
    products:     { required: "أضف منتجاً واحداً على الأقل" },
    deliveryFee:  { invalid: "رسوم التوصيل يجب أن تكون صفراً أو أكثر" },
  },
  en: {
    customerName: { required: "Customer name is required" },
    phone:        { required: "Phone number is required", invalid: "Invalid phone number (e.g. 0551234567)" },
    wilayaId:     { required: "Please select a wilaya" },
    commune:      { required: "Please select a commune" },
    address:      { required: "Address is required for home delivery" },
    products:     { required: "Add at least one product" },
    deliveryFee:  { invalid: "Delivery fee must be 0 or more" },
  },
  fr: {
    customerName: { required: "Le nom du client est obligatoire" },
    phone:        { required: "Le numéro de téléphone est obligatoire", invalid: "Numéro invalide (ex : 0551234567)" },
    wilayaId:     { required: "Veuillez sélectionner une wilaya" },
    commune:      { required: "Veuillez sélectionner une commune" },
    address:      { required: "L'adresse est obligatoire pour la livraison à domicile" },
    products:     { required: "Ajoutez au moins un produit" },
    deliveryFee:  { invalid: "Les frais de livraison doivent être ≥ 0" },
  },
} satisfies Record<Locale, unknown>;

// ── Per-product line schema (locale-independent — quantities are numbers) ─────
const orderProductSchema = z.object({
  productId:    z.string().min(1),
  productName:  z.string().min(1),
  variantId:    z.string().nullable().optional(),
  variantLabel: z.string().nullable().optional(),
  quantity:     z.number().int().positive(),
  pricePerUnit: z.number().positive(),
  lineTotal:    z.number().positive(),
});

// ── Schema factory ────────────────────────────────────────────────────────────
export function createOrderFormSchema(locale: Locale, deliveryType: "home" | "stop_desk" = "home") {
  const m = MESSAGES[locale];

  return z.object({
    customerName: z.string().min(1, m.customerName.required),
    phone: z
      .string()
      .min(1, m.phone.required)
      .regex(ALGERIAN_PHONE, m.phone.invalid),
    wilayaId: z
      .number()
      .int()
      .min(1, m.wilayaId.required),
    communeId:   z.string().min(1, m.commune.required),
    address:     deliveryType === "home"
      ? z.string().min(1, m.address.required)
      : z.string().nullable().optional(),
    deliveryFee: z.number().min(0, m.deliveryFee.invalid),
    products:    z.array(orderProductSchema).min(1, m.products.required),
  });
}

// ── Exported types ────────────────────────────────────────────────────────────
export type OrderFormSchema = ReturnType<typeof createOrderFormSchema>;
export type OrderFormValues = z.infer<OrderFormSchema>;
export type OrderFormErrors = Partial<Record<keyof OrderFormValues, string>>;

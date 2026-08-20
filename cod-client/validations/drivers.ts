/**
 * Driver form — client-side Zod validation
 *
 * Usage:
 *   const schema = createDriverFormSchema(locale);
 *   const result = schema.safeParse(formData);
 */

import { z } from "zod";
import type { Locale } from "@/lib/i18n-context";

// ── Algerian mobile number: 0[5-7]XXXXXXXX ───────────────────────────────────
const ALGERIAN_PHONE = /^0[5-7]\d{8}$/;

// ── Per-locale validation messages ───────────────────────────────────────────
const MESSAGES = {
  ar: {
    firstName: { required: "الاسم الأول مطلوب" },
    lastName:  { required: "اسم العائلة مطلوب" },
    phone:     { required: "رقم الهاتف مطلوب", invalid: "رقم هاتف غير صحيح (مثال: 0551234567)" },
    phone2:    { invalid: "رقم هاتف غير صحيح (مثال: 0551234567)" },
  },
  en: {
    firstName: { required: "First name is required" },
    lastName:  { required: "Last name is required" },
    phone:     { required: "Phone number is required", invalid: "Invalid phone number (e.g. 0551234567)" },
    phone2:    { invalid: "Invalid phone number (e.g. 0551234567)" },
  },
  fr: {
    firstName: { required: "Le prénom est obligatoire" },
    lastName:  { required: "Le nom de famille est obligatoire" },
    phone:     { required: "Le numéro de téléphone est obligatoire", invalid: "Numéro invalide (ex : 0551234567)" },
    phone2:    { invalid: "Numéro invalide (ex : 0551234567)" },
  },
} satisfies Record<Locale, unknown>;

// ── Schema factory ────────────────────────────────────────────────────────────
export function createDriverFormSchema(locale: Locale) {
  const m = MESSAGES[locale];

  return z.object({
    firstName: z.string().min(1, m.firstName.required),
    lastName:  z.string().min(1, m.lastName.required),
    phone: z
      .string()
      .min(1, m.phone.required)
      .regex(ALGERIAN_PHONE, m.phone.invalid),
    phone2: z
      .string()
      .regex(ALGERIAN_PHONE, m.phone2.invalid)
      .optional()
      .or(z.literal("")),
    vehicleType: z.enum(["motorcycle", "car", "van"]).optional().nullable(),
    notes:       z.string().optional().nullable(),
  });
}

// ── Exported types ────────────────────────────────────────────────────────────
export type DriverFormSchema = ReturnType<typeof createDriverFormSchema>;
export type DriverFormValues = z.infer<DriverFormSchema>;
export type DriverFormErrors = Partial<Record<keyof DriverFormValues, string>>;

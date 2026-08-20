// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Defines the placeOrder action: input validation + API call.         ║
// ║  UI customisation belongs in components, not here.                   ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { placeOrder } from "@/core/api/client";

export const server = {
  placeOrder: defineAction({
    accept: "form",
    input: z.object({
      productId: z.string().min(1),
      productName: z.string().min(1),
      // Forms always submit all hidden inputs — empty string must become undefined
      variantId: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().min(1).optional()
      ),
      variantLabel: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().optional()
      ),
      pricePerUnit: z.coerce.number().positive(),
      quantity: z.coerce.number().int().min(1).max(100).default(1),
      // Explicit offer tier selected by the user
      offerId: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().optional()
      ),
      // Per-unit variant selections — JSON string from hidden form input
      variantSelections: z.preprocess(
        (v) => {
          if (!v || typeof v !== "string" || v === "[]") return undefined;
          try { return JSON.parse(v as string); } catch { return undefined; }
        },
        z.array(z.object({
          variantId: z.string().min(1),
          variantLabel: z.string().optional(),
        })).optional()
      ),
      customerName: z.string().min(2, "الاسم مطلوب"),
      phone: z
        .string()
        .min(9, "رقم الهاتف غير صحيح")
        .max(20)
        .regex(/^[0-9+\s-]+$/, "رقم الهاتف غير صحيح"),
      wilayaId: z.coerce.number().int().min(1).max(58),
      communeId: z.string().min(1, "يرجى اختيار البلدية"),
      address: z.string().max(300).optional(),
      deliveryType: z.enum(["home", "stop_desk"]).default("home"),
      notes: z.string().max(500).optional(),
      fbc: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().optional()
      ),
      fbp: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().optional()
      ),
    }),
    handler: async (input) => {
      const result = await placeOrder({
        customerName: input.customerName,
        phone: input.phone,
        wilayaId: input.wilayaId,
        communeId: input.communeId,
        address: input.address,
        deliveryType: input.deliveryType,
        productId: input.productId,
        productName: input.productName,
        variantId: input.variantId,
        variantLabel: input.variantLabel,
        quantity: input.quantity,
        pricePerUnit: input.pricePerUnit,
        notes: input.notes,
        offerId: input.offerId,
        variantSelections: input.variantSelections,
        fbc: input.fbc,
        fbp: input.fbp,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  }),
};

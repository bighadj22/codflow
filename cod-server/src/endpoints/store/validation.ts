import { z } from "zod";

export const variantSelectionSchema = z.object({
  variantId: z.string().min(1),
  variantLabel: z.string().optional(),
});

export const storeOrderSchema = z.object({
  customerName: z.string().min(2).max(100),
  phone: z.string().min(9).max(20),
  wilayaId: z.number().int().min(1).max(58),
  communeId: z.string().min(1),
  address: z.string().max(300).optional(),
  deliveryType: z.enum(["home", "stop_desk"]).default("home"),
  productId: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  variantId: z.string().min(1).optional(),
  variantLabel: z.string().max(100).optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  pricePerUnit: z.number().positive(),
  notes: z.string().max(500).optional(),
  // Explicit offer selection from client — server applies this exact offer rather than auto-detecting
  offerId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().optional()
  ),
  // Meta Pixel tracking cookies captured by the storefront at placement time.
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  // WhatsApp OTP verification proof (HMAC token from /store/otp/verify, or a
  // bypass token when dzverify could not serve the send). Required only when
  // the store's OTP verification is enabled.
  otpToken: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(10).max(1024).optional()
  ),
  // Per-unit variant selections (JSON string parsed from hidden form input).
  // When present, overrides variantId/variantLabel for multi-unit orders.
  // Shape after parse: [{variantId, variantLabel?}] — one entry per ordered unit.
  variantSelections: z.preprocess(
    (v) => {
      if (!v) return undefined;
      // Already a parsed array (JSON API path — Astro action sends array via JSON.stringify)
      if (Array.isArray(v)) return v.length === 0 ? undefined : v;
      // String form-submission path (direct HTML form POST)
      if (typeof v !== "string" || v === "[]") return undefined;
      try { return JSON.parse(v); } catch { return undefined; }
    },
    z.array(variantSelectionSchema).optional()
  ),
});

export type StoreOrderInput = z.infer<typeof storeOrderSchema>;

/**
 * Storefront review submission.
 *
 * `orderNumber` is the customer-visible identifier (ORD-YYYYMMDD-NNNN),
 * NOT the internal orders.id UUID. The storefront only ever shows the
 * order number to customers on the thank-you page, so that is the ONLY
 * identifier they can type back into the review form.
 *
 * The handler resolves orderNumber → orders.id internally before writing
 * the review FK. Keeping the wire field named `orderNumber` prevents the
 * "form says Order Number but server expects UUID" confusion we had in
 * v1.0.54 and earlier.
 */
export const storeReviewSchema = z.object({
  orderNumber: z
    .string()
    .regex(/^ORD-\d{8}-\d+$/i, "Invalid order number format (expected ORD-YYYYMMDD-NNNN)"),
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(150).optional(),
  body: z.string().min(10).max(2000),
});

export type StoreReviewInput = z.infer<typeof storeReviewSchema>;

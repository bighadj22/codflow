import { z } from "zod";
import { toLocalAlgerianMobile } from "@/endpoints/store-otp/phone";

export const variantSelectionSchema = z.object({
  variantId: z.string().min(1),
  variantLabel: z.string().optional(),
});

/**
 * One line of a cart request.
 *
 * `pricePerUnit` is accepted for storefront UI continuity and is display-only:
 * the server resolves every price from the catalog row. Bounds here mirror
 * MAX_LINE_QUANTITY in cod-shared/queries/cart.ts, which re-checks them after
 * duplicate lines are merged — two lines of 60 for one variant are 120 units.
 */
export const cartItemSchema = z.object({
  productId: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  variantId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).max(200).optional(),
  ),
  variantLabel: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(100).optional(),
  ),
  quantity: z.number().int().min(1).max(100),
  pricePerUnit: z.number().nonnegative().optional(),
  offerId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().optional(),
  ),
});

export const storeOrderSchema = z.object({
  customerName: z.string().min(2).max(100),
  // Algerian mobile only, normalized to the canonical local form "05XXXXXXXX".
  // Accepts 05…, +2135…, 2135…, 002135… with separators; rejects landlines,
  // foreign numbers, and short/long garbage. Canonical form keeps customer
  // deduplication stable regardless of how the shopper typed the number.
  phone: z.preprocess(
    (v) => (typeof v === "string" ? toLocalAlgerianMobile(v) ?? v : v),
    z.string().regex(
      /^0[567]\d{8}$/,
      "رقم الهاتف غير صحيح — أدخل رقماً جزائرياً يبدأ بـ 05 أو 06 أو 07"
    )
  ),
  wilayaId: z.number().int().min(1).max(58),
  communeId: z.string().min(1),
  address: z.string().max(300).optional(),
  deliveryType: z.enum(["home", "stop_desk"]).default("home"),
  // These three describe the ONE product a direct order form was rendered for.
  // A basket has no single representative product, and normalizeOrderLines
  // ignores them entirely once `items[]` is present, so they are optional here
  // and required by the refinement below whenever there is no basket.
  productId: z.string().min(1).max(200).optional(),
  productName: z.string().min(1).max(200).optional(),
  variantId: z.string().min(1).optional(),
  variantLabel: z.string().max(100).optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  // Display-only: accepted for storefront UI continuity but NEVER trusted for
  // pricing — the server resolves the unit price from the catalog row.
  pricePerUnit: z.number().positive().optional(),
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
  // Cloudflare Turnstile widget proof. Required only when the store has
  // Turnstile enabled; verified server-side against the siteverify API
  // (tokens are single-use, max 2048 chars, expire after 300 seconds).
  turnstileToken: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).max(2048).optional()
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
  // Cart request. When present it supersedes the flat product fields above,
  // which stay required so every existing storefront keeps working unchanged.
  // The 20-line cap bounds the commit batch and the carrier payload; it is
  // re-checked after duplicate lines are merged (cod-shared/queries/cart.ts).
  items: z.preprocess(
    (v) => {
      if (!v) return undefined;
      if (Array.isArray(v)) return v.length === 0 ? undefined : v;
      // Form submissions send it as a JSON string, like variantSelections.
      if (typeof v !== "string" || v === "[]") return undefined;
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
      } catch {
        return undefined;
      }
    },
    z.array(cartItemSchema).min(1).max(20).optional(),
  ),
  // Landing page attribution — best-effort. An unknown/draft/archived slug
  // leaves the order unattributed and the order still succeeds (revenue
  // first, attribution second).
  landingPageSlug: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).max(60).optional()
  ),
})
  /**
   * An order is either a basket or a single product — never neither.
   *
   * Without `items[]` the flat product fields are the only thing describing
   * what was ordered, so all three are required and the request is rejected at
   * the seam rather than reaching an engine that would throw EMPTY_CART.
   */
  .superRefine((data, ctx) => {
    if (data.items && data.items.length > 0) return;
    for (const field of ["productId", "productName", "pricePerUnit"] as const) {
      if (data[field] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is required when the request carries no items[]`,
        });
      }
    }
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

/**
 * Cart validation request.
 *
 * Deliberately narrow: this endpoint prices and checks a basket, so it needs
 * the basket and nothing else. No customer details, no address, nothing the
 * shopper has not typed yet.
 */
export const validateCartSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(20),
});

export type ValidateCartInput = z.infer<typeof validateCartSchema>;

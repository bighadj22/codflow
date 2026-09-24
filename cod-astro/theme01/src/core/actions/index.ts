// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CORE ENGINE — DO NOT MODIFY                                         ║
// ║  Defines the placeOrder action: input validation + API call.         ║
// ║  UI customisation belongs in components, not here.                   ║
// ╚══════════════════════════════════════════════════════════════════════╝
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { placeOrder } from "@/core/api/client";

export const server = {
  placeOrder: defineAction({
    accept: "form",
    input: z.object({
      // Optional because a basket order has no single representative product;
      // the handler below requires them whenever `items` is absent. They stay
      // on a plain z.object rather than a .superRefine() because `accept:
      // "form"` needs an object schema to parse FormData with.
      productId: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().min(1).optional()
      ),
      productName: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().min(1).optional()
      ),
      // Forms always submit all hidden inputs — empty string must become undefined
      variantId: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().min(1).optional()
      ),
      variantLabel: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().optional()
      ),
      pricePerUnit: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.coerce.number().positive().optional()
      ),
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
      // WhatsApp OTP verification proof — set after the OTP step verifies.
      // Absent when the store has verification disabled (schema stays additive).
      otpToken: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().min(10).max(1024).optional()
      ),
      // Cloudflare Turnstile proof — auto-injected by the widget's hidden input
      // when the store enables bot protection. Absent when disabled (additive).
      // Tokens are single-use, max 2048 chars, and expire after 300 seconds.
      turnstileToken: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().min(1).max(2048).optional()
      ),
      // Cart basket. Present only when checkout started from the drawer; an
      // empty or malformed value falls through to the flat single-product
      // fields above, so the direct order form is untouched by this.
      items: z.preprocess(
        (v) => {
          if (!v || typeof v !== "string" || v === "[]") return undefined;
          try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
          } catch { return undefined; }
        },
        z.array(z.object({
          productId: z.string().min(1),
          productName: z.string().min(1),
          variantId: z.string().min(1).optional(),
          variantLabel: z.string().optional(),
          quantity: z.coerce.number().int().min(1).max(100),
          pricePerUnit: z.coerce.number().nonnegative().optional(),
        })).optional()
      ),
      // Landing page attribution — best-effort: unknown/draft slug leaves
      // the order unattributed, never blocked (platform extension, LP feature).
      landingPageSlug: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().min(1).max(60).optional()
      ),
    }),
    handler: async (input, context) => {
      // An order is either a basket or a single product, never neither. The
      // schema above cannot express that (form parsing needs a plain object),
      // and cod-server refuses the shape anyway — failing here turns a bare
      // 400 into a field error the form can actually render.
      if (!input.items?.length && (!input.productId || !input.productName || !input.pricePerUnit)) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "An order needs either a basket or a product.",
        });
      }

      // Forward the shopper's attribution headers so cod-server records the
      // visitor, not this worker — same mechanism as core/endpoints/abandoned.ts.
      const forwardedHeaders: Record<string, string> = {};
      const userAgent = context.request.headers.get("User-Agent");
      if (userAgent) forwardedHeaders["User-Agent"] = userAgent;
      const clientIp =
        context.request.headers.get("CF-Connecting-IP") ??
        context.request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
      if (clientIp) forwardedHeaders["X-Forwarded-For"] = clientIp;
      const referer = context.request.headers.get("Referer");
      if (referer) forwardedHeaders["Referer"] = referer;

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
        items: input.items,
        fbc: input.fbc,
        fbp: input.fbp,
        otpToken: input.otpToken,
        turnstileToken: input.turnstileToken,
        landingPageSlug: input.landingPageSlug,
      }, forwardedHeaders);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  }),
};

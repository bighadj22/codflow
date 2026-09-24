/**
 * Abandoned Orders — Store Endpoints
 * Public routes authenticated via X-Store-API-Key (storeAuthMiddleware is
 * applied to /store/* in src/index.ts before this router mounts).
 *
 * POST  /store/abandoned               → upsert (create or update) an abandoned record
 * PATCH /store/abandoned/:sessionId/convert → mark as converted after successful order
 *
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { getDb } from "@/db";
import {
  upsertAbandonedOrder,
  markAbandonedOrderConverted,
} from "../../../../cod-shared/queries/abandoned-orders";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "../../../../cod-shared/queries/cart";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── Request schemas ──────────────────────────────────────────────────────────

/**
 * One line of an abandoned basket.
 *
 * Bounded exactly like an order's cart line: this is the same untrusted
 * browser input, and it must not be able to write a bigger row here than it
 * could order. Prices are display-only — nothing is charged from this table.
 */
const abandonedItemSchema = z.object({
  productId: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  variantId: z.string().max(200).nullish(),
  variantLabel: z.string().max(200).nullish(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  unitPrice: z.number().nonnegative(),
});

const upsertSchema = z.object({
  sessionId: z.string().uuid(),
  customerName: z.string().min(2).max(100),
  phone: z
    .string()
    .min(9)
    .max(20)
    .regex(/^[0-9+\s-]+$/),
  wilayaId: z.number().int().min(1).max(58).optional(),
  communeId: z.string().optional(),
  wilayaName: z.string().max(100).optional(),
  communeName: z.string().max(100).optional(),
  productId: z.string().max(200).optional(),
  productName: z.string().max(200).optional(),
  variantId: z.string().max(200).optional(),
  variantLabel: z.string().max(200).optional(),
  price: z.number().positive().optional(),
  /**
   * The whole basket, when the shopper walked away from a cart checkout.
   * Absent for a single-product checkout, which keeps using the flat fields
   * above and is stored exactly as it was before carts existed.
   */
  items: z.array(abandonedItemSchema).min(1).max(MAX_CART_LINES).optional(),
  deliveryType: z.enum(["home", "stop_desk"]).optional(),
  fbc: z.string().max(500).optional(),
  fbp: z.string().max(500).optional(),
});

const convertSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
});

const sessionIdParams = z.object({
  sessionId: z.string().openapi({ description: "Storefront session ID from the upsert call" }),
});

// ─── Inline handlers ──────────────────────────────────────────────────────────

async function upsertHandler(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = (c.req as any).valid("json");

  // X-Forwarded-For first: the storefront worker forwards the shopper's IP
  // there — CF-Connecting-IP on this hop is the worker itself.
  const ipAddress =
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    c.req.header("CF-Connecting-IP") ??
    undefined;
  const userAgent = c.req.header("User-Agent") ?? undefined;

  const id = await upsertAbandonedOrder(db, {
    ...data,
    ipAddress,
    userAgent,
  });

  return c.json({ success: true, id }, 200);
}

async function convertHandler(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const sessionId = c.req.param("sessionId")!;
  const { orderId, orderNumber } = (c.req as any).valid("json");

  // Intentionally returns 200 even if session not found — convert is fire-and-forget
  await markAbandonedOrderConverted(db, sessionId, orderId, orderNumber).catch(
    () => {}
  );

  return c.json({ success: true }, 200);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const upsertAbandonedRoute = defineRoute({
  method: "post",
  path: "/abandoned",
  auth: "store",
  tags: ["Storefront"],
  summary: "Track an abandoned checkout",
  description:
    "Called silently by the storefront as the customer types contact details. Upserts the abandoned-checkout record keyed by sessionId and captures Meta attribution (_fbc/_fbp) plus client IP/User-Agent for CAPI recovery events.",
  operationId: "upsertAbandonedOrder",
  body: upsertSchema,
  responses: {
    200: {
      description: "Record stored (new or updated)",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          id: z.string().openapi({ description: "Abandoned order record ID" }),
        })
      ),
    },
  },
  handler: upsertHandler,
});

const convertAbandonedRoute = defineRoute({
  method: "patch",
  path: "/abandoned/{sessionId}/convert",
  auth: "store",
  tags: ["Storefront"],
  summary: "Mark abandoned checkout as converted",
  description:
    "Links a completed order back to the original abandoned session (recovery attribution). Intentionally returns 200 even if the session is unknown — conversion tracking is fire-and-forget and must never break checkout.",
  operationId: "markAbandonedOrderConverted",
  params: sessionIdParams,
  body: convertSchema,
  responses: {
    200: {
      description: "Conversion recorded (fire-and-forget)",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: convertHandler,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(upsertAbandonedRoute.route, upsertAbandonedRoute.handler);
router.openapi(convertAbandonedRoute.route, convertAbandonedRoute.handler);

export default router;

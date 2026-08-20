/**
 * Abandoned Orders — Store Endpoints
 * Public routes authenticated via X-Store-API-Key.
 *
 * POST  /store/abandoned               → upsert (create or update) an abandoned record
 * PATCH /store/abandoned/:sessionId/convert → mark as converted after successful order
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import {
  upsertAbandonedOrder,
  markAbandonedOrderConverted,
} from "../../../../cod-shared/queries/abandoned-orders";

const router = new Hono<AppContext>();

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
  deliveryType: z.enum(["home", "stop_desk"]).optional(),
  fbc: z.string().max(500).optional(),
  fbp: z.string().max(500).optional(),
});

const convertSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
});

router.post("/abandoned", zValidator("json", upsertSchema), async (c) => {
  const db = getDb(c.env.DB);
  const data = c.req.valid("json");

  const ipAddress =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For") ??
    undefined;
  const userAgent = c.req.header("User-Agent") ?? undefined;

  const id = await upsertAbandonedOrder(db, {
    ...data,
    ipAddress,
    userAgent,
  });

  return c.json({ success: true, id });
});

router.patch(
  "/abandoned/:sessionId/convert",
  zValidator("json", convertSchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const sessionId = c.req.param("sessionId");
    const { orderId, orderNumber } = c.req.valid("json");

    // Intentionally returns 200 even if session not found — convert is fire-and-forget
    await markAbandonedOrderConverted(db, sessionId, orderId, orderNumber).catch(
      () => {}
    );

    return c.json({ success: true });
  }
);

export default router;

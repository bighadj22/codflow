/**
 * Abandoned Orders — Store Endpoints
 * Public routes authenticated via X-Store-API-Key (storeAuthMiddleware is
 * applied to /store/* in src/index.ts before this router mounts).
 *
 * POST  /store/abandoned               → upsert (create or update) an abandoned record
 * PATCH /store/abandoned/:sessionId/convert → mark as converted after successful order
 *
 * Migrated to @hono/zod-openapi: route definitions are the single source of
 * truth for validation and the OpenAPI spec. These endpoints were previously
 * undocumented entirely.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import {
  upsertAbandonedOrder,
  markAbandonedOrderConverted,
} from "../../../../cod-shared/queries/abandoned-orders";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
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
  deliveryType: z.enum(["home", "stop_desk"]).optional(),
  fbc: z.string().max(500).optional(),
  fbp: z.string().max(500).optional(),
});

const convertSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
});

const upsertAbandonedRoute = createRoute({
  method: "post",
  path: "/abandoned",
  tags: ["Storefront"],
  summary: "Track an abandoned checkout",
  description:
    "Called silently by the storefront as the customer types contact details. Upserts the abandoned-checkout record keyed by sessionId and captures Meta attribution (_fbc/_fbp) plus client IP/User-Agent for CAPI recovery events.",
  operationId: "upsertAbandonedOrder",
  request: {
    body: {
      required: true,
      content: jsonContent(upsertSchema),
    },
  },
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
  security: [{ StoreAuth: [] }],
});

const convertAbandonedRoute = createRoute({
  method: "patch",
  path: "/abandoned/{sessionId}/convert",
  tags: ["Storefront"],
  summary: "Mark abandoned checkout as converted",
  description:
    "Links a completed order back to the original abandoned session (recovery attribution). Intentionally returns 200 even if the session is unknown — conversion tracking is fire-and-forget and must never break checkout.",
  operationId: "markAbandonedOrderConverted",
  request: {
    params: z.object({
      sessionId: z.string().openapi({ description: "Storefront session ID from the upsert call" }),
    }),
    body: {
      required: true,
      content: jsonContent(convertSchema),
    },
  },
  responses: {
    200: {
      description: "Conversion recorded (fire-and-forget)",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  security: [{ StoreAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(upsertAbandonedRoute, async (c) => {
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

  return c.json({ success: true, id }, 200);
});

router.openapi(convertAbandonedRoute, async (c) => {
  const db = getDb(c.env.DB);
  const sessionId = c.req.param("sessionId");
  const { orderId, orderNumber } = c.req.valid("json");

  // Intentionally returns 200 even if session not found — convert is fire-and-forget
  await markAbandonedOrderConverted(db, sessionId, orderId, orderNumber).catch(
    () => {}
  );

  return c.json({ success: true }, 200);
});

export default router;

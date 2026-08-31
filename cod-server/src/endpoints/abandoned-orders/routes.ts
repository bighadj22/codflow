/**
 * Abandoned Orders — Dashboard API Endpoints
 * Protected routes requiring authentication + RBAC scope.
 *
 * GET    /api/abandoned-orders          → list with pagination + status filter
 * GET    /api/abandoned-orders/stats    → summary cards
 * PATCH  /api/abandoned-orders/:id/status → update status
 * DELETE /api/abandoned-orders/:id      → delete record
 *
 * Built with defineRoute() — the standard route-builder pattern.
 * Handlers are inline (thin query wrappers).
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { getDb } from "@/db";
import {
  listAbandonedOrders,
  getAbandonedOrderStats,
  updateAbandonedOrderStatus,
  deleteAbandonedOrder,
} from "../../../../cod-shared/queries/abandoned-orders";
import {
  AbandonedOrderSchema,
  AbandonedOrderStatsSchema,
  AbandonedOrderStatusEnum,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── Request schemas ──────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: AbandonedOrderStatusEnum.optional().openapi({
    description: "Filter by recovery status",
  }),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParams = z.object({ id: z.string().openapi({ description: "Abandoned order ID" }) });

const updateStatusBodySchema = z.object({
  status: AbandonedOrderStatusEnum,
});

// ─── Inline handlers (thin query wrappers) ────────────────────────────────────

async function listHandler(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { status, search, limit, offset } = (c.req as any).valid("query");

  const { rows, total } = await listAbandonedOrders(db, {
    status,
    search,
    limit,
    offset,
  });

  return c.json({ success: true, data: rows, total, limit, offset }, 200);
}

async function statsHandler(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const stats = await getAbandonedOrderStats(db);
  return c.json({ success: true, data: stats }, 200);
}

async function updateStatusHandler(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const { status } = (c.req as any).valid("json");

  await updateAbandonedOrderStatus(db, id, status);
  return c.json({ success: true }, 200);
}

async function deleteHandler(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  await deleteAbandonedOrder(db, id);
  return c.json({ success: true }, 200);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const listRoute = defineRoute({
  method: "get",
  path: "/",
  auth: { scope: SCOPES.ABANDONED_ORDERS_READ },
  tags: ["Abandoned Orders"],
  summary: "List abandoned orders",
  description:
    "Paginated list of abandoned checkouts, newest first. Filter by recovery status or search by customer name / phone / session.",
  operationId: "listAbandonedOrders",
  query: listQuerySchema,
  responses: {
    200: {
      description: "Paginated abandoned orders",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(AbandonedOrderSchema),
          total: z.number().int().openapi({
            description: "Total matching records (for pagination)",
            example: 42,
          }),
          limit: z.number().int().openapi({ example: 50 }),
          offset: z.number().int().openapi({ example: 0 }),
        })
      ),
    },
  },
  handler: listHandler,
});

const statsRoute = defineRoute({
  method: "get",
  path: "/stats",
  auth: { scope: SCOPES.ABANDONED_ORDERS_READ },
  tags: ["Abandoned Orders"],
  summary: "Abandoned order statistics",
  description:
    "Summary metrics for the recovery workflow: counts of abandoned vs converted checkouts, the recovered percentage, and estimated lost revenue still on the table.",
  operationId: "getAbandonedOrderStats",
  responses: {
    200: {
      description: "Recovery statistics",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: AbandonedOrderStatsSchema,
        })
      ),
    },
  },
  handler: statsHandler,
});

const updateStatusRoute = defineRoute({
  method: "patch",
  path: "/{id}/status",
  auth: { scope: SCOPES.ABANDONED_ORDERS_MANAGE },
  tags: ["Abandoned Orders"],
  summary: "Update abandoned order status",
  description:
    "Advances the recovery status of an abandoned checkout (pending → contacted → converted, or mark as abandoned).",
  operationId: "updateAbandonedOrderStatus",
  params: idParams,
  body: updateStatusBodySchema,
  responses: {
    200: {
      description: "Status updated",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: updateStatusHandler,
});

const deleteRoute = defineRoute({
  method: "delete",
  path: "/{id}",
  auth: { scope: SCOPES.ABANDONED_ORDERS_MANAGE },
  tags: ["Abandoned Orders"],
  summary: "Delete abandoned order",
  description: "Permanently removes an abandoned checkout record.",
  operationId: "deleteAbandonedOrder",
  params: idParams,
  responses: {
    200: {
      description: "Record deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
  },
  handler: deleteHandler,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(listRoute.route, listRoute.handler);
router.openapi(statsRoute.route, statsRoute.handler);
router.openapi(updateStatusRoute.route, updateStatusRoute.handler);
router.openapi(deleteRoute.route, deleteRoute.handler);

export default router;

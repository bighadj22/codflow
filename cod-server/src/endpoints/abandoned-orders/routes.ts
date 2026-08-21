/**
 * Abandoned Orders — Dashboard API Endpoints
 * Protected routes requiring authentication + RBAC scope.
 *
 * GET    /api/abandoned-orders          → list with pagination + status filter
 * GET    /api/abandoned-orders/stats    → summary cards
 * PATCH  /api/abandoned-orders/:id/status → update status
 * DELETE /api/abandoned-orders/:id      → delete record
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are inline
 * (thin query wrappers) and unchanged apart from the validated-data
 * fallback pattern.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireScope } from "@/rbac/middleware";
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
  ErrorResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireScope(SCOPES.ABANDONED_ORDERS_READ)],
  tags: ["Abandoned Orders"],
  summary: "List abandoned orders",
  description:
    "Paginated list of abandoned checkouts, newest first. Filter by recovery status or search by customer name / phone / session.",
  operationId: "listAbandonedOrders",
  request: {
    query: z.object({
      status: AbandonedOrderStatusEnum.optional().openapi({
        description: "Filter by recovery status",
      }),
      search: z.string().optional(),
      limit: z.coerce.number().int().positive().max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
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
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing abandoned_orders:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const statsRoute = createRoute({
  method: "get",
  path: "/stats",
  middleware: [requireScope(SCOPES.ABANDONED_ORDERS_READ)],
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
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing abandoned_orders:read scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  middleware: [requireScope(SCOPES.ABANDONED_ORDERS_MANAGE)],
  tags: ["Abandoned Orders"],
  summary: "Update abandoned order status",
  description:
    "Advances the recovery status of an abandoned checkout (pending → contacted → converted, or mark as abandoned).",
  operationId: "updateAbandonedOrderStatus",
  request: {
    params: z.object({ id: z.string().openapi({ description: "Abandoned order ID" }) }),
    body: {
      required: true,
      content: jsonContent(
        z.object({
          status: AbandonedOrderStatusEnum,
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Status updated",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    400: errorResponse("Invalid status value"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing abandoned_orders:manage scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  middleware: [requireScope(SCOPES.ABANDONED_ORDERS_MANAGE)],
  tags: ["Abandoned Orders"],
  summary: "Delete abandoned order",
  description: "Permanently removes an abandoned checkout record.",
  operationId: "deleteAbandonedOrder",
  request: {
    params: z.object({ id: z.string().openapi({ description: "Abandoned order ID" }) }),
  },
  responses: {
    200: {
      description: "Record deleted",
      content: jsonContent(z.object({ success: z.boolean().openapi({ example: true }) })),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Missing abandoned_orders:manage scope"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listRoute, async (c) => {
  const db = getDb(c.env.DB);
  const { status, search, limit, offset } = c.req.valid("query");

  const { rows, total } = await listAbandonedOrders(db, {
    status,
    search,
    limit,
    offset,
  });

  return c.json({ success: true, data: rows, total, limit, offset }, 200);
});

router.openapi(statsRoute, async (c) => {
  const db = getDb(c.env.DB);
  const stats = await getAbandonedOrderStats(db);
  return c.json({ success: true, data: stats }, 200);
});

router.openapi(updateStatusRoute, async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param("id");
  const { status } = c.req.valid("json");

  await updateAbandonedOrderStatus(db, id, status);
  return c.json({ success: true }, 200);
});

router.openapi(deleteRoute, async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param("id");
  await deleteAbandonedOrder(db, id);
  return c.json({ success: true }, 200);
});

export default router;

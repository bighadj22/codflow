/**
 * Abandoned Orders — Dashboard API Endpoints
 * Protected routes requiring authentication + RBAC scope.
 *
 * GET    /api/abandoned-orders          → list with pagination + status filter
 * GET    /api/abandoned-orders/stats    → summary cards
 * PATCH  /api/abandoned-orders/:id/status → update status
 * DELETE /api/abandoned-orders/:id      → delete record
 */

import { Hono } from "hono";
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
import { NotFoundError } from "@/lib/errors/classes";

const router = new Hono<AppContext>();

router.get("/", requireScope(SCOPES.ABANDONED_ORDERS_READ), async (c) => {
  const db = getDb(c.env.DB);
  const status = c.req.query("status") ?? undefined;
  const search = c.req.query("search") ?? undefined;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 200);
  const offset = Math.max(parseInt(c.req.query("offset") ?? "0"), 0);

  const { rows, total } = await listAbandonedOrders(db, {
    status,
    search,
    limit,
    offset,
  });

  return c.json({ success: true, data: rows, total, limit, offset });
});

router.get("/stats", requireScope(SCOPES.ABANDONED_ORDERS_READ), async (c) => {
  const db = getDb(c.env.DB);
  const stats = await getAbandonedOrderStats(db);
  return c.json({ success: true, data: stats });
});

router.patch(
  "/:id/status",
  requireScope(SCOPES.ABANDONED_ORDERS_MANAGE),
  async (c) => {
    const db = getDb(c.env.DB);
    const id = c.req.param("id");
    const body = await c.req.json<{ status: string }>();

    const allowed = ["pending", "abandoned", "contacted", "converted"];
    if (!allowed.includes(body.status)) {
      return c.json({ success: false, error: "Invalid status" }, 400);
    }

    await updateAbandonedOrderStatus(db, id, body.status);
    return c.json({ success: true });
  }
);

router.delete(
  "/:id",
  requireScope(SCOPES.ABANDONED_ORDERS_MANAGE),
  async (c) => {
    const db = getDb(c.env.DB);
    const id = c.req.param("id");
    await deleteAbandonedOrder(db, id);
    return c.json({ success: true });
  }
);

export default router;

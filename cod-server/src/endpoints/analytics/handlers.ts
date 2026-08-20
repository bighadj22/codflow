/**
 * Analytics Handlers
 *
 * HTTP handlers for the /api/analytics/* routes.
 */

import type { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { getOrderStatusStats } from "../../../../cod-shared/queries/analytics";

/**
 * GET /api/analytics/dashboard-stats
 * Returns order counts grouped by status in a single optimized query.
 */
export async function getDashboardStats(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await getOrderStatusStats(db);
  return c.json({ success: true, data });
}

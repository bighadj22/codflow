/**
 * Activity Logs Handlers
 *
 * Admin-only endpoints for querying the audit trail.
 * 
 * Note: These handlers receive pre-validated data from OpenAPIHono routes.
 * When called from routes.ts, query/param validation is already complete.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import {
  listActivityLogs as queryActivityLogs,
  getUserActivityLogs as queryUserActivityLogs,
} from "../../../../cod-shared/queries/activity-logs";

/**
 * GET /api/activity-logs
 * Returns paginated activity log, optionally filtered by actorId or entityType.
 */
export async function listActivityLogs(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  
  // When called via OpenAPIHono, c.req.valid() provides validated data
  const query: any = (c.req as any).valid?.("query");
  const actorId = query?.actorId;
  const entityType = query?.entityType;
  const limit = query?.limit ?? 50;
  const offset = query?.offset ?? 0;

  const rows = await queryActivityLogs(db, { actorId, entityType, limit, offset });

  return c.json({ success: true, data: rows, count: rows.length }, 200);
}

/**
 * GET /api/activity-logs/users/:userId
 * Returns paginated activity log for a specific user.
 * Used by the team member profile sheet.
 */
export async function getUserActivityLogs(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  
  // When called via OpenAPIHono, c.req.valid() provides validated data
  const params: any = (c.req as any).valid?.("param");
  const query: any = (c.req as any).valid?.("query");
  const userId = params?.userId ?? c.req.param("userId")!;
  const limit = query?.limit ?? 30;
  const offset = query?.offset ?? 0;

  const rows = await queryUserActivityLogs(db, userId, { limit, offset });

  return c.json({ success: true, data: rows, count: rows.length }, 200);
}

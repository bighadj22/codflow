/**
 * Activity Logs Handlers
 *
 * Admin-only endpoints for querying the audit trail.
 */

import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { ValidationError } from "@/lib/errors/classes";
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

  const actorId = c.req.query("actorId");
  const entityType = c.req.query("entityType");
  const limitParam = c.req.query("limit") ?? "50";
  const offsetParam = c.req.query("offset") ?? "0";

  const limitNum = parseInt(limitParam);
  if (isNaN(limitNum) || limitNum < 1) {
    throw new ValidationError(
      "Invalid limit parameter",
      "VALIDATION_FAILED" as any,
      { field: "limit", value: limitParam, message: "Limit must be a positive integer" },
    );
  }
  const limit = Math.min(limitNum, 100);

  const offsetNum = parseInt(offsetParam);
  if (isNaN(offsetNum) || offsetNum < 0) {
    throw new ValidationError(
      "Invalid offset parameter",
      "VALIDATION_FAILED" as any,
      { field: "offset", value: offsetParam, message: "Offset must be a non-negative integer" },
    );
  }
  const offset = offsetNum;

  const rows = await queryActivityLogs(db, { actorId, entityType, limit, offset });

  return c.json({ success: true, data: rows, count: rows.length });
}

/**
 * GET /api/activity-logs/users/:userId
 * Returns paginated activity log for a specific user.
 * Used by the team member profile sheet.
 */
export async function getUserActivityLogs(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const userId = c.req.param("userId")!;

  const limitParam = c.req.query("limit") ?? "30";
  const offsetParam = c.req.query("offset") ?? "0";

  const limitNum = parseInt(limitParam);
  if (isNaN(limitNum) || limitNum < 1) {
    throw new ValidationError(
      "Invalid limit parameter",
      "VALIDATION_FAILED" as any,
      { field: "limit", value: limitParam, message: "Limit must be a positive integer" },
    );
  }
  const limit = Math.min(limitNum, 100);

  const offsetNum = parseInt(offsetParam);
  if (isNaN(offsetNum) || offsetNum < 0) {
    throw new ValidationError(
      "Invalid offset parameter",
      "VALIDATION_FAILED" as any,
      { field: "offset", value: offsetParam, message: "Offset must be a non-negative integer" },
    );
  }
  const offset = offsetNum;

  const rows = await queryUserActivityLogs(db, userId, { limit, offset });

  return c.json({ success: true, data: rows, count: rows.length });
}

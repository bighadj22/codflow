"use server";

/**
 * Server Actions for Activity Logs
 *
 * Admin-only actions for reading the audit trail.
 * Non-admin callers receive a ForbiddenError.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { getUserRole, ForbiddenError } from "@/lib/auth";
import {
  listActivityLogs,
  getUserActivityLogs as getUserActivityLogsQuery,
} from "@/../cod-shared/queries/activity-logs";

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: "admin" | "staff";
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  metadata: string | null; // JSON string
  createdAt: string;
}

interface ActivityLogsParams {
  actorId?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

async function requireAdmin() {
  const role = await getUserRole();
  if (role !== "admin") throw new ForbiddenError("Admin access required");
}

/**
 * Get paginated activity logs with optional filters.
 * Admin only.
 */
export async function getActivityLogs(
  params?: ActivityLogsParams,
): Promise<ActivityLog[]> {
  await requireAdmin();
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const limitNum = params?.limit ?? 50;
  const limit = Math.min(Math.max(limitNum, 1), 100);
  const offset = Math.max(params?.offset ?? 0, 0);
  const rows = await listActivityLogs(db, {
    actorId: params?.actorId,
    entityType: params?.entityType,
    limit,
    offset,
  });
  return rows as unknown as ActivityLog[];
}

/**
 * Get activity logs for a specific team member.
 * Used by the team member profile sheet.
 * Admin only.
 */
export async function getUserActivityLogs(
  userId: string,
  params?: { limit?: number; offset?: number },
): Promise<ActivityLog[]> {
  await requireAdmin();
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const limitNum = params?.limit ?? 30;
  const limit = Math.min(Math.max(limitNum, 1), 100);
  const offset = Math.max(params?.offset ?? 0, 0);
  const rows = await getUserActivityLogsQuery(db, userId, { limit, offset });
  return rows as unknown as ActivityLog[];
}

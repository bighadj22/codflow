"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getOrderStatusStats,
  type OrderStatusStat,
} from "@/../cod-shared/queries/analytics";

export async function getDashboardStats(): Promise<OrderStatusStat[]> {
  await requirePermission(SCOPES.DASHBOARD_VIEW);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getOrderStatusStats(db);
}

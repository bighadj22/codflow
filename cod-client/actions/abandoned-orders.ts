"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  listAbandonedOrders,
  getAbandonedOrderStats,
  updateAbandonedOrderStatus,
  deleteAbandonedOrder,
  type AbandonedOrderFilters,
} from "@/../cod-shared/queries/abandoned-orders";
import { revalidatePath } from "next/cache";

export async function getAbandonedOrders(filters: AbandonedOrderFilters = {}) {
  await requirePermission(SCOPES.ABANDONED_ORDERS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return listAbandonedOrders(db, filters);
}

export async function getAbandonedOrderStatsAction() {
  await requirePermission(SCOPES.ABANDONED_ORDERS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getAbandonedOrderStats(db);
}

export async function markAbandonedOrderContactedAction(id: string) {
  await requirePermission(SCOPES.ABANDONED_ORDERS_MANAGE);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  await updateAbandonedOrderStatus(db, id, "contacted");
  revalidatePath("/orders/abandoned");
}

export async function deleteAbandonedOrderAction(id: string) {
  await requirePermission(SCOPES.ABANDONED_ORDERS_MANAGE);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  await deleteAbandonedOrder(db, id);
  revalidatePath("/orders/abandoned");
}

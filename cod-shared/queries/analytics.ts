/**
 * Analytics Queries
 *
 * Optimized read-only queries for dashboard and reporting endpoints.
 * Each function performs a single efficient DB round-trip — no client-side
 * aggregation. Add new analytics queries here as the system grows.
 */

import type { AppDb } from "../db/client";
import { orders, type OrderStatus } from "../db/schema";
import { sql } from "drizzle-orm";

export interface OrderStatusStat {
  status: OrderStatus;
  count: number;
}

/**
 * Returns the count of orders grouped by status in a single query.
 * Only statuses that have at least one order are returned.
 * The caller is responsible for filling in zeros for absent statuses.
 */
export async function getOrderStatusStats(db: AppDb): Promise<OrderStatusStat[]> {
  const rows = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)`,
    })
    .from(orders)
    .groupBy(orders.status)
    .all();

  return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

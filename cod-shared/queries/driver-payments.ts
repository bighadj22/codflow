import { eq, and, isNull, desc } from "drizzle-orm";
import { orders, driverPayments } from "../db/schema";
import type { AppDb } from "../db/client";

/**
 * Get all payment records for a driver, most recent first.
 */
export async function getDriverPayments(db: AppDb, driverId: string) {
  return db
    .select()
    .from(driverPayments)
    .where(eq(driverPayments.driverId, driverId))
    .orderBy(desc(driverPayments.createdAt))
    .all();
}

/**
 * Get delivered, unsettled orders for a driver.
 * Returns orders where COD hasn't been settled yet.
 */
export async function getPendingSettlementOrders(db: AppDb, driverId: string) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.driverId, driverId),
        eq(orders.status, "delivered"),
        isNull(orders.codPaymentId),
      ),
    )
    .orderBy(desc(orders.updatedAt))
    .all();
}

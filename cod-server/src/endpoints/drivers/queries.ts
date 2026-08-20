/**
 * Drivers Database Queries
 *
 * Pure CRUD + compensation helpers live in cod-shared.
 * deleteDriver stays here because it raises ConflictError (server-only).
 */

import { eq, and, or, count } from "drizzle-orm";
import { drivers, orders } from "@/db/schema";
import { getDb } from "@/db";
import { ConflictError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

export {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  updateDriverStatus,
  getCompensationsForDriver,
  setCompensation,
  deleteCompensation,
} from "../../../../cod-shared/queries/drivers";

export type {
  DriverCompensationRow,
} from "../../../../cod-shared/queries/drivers";

type Database = ReturnType<typeof getDb>;

/**
 * Delete a driver.
 * Throws if the driver has active (assigned / out_for_delivery) orders.
 */
export async function deleteDriver(db: Database, driverId: string) {
  const activeOrders = await db
    .select({ count: count() })
    .from(orders)
    .where(
      and(
        eq(orders.driverId, driverId),
        or(eq(orders.status, "assigned"), eq(orders.status, "out_for_delivery")),
      ),
    )
    .get();

  if (activeOrders && activeOrders.count > 0) {
    throw new ConflictError(
      "Cannot delete driver with active orders",
      ERROR_CODES.DRIVER_HAS_ACTIVE_ORDERS,
      { driverId, activeOrderCount: activeOrders.count },
    );
  }

  await db.delete(drivers).where(eq(drivers.id, driverId));
  return { success: true };
}

import { eq, inArray, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { drivers, orders, driverPayments } from "@/db/schema";
import { getDb } from "@/db";
import type { CreatePaymentInput } from "./validation";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

// Re-export pure read queries from the shared module so cod-client can
// consume them directly from D1.
export { getDriverPayments, getPendingSettlementOrders } from "../../../../cod-shared/queries/driver-payments";

type Database = ReturnType<typeof getDb>;

/**
 * Create a driver payment record and settle the selected orders.
 *
 * - cod_remittance : links cod_payment_id on orders; decrements driver.pendingCash
 * - fee_payment    : links fee_payment_id on orders
 * - net_settlement : links both; decrements driver.pendingCash by the COD total
 */
export async function createDriverPayment(
  db: Database,
  data: CreatePaymentInput,
  createdBy: string,
  createdByName: string
) {
  const { driverId, type, orderIds, notes } = data;

  // Validate orders belong to this driver and are in delivered status
  const selectedOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.id, orderIds),
        eq(orders.driverId, driverId),
        eq(orders.status, "delivered")
      )
    )
    .all();

  if (selectedOrders.length !== orderIds.length) {
    throw new BusinessLogicError(
      "Some orders are invalid, not delivered, or do not belong to this driver",
      ERROR_CODES.ORDER_NOT_FOUND,
      { driverId, requestedCount: orderIds.length, foundCount: selectedOrders.length }
    );
  }

  // Ensure selected orders aren't already settled for the requested type
  if (type === "cod_remittance" || type === "net_settlement") {
    const alreadySettled = selectedOrders.filter((o) => o.codPaymentId !== null);
    if (alreadySettled.length > 0) {
      throw new BusinessLogicError(
        `${alreadySettled.length} order(s) already have their COD settled`,
        ERROR_CODES.PAYMENT_ALREADY_SETTLED,
        { driverId, kind: "cod", settledOrderIds: alreadySettled.map(o => o.id), settledCount: alreadySettled.length }
      );
    }
  }
  if (type === "fee_payment" || type === "net_settlement") {
    const alreadySettled = selectedOrders.filter((o) => o.feePaymentId !== null);
    if (alreadySettled.length > 0) {
      throw new BusinessLogicError(
        `${alreadySettled.length} order(s) already have their fee settled`,
        ERROR_CODES.PAYMENT_ALREADY_SETTLED,
        { driverId, kind: "fee", settledOrderIds: alreadySettled.map(o => o.id), settledCount: alreadySettled.length }
      );
    }
  }

  // Calculate amount based on payment type
  const codTotal = selectedOrders.reduce((sum, o) => sum + (o.codAmount ?? 0), 0);
  const feeTotal = selectedOrders.reduce((sum, o) => sum + (o.driverFee ?? 0), 0);

  let amount: number;
  if (type === "cod_remittance") amount = codTotal;
  else if (type === "fee_payment") amount = feeTotal;
  else amount = codTotal - feeTotal; // net_settlement

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Insert payment record
  await db.insert(driverPayments).values({
    id,
    driverId,
    type,
    amount,
    orderCount: selectedOrders.length,
    notes: notes ?? null,
    createdBy,
    createdByName,
    createdAt: now,
  });

  // Link orders to payment (COD settlement)
  if (type === "cod_remittance" || type === "net_settlement") {
    await db
      .update(orders)
      .set({ codPaymentId: id })
      .where(inArray(orders.id, orderIds));
  }

  // Link orders to payment (fee settlement)
  if (type === "fee_payment" || type === "net_settlement") {
    await db
      .update(orders)
      .set({ feePaymentId: id })
      .where(inArray(orders.id, orderIds));
  }

  // Update driver aggregate counters for COD
  if (type === "cod_remittance" || type === "net_settlement") {
    await db
      .update(drivers)
      .set({
        pendingCash: sql`${drivers.pendingCash} - ${codTotal}`,
        totalPaid: sql`${drivers.totalPaid} + ${codTotal}`,
        updatedAt: now,
      })
      .where(eq(drivers.id, driverId));
  }

  return { id, driverId, type, amount, orderCount: selectedOrders.length, notes: notes ?? null, createdBy, createdByName, createdAt: now };
}

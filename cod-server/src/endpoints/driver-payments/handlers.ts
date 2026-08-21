import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import * as validation from "./validation";
import { ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

/**
 * POST /api/driver-payments
 * Create a payment record and settle the selected orders.
 */
export async function createPayment(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const body: any = (c.req as any).valid?.("json");
  const validated = body ?? validation.createPaymentSchema.parse(await c.req.json());
  const user = c.get("user");

  const payment = await queries.createDriverPayment(db, validated, user.id, user.name ?? user.id);
  console.info(
    `[driver-payments] type=${validated.type} driver=${validated.driverId} amount=${payment.amount} orders=${payment.orderCount} by="${user.name ?? user.id}"`
  );
  return c.json({ success: true, data: payment, message: "Payment recorded successfully" }, 201);
}

/**
 * GET /api/driver-payments/{driverId}
 * List all payment records for a driver.
 */
export async function listPayments(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const driverId = c.req.param("driverId");

  if (!driverId) {
    throw new ValidationError("Driver ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING);
  }

  const data = await queries.getDriverPayments(db, driverId);
  return c.json({ success: true, data }, 200);
}

/**
 * GET /api/driver-payments/{driverId}/pending
 * List delivered, unsettled orders for a driver (for pre-settlement review).
 */
export async function listPendingOrders(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const driverId = c.req.param("driverId");

  if (!driverId) {
    throw new ValidationError("Driver ID is required", ERROR_CODES.REQUIRED_FIELD_MISSING);
  }

  const data = await queries.getPendingSettlementOrders(db, driverId);
  return c.json({ success: true, data }, 200);
}

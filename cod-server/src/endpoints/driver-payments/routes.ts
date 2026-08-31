/**
 * Driver Payments Routes
 *
 * Records payment events that settle batches of delivered orders for a
 * driver (COD remittance, fee payment, or net settlement) and exposes the
 * data needed for pre-settlement review.
 * Built with defineRoute() — the standard route-builder pattern.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as handlers from "./handlers";
import { createPaymentSchema } from "./validation";
import {
  DriverPaymentSchema,
  SuccessWithMessageSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const driverIdParams = z.object({
  driverId: z.string().openapi({ description: "UUID of the driver" }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const createPaymentRoute = defineRoute({
  method: "post",
  path: "/",
  auth: { scope: SCOPES.DELIVERY_MANAGE },
  tags: ["Driver Payments"],
  summary: "Create driver payment",
  description: `Record a payment event that settles a batch of delivered orders for a driver.

**Payment types and their effects:**
- \`cod_remittance\` — driver hands collected COD cash back to the business.
  - Sets \`orders.codPaymentId\` on every selected order.
  - Decrements \`driver.pendingCash\` by the sum of \`order.codAmount\`.
  - Increments \`driver.totalPaid\` by the same sum.
- \`fee_payment\` — business pays the driver their earned delivery fees.
  - Sets \`orders.feePaymentId\` on every selected order.
  - Driver counters (\`pendingCash\`, \`totalPaid\`) are **not** touched — those track COD only. Fees-paid is implicit (\`totalEarnings\` − sum of \`fee_payment\` amounts).
- \`net_settlement\` — hybrid: driver remits (COD total − fees) to the business.
  - Sets both \`orders.codPaymentId\` and \`orders.feePaymentId\` on every selected order.
  - Adjusts \`pendingCash\` / \`totalPaid\` using the COD total (not the net amount).

**Server-computed amount:** \`amount\` is **not** taken from the request. The server reads each order's frozen \`codAmount\` and \`driverFee\` and computes:
- \`cod_remittance\`: \`amount = sum(codAmount)\`
- \`fee_payment\`: \`amount = sum(driverFee)\`
- \`net_settlement\`: \`amount = sum(codAmount) − sum(driverFee)\`

**Order requirements:** All \`orderIds\` must belong to the specified driver and be in \`delivered\` status. Orders must not already be settled for the requested payment type.

\`createdBy\` and \`createdByName\` are derived from the authenticated user and cannot be overridden.`,
  operationId: "createDriverPayment",
  body: createPaymentSchema,
  responses: {
    201: {
      description: "Payment created and orders settled. Returns the new payment record.",
      content: jsonContent(SuccessWithMessageSchema(DriverPaymentSchema)),
    },
    422: {
      description: `Business rule violation. Distinguish via the \`code\` field:
- \`ORDER_NOT_FOUND\` — one or more orders do not exist, are not in \`delivered\` status, or do not belong to this driver
- \`PAYMENT_ALREADY_SETTLED\` — one or more orders are already settled for the requested payment type. \`context.kind\` is \`"cod"\` (when \`codPaymentId\` is already set) or \`"fee"\` (when \`feePaymentId\` is already set).`,
    },
  },
  handler: handlers.createPayment,
});

const listPaymentsRoute = defineRoute({
  method: "get",
  path: "/{driverId}",
  auth: { scope: SCOPES.DELIVERY_READ },
  tags: ["Driver Payments"],
  summary: "List driver payment history",
  description:
    "Returns all payment records for a driver, most recent first. Returns an empty array if the driver has no payments or the driver ID does not exist.",
  operationId: "listDriverPayments",
  params: driverIdParams,
  responses: {
    200: {
      description: "Payment history (empty array if driver has no payments)",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.array(DriverPaymentSchema),
        })
      ),
    },
  },
  handler: handlers.listPayments,
});

const listPendingOrdersRoute = defineRoute({
  method: "get",
  path: "/{driverId}/pending",
  auth: { scope: SCOPES.DELIVERY_READ },
  tags: ["Driver Payments"],
  summary: "List pending settlement orders",
  description: `Returns delivered orders that still have unsettled COD for a driver.

Specifically: orders where \`driverId\` matches, \`status = 'delivered'\`, and \`codPaymentId IS NULL\`.

Use this before creating a \`cod_remittance\` or \`net_settlement\` payment to see which orders are eligible and calculate the total. Returns an empty array if the driver has no pending orders or does not exist.`,
  operationId: "listPendingSettlementOrders",
  params: driverIdParams,
  responses: {
    200: {
      description:
        "Delivered orders with unsettled COD, most recently updated first (empty array if none). Each item is a full order record — see the Order schema.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          // Full order rows. The Order component still lives in the legacy
          // generator until the orders domain migrates; re-registering it
          // here would shadow the richer legacy definition in the merged
          // spec, so this stays an open record for now.
          data: z.array(z.record(z.string(), z.unknown())).openapi({
            description: "Full order records — see the Order component schema.",
          }),
        })
      ),
    },
  },
  handler: handlers.listPendingOrders,
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new OpenAPIHono<AppContext>();

router.openapi(createPaymentRoute.route, createPaymentRoute.handler);
router.openapi(listPaymentsRoute.route, listPaymentsRoute.handler);
router.openapi(listPendingOrdersRoute.route, listPendingOrdersRoute.handler);

export default router;

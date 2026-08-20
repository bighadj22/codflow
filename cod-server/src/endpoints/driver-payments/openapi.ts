/**
 * Driver Payments OpenAPI Paths
 */

const paymentSchema = { $ref: "#/components/schemas/DriverPayment" };
const orderSchema = { $ref: "#/components/schemas/Order" };
const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

export const driverPaymentPaths = {
  "/api/driver-payments": {
    post: {
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
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["driverId", "type", "orderIds"],
              properties: {
                driverId: {
                  type: "string",
                  description: "UUID of the driver this payment is for",
                  example: "d1a2b3c4-e5f6-7890-abcd-ef1234567890",
                },
                type: {
                  type: "string",
                  enum: ["cod_remittance", "fee_payment", "net_settlement"],
                  description: "Payment type. `cod_remittance`: driver hands COD cash to business. `fee_payment`: business pays driver fees. `net_settlement`: both at once (driver hands COD − fees net amount).",
                  example: "cod_remittance",
                },
                orderIds: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
                  description: "UUIDs of orders to settle. Every order must belong to this driver and have status `delivered`. Orders already settled for the requested payment type will cause a 422 error.",
                  example: ["ord-uuid-1", "ord-uuid-2"],
                },
                notes: {
                  type: "string",
                  description: "Optional internal note about this payment record. Omit if not needed (do not send `null`).",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Payment created and orders settled. Returns the new payment record.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: paymentSchema,
              message: { type: "string", example: "Payment recorded successfully" },
            },
          }),
        },
        "400": {
          description: "Validation error — missing required fields, empty orderIds array, or invalid payment type",
          content: json({
            ...validationErrorSchema,
            example: {
              error: "Validation failed",
              code: "VALIDATION_FAILED",
              category: "VALIDATION",
              context: {
                fields: [
                  { path: "orderIds", message: "Select at least one order", code: "too_small" },
                ],
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "422": {
          description: `Business rule violation. Distinguish via the \`code\` field:
- \`ORDER_NOT_FOUND\` — one or more orders do not exist, are not in \`delivered\` status, or do not belong to this driver
- \`PAYMENT_ALREADY_SETTLED\` — one or more orders are already settled for the requested payment type. \`context.kind\` is \`"cod"\` (when \`codPaymentId\` is already set) or \`"fee"\` (when \`feePaymentId\` is already set).`,
          content: {
            "application/json": {
              schema: errorSchema,
              examples: {
                orderNotFound: {
                  summary: "Order not delivered or not owned by driver",
                  value: {
                    error: "Some orders are invalid, not delivered, or do not belong to this driver",
                    code: "ORDER_NOT_FOUND",
                    category: "BUSINESS_LOGIC",
                    context: {
                      driverId: "d1a2b3c4-e5f6-7890-abcd-ef1234567890",
                      requestedCount: 2,
                      foundCount: 1,
                    },
                  },
                },
                alreadySettled: {
                  summary: "Order already settled for this payment type",
                  value: {
                    error: "2 order(s) already have their COD settled",
                    code: "PAYMENT_ALREADY_SETTLED",
                    category: "BUSINESS_LOGIC",
                    context: {
                      driverId: "d1a2b3c4-e5f6-7890-abcd-ef1234567890",
                      kind: "cod",
                      settledOrderIds: ["ord-uuid-1", "ord-uuid-2"],
                      settledCount: 2,
                    },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/driver-payments/{driverId}": {
    get: {
      tags: ["Driver Payments"],
      summary: "List driver payment history",
      description: "Returns all payment records for a driver, most recent first. Returns an empty array if the driver has no payments or the driver ID does not exist.",
      operationId: "listDriverPayments",
      parameters: [
        {
          name: "driverId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "UUID of the driver",
        },
      ],
      responses: {
        "200": {
          description: "Payment history (empty array if driver has no payments)",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: paymentSchema },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/driver-payments/{driverId}/pending": {
    get: {
      tags: ["Driver Payments"],
      summary: "List pending settlement orders",
      description: `Returns delivered orders that still have unsettled COD for a driver.

Specifically: orders where \`driverId\` matches, \`status = 'delivered'\`, and \`codPaymentId IS NULL\`.

Use this before creating a \`cod_remittance\` or \`net_settlement\` payment to see which orders are eligible and calculate the total. Returns an empty array if the driver has no pending orders or does not exist.`,
      operationId: "listPendingSettlementOrders",
      parameters: [
        {
          name: "driverId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "UUID of the driver",
        },
      ],
      responses: {
        "200": {
          description: "Delivered orders with unsettled COD, most recently updated first (empty array if none)",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: orderSchema },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};

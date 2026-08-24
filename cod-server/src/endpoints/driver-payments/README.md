# Driver Payments & Settlement API

The Driver Payments endpoint manages financial settlements and cash reconciliation between the merchant and in-house delivery drivers. It handles Cash on Delivery (COD) cash remittances, delivery fee payouts, and combined net settlements.

For the driver registry and per-wilaya compensation rates, see [`/api/drivers`](../drivers/README.md). For an in-depth financial architectural breakdown, see [`Guide.md`](./Guide.md).

---

## Directory Structure

```
src/endpoints/driver-payments/
├── ai-tools.ts            # AI/MCP tool definitions for agentic settlements (3 tools)
├── driver-payments.test.ts # Unit & integration tests for validation and settlement logic
├── handlers.ts            # HTTP request controllers with audit tracking
├── queries.ts             # Transactional settlement queries & shared query re-exports
├── routes.ts              # @hono/zod-openapi route definitions (validation + spec source of truth) with RBAC scope guards
├── validation.ts          # Zod request validation schemas
├── Guide.md               # Detailed financial domain guide & lifecycle walkthrough
└── README.md              # Endpoint reference documentation (this file)
```

---

## Core Concepts & Settlement Types

When a driver delivers an order, they collect cash from the customer (`codAmount`) and earn a delivery fee (`driverFee`). The Driver Payments API reconciles these balances across batches of delivered orders.

### 1. Payment Settlement Types

| Payment Type | Real-World Transaction | Money Direction | Database Impact |
| :--- | :--- | :--- | :--- |
| **`cod_remittance`** | Driver remits collected customer COD cash back to the store. | Driver → Store | • Sets `orders.codPaymentId`<br>• Decrements `drivers.pendingCash`<br>• Increments `drivers.totalPaid` |
| **`fee_payment`** | Store pays the driver their accumulated earned delivery fees. | Store → Driver | • Sets `orders.feePaymentId`<br>• Driver COD counters remain untouched |
| **`net_settlement`** | Hybrid: Driver remits cash collected minus their earned delivery fees in one transaction. | Driver → Store (Net) | • Sets both `orders.codPaymentId` and `orders.feePaymentId`<br>• Decrements `drivers.pendingCash` by COD total<br>• Increments `drivers.totalPaid` by COD total |

### 2. Server-Authoritative Calculation
Payment amounts cannot be passed or overridden by the client. The server strictly calculates the amount from each order's frozen financial values:
* **`cod_remittance`**: $\text{amount} = \sum \text{order.codAmount}$
* **`fee_payment`**: $\text{amount} = \sum \text{order.driverFee}$
* **`net_settlement`**: $\text{amount} = \sum \text{order.codAmount} - \sum \text{order.driverFee}$

### 3. Double-Settlement & Order Integrity Guards
* **Delivered Status Requirement**: All orders in `orderIds` must be in `delivered` status and assigned to the specified `driverId`. If any order fails this check, the request fails with `422 Unprocessable Entity` (`ORDER_NOT_FOUND`).
* **Double-Settlement Prevention**:
  * For `cod_remittance` or `net_settlement`: Rejects with `422 Unprocessable Entity` (`PAYMENT_ALREADY_SETTLED`, `kind: "cod"`) if any order already has `codPaymentId !== null`.
  * For `fee_payment` or `net_settlement`: Rejects with `422 Unprocessable Entity` (`PAYMENT_ALREADY_SETTLED`, `kind: "fee"`) if any order already has `feePaymentId !== null`.

### 4. Audit Trail
Every payment record stores `createdBy` (user ID) and `createdByName` (user display name or ID) from the authenticated context (`c.get("user")`).

---

## REST Endpoints

### 1. Create Driver Payment (Batch Settlement)
Record a payment transaction and settle a batch of delivered orders.

* **Route:** `POST /api/driver-payments`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:**
```json
{
  "driverId": "c1f76d49-411a-4d76-8051-92b19e2bf471",
  "type": "cod_remittance",
  "orderIds": [
    "ord_8b1e42a0-1234-4567-89ab-cdef01234567",
    "ord_9c2f53b1-2345-5678-90bc-def012345678"
  ],
  "notes": "Weekly COD cash remittance for Algiers center"
}
```
* **Field Specifications:**
  * `driverId` (*string*, required): UUID of the driver.
  * `type` (*string*, required): `"cod_remittance"`, `"fee_payment"`, or `"net_settlement"`.
  * `orderIds` (*array of strings*, required): Array of at least 1 order UUID to settle.
  * `notes` (*string*, optional): Internal notes about this payment.
* **Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "id": "pay_5e7d9a10-3456-6789-01cd-ef0123456789",
    "driverId": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "type": "cod_remittance",
    "amount": 14500,
    "orderCount": 2,
    "notes": "Weekly COD cash remittance for Algiers center",
    "createdBy": "usr_admin_01",
    "createdByName": "Admin User",
    "createdAt": "2026-01-20T16:00:00.000Z"
  }
}
```

---

### 2. List Driver Payment History
Retrieve the chronological payment and settlement history for a specific driver.

* **Route:** `GET /api/driver-payments/:driverId`
* **Authorization:** Requires `delivery:read` scope
* **Path Parameters:**
  * `driverId`: Driver UUID
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "pay_5e7d9a10-3456-6789-01cd-ef0123456789",
      "driverId": "c1f76d49-411a-4d76-8051-92b19e2bf471",
      "type": "cod_remittance",
      "amount": 14500,
      "orderCount": 2,
      "notes": "Weekly COD cash remittance for Algiers center",
      "createdBy": "usr_admin_01",
      "createdByName": "Admin User",
      "createdAt": "2026-01-20T16:00:00.000Z"
    }
  ]
}
```

---

### 3. List Pending Settlement Orders
List all delivered orders assigned to a driver that currently have unsettled COD (`status = 'delivered'` and `codPaymentId IS NULL`). Used to prepare batches for settlement.

* **Route:** `GET /api/driver-payments/:driverId/pending`
* **Authorization:** Requires `delivery:read` scope
* **Path Parameters:**
  * `driverId`: Driver UUID
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ord_8b1e42a0-1234-4567-89ab-cdef01234567",
      "orderNumber": "ORD-2026-0042",
      "status": "delivered",
      "driverId": "c1f76d49-411a-4d76-8051-92b19e2bf471",
      "codAmount": 7500,
      "driverFee": 400,
      "codPaymentId": null,
      "feePaymentId": null,
      "updatedAt": "2026-01-20T14:30:00.000Z"
    }
  ]
}
```

---

## AI & MCP Tools (`ai-tools.ts`)

For remote AI agents connecting via Model Context Protocol (MCP) or the AI SDK, the module exposes 3 programmatic tools via `getDriverPaymentTools(db)`:

| Tool Name | Purpose | Key Parameters |
| :--- | :--- | :--- |
| `listDriverPayments` | Retrieve the payment and remittance history for a specific driver. | `driverId` |
| `getPendingSettlements` | Find delivered orders with unsettled COD balances ready to be batched into a settlement. | `driverId` |
| `createDriverSettlement` | Record a batch payment/remittance event for delivered orders with double-settlement guards. | `driverId`, `type`, `orderIds`, `agentName`, `notes` |

---

## Error Handling & Error Codes

The Driver Payments endpoint adheres to the platform's standardized JSON error envelope:

```json
{
  "error": "2 order(s) already have their COD settled",
  "code": "PAYMENT_ALREADY_SETTLED",
  "category": "BUSINESS_LOGIC",
  "context": {
    "driverId": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "kind": "cod",
    "settledOrderIds": ["ord_8b1e42a0-1234-4567-89ab-cdef01234567"],
    "settledCount": 1
  }
}
```

### Handled Error Codes

| HTTP Status | Error Code | Category | Cause / Context |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | `VALIDATION` | Empty `orderIds` array, missing fields, or invalid payment type. |
| `400 Bad Request` | `REQUIRED_FIELD_MISSING` | `VALIDATION` | Missing path parameter `driverId`. |
| `422 Unprocessable Entity` | `ORDER_NOT_FOUND` | `BUSINESS_LOGIC` | One or more requested orders are invalid, not in `delivered` status, or do not belong to the specified driver (`requestedCount` vs `foundCount`). |
| `422 Unprocessable Entity` | `PAYMENT_ALREADY_SETTLED` | `BUSINESS_LOGIC` | One or more orders are already linked to a settlement for the requested type (`kind: "cod"` or `kind: "fee"`). |
| `401 Unauthorized` | `UNAUTHENTICATED` | `AUTHENTICATION` | Missing or invalid API key or OAuth bearer token. |
| `403 Forbidden` | — (no `code` field) | — | Missing required scope (`delivery:read` or `delivery:manage`). Scope denials come from RBAC middleware as plain JSON: `{ "error": "Insufficient permissions", "required": "<scope>" }`. |


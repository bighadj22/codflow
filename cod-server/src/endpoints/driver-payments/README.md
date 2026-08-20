# Driver Payments & Settlement API

API for managing financial settlements between the business and delivery drivers, covering cash remittance (COD) and delivery fee payments.

## Structure

```
driver-payments/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
└── README.md       # This file
```

## Core Concepts

This API handles the "settlement" of delivered orders. When a driver delivers a package, they collect cash (COD) and earn a fee. This API allows the business to record when that cash is handed over or when the driver is paid their fees.

### Payment Types
- **`cod_remittance`**: The driver remits the cash collected from customers to the business. 
    - *Side effect*: Decrements driver's `pendingCash` and increments `totalPaid`.
- **`fee_payment`**: The business pays the delivery fees earned by the driver.
- **`net_settlement`**: A single transaction where the business receives the net amount (`Total COD - Total Fees`). Handles both COD and fee settlement in one record.

## API Endpoints

### POST /api/driver-payments
Create a payment record and settle a batch of delivered orders.

**Authorization:** Requires `delivery:manage` scope

**Request Body:**
```json
{
  "driverId": "uuid",
  "type": "cod_remittance", 
  "orderIds": ["uuid-1", "uuid-2"],
  "notes": "Weekly settlement for Algiers sector"
}
```

**Business Rules:**
- All selected orders must be in `delivered` status.
- All selected orders must belong to the specified driver.
- Orders cannot be settled twice for the same type (e.g., you cannot remit COD for an order that already has a `codPaymentId`).

### GET /api/driver-payments/:driverId
Get the full payment history for a specific driver, most recent first.

**Authorization:** Requires `delivery:read` scope

### GET /api/driver-payments/:driverId/pending
List all delivered orders for a driver that are currently **unsettled** (i.e., `codPaymentId` is null). This is used by the frontend to build a settlement batch.

**Authorization:** Requires `delivery:read` scope

## Implementation Details

- **Batch Processing**: Settlements are performed on batches of orders (`orderIds` array) to simplify bookkeeping.
- **Order Linking**: When a payment is created, the corresponding `codPaymentId` and/or `feePaymentId` fields on the `orders` table are updated to link back to the payment record.
- **Aggregate Updates**: For COD-related payments, the driver's `pendingCash` (money currently held by the driver) and `totalPaid` (lifetime cash remitted) are automatically updated.
- **Audit Trail**: Every payment record stores `createdBy` and `createdByName` based on the authenticated user who performed the settlement.

# Drivers & In-House Delivery API

The Drivers endpoint manages in-house delivery drivers, vehicle assignments, availability statuses, and per-wilaya driver payroll compensations.

Cash remittance and fee settlements are handled separately via the [`/api/driver-payments`](../driver-payments/README.md) endpoint. Customer delivery charges are defined via [`/api/shipping-profiles`](../shipping-profiles/README.md).

---

## Directory Structure

```
src/endpoints/drivers/
├── ai-tools.ts      # AI/MCP tool definitions for agentic driver management (6 tools)
├── drivers.test.ts  # Unit tests for Zod validation schemas and query logic
├── routes.test.ts   # Route-level integration tests (OpenAPIHono router)
├── handlers.test.ts # Integration tests for HTTP route handlers & error responses
├── handlers.ts      # HTTP request controllers with activity logging
├── queries.ts       # Database operations (re-exports cod-shared + delete active order guard)
├── routes.ts        # OpenAPIHono route definitions (validation + spec) with RBAC scope guards
├── validation.ts    # Zod schemas for input validation, phone formatting, & filtering
└── README.md        # Endpoint documentation (this file)
```

Routes are defined with `@hono/zod-openapi` (`createRoute`), making `routes.ts`
the single source of truth for request validation and the OpenAPI spec.
Handlers read pre-validated data via `(c.req as any).valid?.(...)` and fall
back to the Zod schemas in `validation.ts` when mounted standalone.

---

## Core Concepts & Business Rules

### 1. Customer Pricing vs. Driver Pay
* **Customer Shipping Rate**: Governed by shipping profiles (`shipping_profiles`, `shipping_rules`, `shipping_rule_communes`) which determine what the buyer is charged at checkout.
* **Driver Compensation**: Governed by `driver_compensations` (`fee_per_delivery`) per `(driverId, wilayaId)` pair. This is what the merchant pays the driver per successful delivery.
* **Sparse Compensation Grid**: If no compensation row exists for a given wilaya, order assignment succeeds with `orders.driverFee = 0`.

### 2. Cash on Delivery (COD) & Earnings Metrics
The `drivers` table maintains live cumulative balances:
* `totalDelivered` (*integer*): Count of orders delivered by this driver (incremented on status transition to `delivered`).
* `totalEarnings` (*real / DZD*): Cumulative delivery fees earned by the driver (`order.driverFee`).
* `pendingCash` (*real / DZD*): Cash collected by the driver on COD orders awaiting remittance to the merchant (`order.codAmount`).
* `totalPaid` (*real / DZD*): Total COD cash successfully remitted to the merchant (settled via `/api/driver-payments`).

### 3. Active Order Deletion Guard
A driver cannot be deleted if they have active assigned orders (status `assigned` or `out_for_delivery`). The API rejects the deletion with `409 Conflict` (`DRIVER_HAS_ACTIVE_ORDERS`) including `activeOrderCount` in the error context.

### 4. Phone Validation & Uniqueness
* Primary `phone` and optional `phone2` must match Algerian mobile formats (`^0[5-7]\d{8}$`, e.g., `0555123456`, `0666123456`, `0777123456`).
* Primary phone numbers are strictly unique across all drivers. Attempting to register or update to an existing phone returns `409 Conflict` (`DUPLICATE_PHONE`).

### 5. RBAC Permission Scopes
* `delivery:read`: Required for read operations (`GET /api/drivers`, `GET /api/drivers/:id`, `GET /api/drivers/:id/compensations`).
* `delivery:manage`: Required for write operations (`POST`, `PATCH`, `DELETE`, and compensation mutations).

### 6. Activity Audit Logging
All driver lifecycle events are automatically recorded to the audit log (`activity_logs`):
* `driver.created` (`ACTIONS.DRIVER_CREATED`)
* `driver.updated` (`ACTIONS.DRIVER_UPDATED`)
* `driver.status_changed` (`ACTIONS.DRIVER_STATUS_CHANGED`)
* `driver.deleted` (`ACTIONS.DRIVER_DELETED`)

---

## REST Endpoints

### 1. List Drivers
Retrieve a paginated list of drivers with optional filters.

* **Route:** `GET /api/drivers`
* **Authorization:** Requires `delivery:read` scope
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `wilayaId` | `integer` (1–58) | No | — | Filter to drivers with a configured compensation row for this wilaya |
  | `status` | `string` | No | — | Filter by availability: `available`, `busy`, `inactive` |
  | `vehicleType` | `string` | No | — | Filter by vehicle type: `motorcycle`, `car`, `van` |
  | `search` | `string` | No | — | Case-insensitive substring search on `firstName`, `lastName`, or `phone` |
  | `limit` | `integer` | No | `50` | Max items to return (max `100`) |
  | `offset` | `integer` | No | `0` | Number of items to skip |

* **Response (`200 OK`):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "c1f76d49-411a-4d76-8051-92b19e2bf471",
      "firstName": "Mohamed",
      "lastName": "Amiri",
      "phone": "0555123456",
      "phone2": "0666123456",
      "vehicleType": "van",
      "status": "available",
      "totalDelivered": 42,
      "totalEarnings": 16800,
      "pendingCash": 35000,
      "totalPaid": 250000,
      "notes": "Reliable driver for Algiers region",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-20T14:30:00.000Z",
      "compensationWilayaCount": 5
    }
  ]
}
```

---

### 2. Get Driver Details
Retrieve complete details for a single driver, including their compensation summary and recent assigned orders.

* **Route:** `GET /api/drivers/:id`
* **Authorization:** Requires `delivery:read` scope
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "firstName": "Mohamed",
    "lastName": "Amiri",
    "phone": "0555123456",
    "phone2": "0666123456",
    "vehicleType": "van",
    "status": "available",
    "totalDelivered": 42,
    "totalEarnings": 16800,
    "pendingCash": 35000,
    "totalPaid": 250000,
    "notes": "Reliable driver for Algiers region",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-20T14:30:00.000Z",
    "compensationWilayaCount": 5,
    "recentOrders": [
      {
        "id": "ord_8b1e42",
        "orderNumber": "ORD-2026-0042",
        "status": "delivered",
        "wilayaId": 16,
        "totalAmount": 7500,
        "driverFee": 400,
        "updatedAt": "2026-01-20T14:30:00.000Z"
      }
    ]
  }
}
```

---

### 3. Create Driver
Register a new in-house driver. Per-wilaya compensations are configured after creation via the compensation endpoints.

* **Route:** `POST /api/drivers`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:**
```json
{
  "firstName": "Mohamed",
  "lastName": "Amiri",
  "phone": "0555123456",
  "phone2": "0666123456",
  "vehicleType": "van",
  "status": "available",
  "notes": "Reliable driver for Algiers region"
}
```
* **Field Specifications:**
  * `firstName` (*string*, required): Driver's given name.
  * `lastName` (*string*, required): Driver's family name.
  * `phone` (*string*, required): Primary phone (`05|06|07` + 8 digits). Must be unique.
  * `phone2` (*string*, optional): Secondary phone number.
  * `vehicleType` (*string*, optional): `"motorcycle"`, `"car"`, or `"van"`.
  * `status` (*string*, optional): `"available"` (default), `"busy"`, or `"inactive"`.
  * `notes` (*string*, optional): Internal merchant notes.
* **Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Driver created successfully",
  "data": {
    "id": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "firstName": "Mohamed",
    "lastName": "Amiri",
    "phone": "0555123456",
    "phone2": "0666123456",
    "vehicleType": "van",
    "status": "available",
    "totalDelivered": 0,
    "totalEarnings": 0,
    "pendingCash": 0,
    "totalPaid": 0,
    "notes": "Reliable driver for Algiers region",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z",
    "compensationWilayaCount": 0,
    "recentOrders": []
  }
}
```

---

### 4. Update Driver Profile
Partially update driver details. Omitted fields remain unchanged. To update driver status, use `PATCH /api/drivers/:id/status`.

* **Route:** `PATCH /api/drivers/:id`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:**
```json
{
  "firstName": "Mohamed",
  "lastName": "Amiri",
  "phone": "0555987654",
  "phone2": null,
  "vehicleType": "car",
  "notes": "Transferred to Blida & Algiers"
}
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Driver updated successfully",
  "data": {
    "id": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "firstName": "Mohamed",
    "lastName": "Amiri",
    "phone": "0555987654",
    "phone2": null,
    "vehicleType": "car",
    "status": "available",
    "totalDelivered": 42,
    "totalEarnings": 16800,
    "pendingCash": 35000,
    "totalPaid": 250000,
    "notes": "Transferred to Blida & Algiers",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-21T09:00:00.000Z",
    "compensationWilayaCount": 5,
    "recentOrders": []
  }
}
```

---

### 5. Update Driver Status
Update a driver's operational availability.

* **Route:** `PATCH /api/drivers/:id/status`
* **Authorization:** Requires `delivery:manage` scope
* **Request Body:**
```json
{
  "status": "busy"
}
```
* **Allowed Values:**
  * `"available"`: Ready to receive order assignments.
  * `"busy"`: Active on routes, at capacity, or taking a break.
  * `"inactive"`: Off-duty, suspended, or no longer active.
* **Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Driver status updated",
  "data": {
    "id": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "status": "busy",
    "updatedAt": "2026-01-21T09:15:00.000Z"
  }
}
```

---

### 6. Delete Driver
Permanently delete a driver. Deletion cascades to all associated `driver_compensations` rows.

* **Route:** `DELETE /api/drivers/:id`
* **Authorization:** Requires `delivery:manage` scope
* **Constraint:** Blocked with `409 Conflict` if the driver has active orders in `assigned` or `out_for_delivery` status.
* **Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Driver deleted successfully"
}
```

---

### 7. List Driver Compensations
Returns all **58 Algerian wilayas** with the driver's configured per-delivery pay. Wilayas without a configured fee return `feePerDelivery: null`.

* **Route:** `GET /api/drivers/:id/compensations`
* **Authorization:** Requires `delivery:read` scope
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "wilayaId": 16,
      "wilayaName": "Alger",
      "wilayaNameAr": "الجزائر",
      "feePerDelivery": 400
    },
    {
      "wilayaId": 9,
      "wilayaName": "Blida",
      "wilayaNameAr": "البليدة",
      "feePerDelivery": 450
    },
    {
      "wilayaId": 31,
      "wilayaName": "Oran",
      "wilayaNameAr": "وهران",
      "feePerDelivery": null
    }
  ]
}
```

---

### 8. Set Driver Compensation (Upsert)
Set or update the delivery fee paid to the driver for a specific wilaya.

* **Route:** `PUT /api/drivers/:id/compensations/:wilayaId`
* **Authorization:** Requires `delivery:manage` scope
* **Path Parameters:**
  * `id`: Driver UUID
  * `wilayaId`: Integer between `1` and `58`
* **Request Body:**
```json
{
  "feePerDelivery": 400
}
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Compensation saved",
  "data": {
    "id": "06e8ef26-c23f-4e04-ba09-17bf8a481c7e",
    "driverId": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "wilayaId": 16,
    "feePerDelivery": 400,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-21T10:00:00.000Z"
  }
}
```

---

### 9. Delete Driver Compensation
Remove a driver's configured compensation fee for a specific wilaya. Future deliveries assigned in this wilaya will compute `driverFee = 0`.

* **Route:** `DELETE /api/drivers/:id/compensations/:wilayaId`
* **Authorization:** Requires `delivery:manage` scope
* **Path Parameters:**
  * `id`: Driver UUID
  * `wilayaId`: Integer between `1` and `58`
* **Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Compensation removed"
}
```

---

## AI & MCP Tools (`ai-tools.ts`)

For remote AI agents connecting via Model Context Protocol (MCP) or the AI SDK, the drivers module exposes 6 programmatic tools via `getDriverTools(db)` with a robust two-layer validation pattern:

| Tool Name | Purpose | Key Parameters |
| :--- | :--- | :--- |
| `listDrivers` | Search and filter drivers by status, vehicle type, wilaya coverage, or keyword. | `wilayaId`, `status`, `vehicleType`, `search`, `limit`, `offset` |
| `getDriverDetails` | Fetch full driver profile, compensation stats, and recent order assignments. | `driverId` |
| `createNewDriver` | Register a new delivery driver with contact details and vehicle type. | `firstName`, `lastName`, `phone`, `phone2`, `vehicleType`, `status`, `notes` |
| `updateDriverProfile` | Update personal details, contact info, vehicle, or notes. | `driverId`, `updates` object |
| `updateDriverStatus` | Change driver operational status (`available`, `busy`, `inactive`). | `driverId`, `status` |
| `deleteDriver` | Permanently delete a driver (guarded against active deliveries). | `driverId` |

---

## Error Handling & Error Codes

The Drivers endpoint adheres to the platform's standardized JSON error envelope:

```json
{
  "error": "Cannot delete driver with active orders",
  "code": "DRIVER_HAS_ACTIVE_ORDERS",
  "category": "BUSINESS_LOGIC",
  "context": {
    "driverId": "c1f76d49-411a-4d76-8051-92b19e2bf471",
    "activeOrderCount": 2
  }
}
```

### Handled Error Codes

| HTTP Status | Error Code | Category | Cause / Context |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | `VALIDATION` | Invalid payload (e.g., non-Algerian phone format, invalid wilaya ID). |
| `400 Bad Request` | `REQUIRED_FIELD_MISSING` | `VALIDATION` | Missing required parameters (e.g., driver `id` or name). |
| `404 Not Found` | `DRIVER_NOT_FOUND` | `BUSINESS_LOGIC` | No driver exists with the specified ID. |
| `404 Not Found` | `DRIVER_COMPENSATION_NOT_FOUND` | `BUSINESS_LOGIC` | Attempted to delete a compensation row that does not exist. |
| `409 Conflict` | `DUPLICATE_PHONE` | `BUSINESS_LOGIC` | Another driver already exists with the provided phone number. |
| `409 Conflict` | `DRIVER_HAS_ACTIVE_ORDERS` | `BUSINESS_LOGIC` | Attempted to delete a driver with orders in `assigned` or `out_for_delivery` status. |
| `401 Unauthorized` | `UNAUTHENTICATED` | `AUTHENTICATION` | Missing or invalid API key or OAuth bearer token. |
| `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` | `AUTHORIZATION` | Missing required scope (`delivery:read` or `delivery:manage`). |


# Drivers & Delivery Management API

Complete API for managing delivery drivers and per-wilaya compensations. Cash remittance and fee settlement are handled by the `/api/driver-payments` endpoint.

## Structure

```
drivers/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
├── drivers.test.ts # Unit tests for validation and logic
└── README.md       # This file
```

## Concept: customer pricing ≠ driver pay

Drivers are **not** linked to customer-facing shipping profiles. Those profiles
(`shipping_profiles` / `shipping_rules` / `shipping_rule_communes`) describe
what the **customer** pays for delivery. Driver pay is a completely separate
concern and lives in `driver_compensations` — one row per (driver, wilaya)
with the `feePerDelivery` the store pays that driver for that wilaya.

No row for a given wilaya = no configured pay (assignment still works;
`orders.driverFee` defaults to 0 and admin should fill in the row).

## API Endpoints

### GET /api/drivers
List all drivers with optional filtering and pagination. Each item includes
`compensationWilayaCount` — how many wilayas already have a configured fee.

**Authorization:** Requires `delivery:read` scope

**Query Parameters:**
- `wilayaId` — Filter to drivers that have a compensation row for this wilaya (1-58)
- `status` — Filter by availability (`available`, `busy`, `inactive`)
- `vehicleType` — Filter by vehicle type (`motorcycle`, `car`, `van`)
- `search` — Search by first name, last name, or phone
- `limit` — Pagination limit (default: 50, max: 100)
- `offset` — Pagination offset (default: 0)

### GET /api/drivers/:id
Get a single driver's full details, including compensation summary
(`compensationWilayaCount`) and up to 10 most recent orders assigned to them.

**Authorization:** Requires `delivery:read` scope

### POST /api/drivers
Register a new driver. Compensations are configured separately after
creation via the compensation endpoints below.

**Authorization:** Requires `delivery:manage` scope

**Request Body:**
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

### PATCH /api/drivers/:id
Update driver profile information (name, contact info, vehicle, notes).

**Authorization:** Requires `delivery:manage` scope

### PATCH /api/drivers/:id/status
Update a driver's availability status.

**Authorization:** Requires `delivery:manage` scope

**Valid Statuses:**
- `available` — Driver is ready for new assignments
- `busy` — Driver is currently at capacity or on a break
- `inactive` — Driver is off-duty or suspended

### DELETE /api/drivers/:id
Permanently delete a driver.

**Constraint:** Blocked (409 Conflict) if the driver has active orders in
`assigned` or `out_for_delivery` status. These orders must be completed or
re-assigned first.

**Authorization:** Requires `delivery:manage` scope

### GET /api/drivers/:id/compensations
Returns all 58 wilayas with the driver's configured `feePerDelivery`. Wilayas
with no configured row return `feePerDelivery: null`.

**Authorization:** Requires `delivery:read` scope

### PUT /api/drivers/:id/compensations/:wilayaId
Upsert (create-or-update) the driver's per-delivery fee for one wilaya.

**Authorization:** Requires `delivery:manage` scope

**Request Body:**
```json
{ "feePerDelivery": 350 }
```

### DELETE /api/drivers/:id/compensations/:wilayaId
Remove the driver's compensation row for one wilaya. Returns 404 if no row
existed. Future assignments in that wilaya will compute `driverFee = 0` until
a new row is set.

**Authorization:** Requires `delivery:manage` scope

## Features & Implementation

- **Cash tracking:** `pendingCash` (money collected from COD orders) and `totalEarnings` (fees earned by the driver). Settle via `/api/driver-payments`.
- **Per-wilaya compensations:** sparse grid — only wilayas the store wants to configure get rows; others fall back to fee = 0 on assignment.
- **Active-order guard:** prevents deletion of drivers mid-delivery.
- **Activity logging:** all management actions (creation, updates, compensation changes) are logged.
- **RBAC:** `delivery:read` for viewing, `delivery:manage` for everything else.

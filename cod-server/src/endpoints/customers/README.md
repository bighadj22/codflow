# Customers Management API

API for managing customer profiles, contact information, purchase history,
and segmentation via groups and tags.

## Structure

```
customers/
├── routes.ts          # OpenAPIHono route definitions (validation + spec) with RBAC
├── handlers.ts        # HTTP request handlers (controller logic)
├── queries.ts         # Re-exports shared queries; deleteCustomer lives here
├── validation.ts      # Zod validation schemas (handler-level fallback)
├── ai-tools.ts        # AI SDK tools for customer management
├── skill.md           # AI skill doc for customer-management workflows
├── customers.test.ts  # Unit tests for validation and query logic
├── routes.test.ts     # Route-level integration tests (OpenAPIHono router)
├── handlers.test.ts   # Integration/error-scenario tests for handlers
└── README.md          # This file
```

`queries.ts` re-exports CRUD/list helpers from
`cod-shared/queries/customers`; `deleteCustomer` stays in cod-server because
it raises `BusinessLogicError`.

Routes are defined with `@hono/zod-openapi` (`createRoute`), making
`routes.ts` the single source of truth for request validation and the
OpenAPI spec. Handlers read pre-validated data via
`(c.req as any).valid?.(...)` and fall back to the Zod schemas in
`validation.ts` when mounted standalone.

## API Endpoints

### GET /api/customers

List customers with optional filtering, segmentation, and pagination.

- **Authorization:** `customers:read`
- **Query Parameters:**
  - `wilayaId` — Filter by wilaya ID (1–58)
  - `search` — Search by customer name or phone
  - `groupId` — Filter to customers in a specific customer group
  - `tagId` — Filter to customers with a specific tag
  - `limit` — Pagination limit (default: 50, max: 100)
  - `offset` — Pagination offset (default: 0)
- **Response:** `{ success, data: Customer[], count }` where each customer
  includes the denormalized stats `totalOrders`, `totalSpent`, and
  `lastOrderAt`, plus Arabic display names `wilaya` / `commune`.
  List items do **not** include `recentOrders`.

### GET /api/customers/:id

Get a single customer's full profile plus `recentOrders` (up to 10 most
recent orders, newest first).

- **Authorization:** `customers:read`
- **Errors:** `404 CUSTOMER_NOT_FOUND`

### GET /api/customers/:id/orders

Complete order history for a customer, newest first. Each order includes its
full `statusHistory` plus joined Arabic `wilaya` / `commune` names.

- **Authorization:** `customers:read`

### GET /api/customers/:id/groups

List all groups the customer belongs to (each with `assignedAt`).

- **Authorization:** `customer_groups:read`

### GET /api/customers/:id/tags

List all tags assigned to the customer (each with `assignedAt`).

- **Authorization:** `customer_tags:read`

### POST /api/customers

Register a new customer profile.

- **Authorization:** `customers:create`
- **Reference Sync:** Resolves `wilayaId` and `communeId` to their Arabic
  display names automatically.
- **Duplicate Check:** `409 DUPLICATE_PHONE` when another customer already
  uses the same phone number.
- **Request Body:**
  ```json
  {
    "name": "Sarah Ahmed",
    "phone": "0770112233",
    "phone2": "0550112233",
    "wilayaId": 16,
    "communeId": "uuid",
    "address": "12 Rue Didouche Mourad"
  }
  ```
  Field rules:
  - `name` — required, non-empty.
  - `phone` — required, must match `^0[5-7]\d{8}$` (Algerian mobile).
  - `phone2` — optional, same format; empty string is treated as absent.
  - `wilayaId` — required, integer 1–58.
  - `communeId` — required, non-empty string.
  - `address` — optional string.
- **Response:** `201` with the created customer (`recentOrders: []`).
- **Errors:** `400` validation, `409` duplicate phone.

### PATCH /api/customers/:id

Update customer profile information. Partial updates; set `phone2`,
`communeId`, or `address` to `null` to clear them.

- **Authorization:** `customers:update`
- **Duplicate Check:** If `phone` is being changed, `409 DUPLICATE_PHONE`
  when another customer already uses it.
- **Errors:** `400` validation, `404 CUSTOMER_NOT_FOUND`, `409` duplicate phone.

### DELETE /api/customers/:id

Permanently remove a customer profile.

- **Authorization:** `customers:delete`
- **Constraint:** Blocked with **`422`** (`CUSTOMER_HAS_ORDERS`, context
  includes `orderCount`) if the customer has any existing orders. This
  protects the integrity of the order history.
- **Errors:** `404 CUSTOMER_NOT_FOUND`, `422 CUSTOMER_HAS_ORDERS`.

## Features & Implementation

- **Purchase Statistics:** Tracks `totalOrders`, `totalSpent`, and
  `lastOrderAt` automatically as orders are placed.
- **Segmentation:** Deep integration with `customer-groups` and
  `customer-tags` for targeted marketing and analysis.
- **Reference Table Integration:** Maps IDs to Arabic display names for
  wilayas and communes using the central reference system.
- **RBAC:** Granular control over reading (`customers:read`),
  creating (`customers:create`), updating (`customers:update`), deleting
  (`customers:delete`), plus group/tag membership lookups gated by
  `customer_groups:read` / `customer_tags:read`.

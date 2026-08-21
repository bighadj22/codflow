# Activity Logs API

The Activity Logs endpoint provides an immutable, centralized audit trail for the CodFlow system. It records administrative operations, order lifecycle transitions, customer updates, inventory modifications, driver management actions, and AI/MCP agent interactions.

All activity log endpoints are strictly **Admin-Only** (`role === "admin"`).

---

## Directory Structure

```
src/endpoints/activity-logs/
├── handlers.test.ts # Unit tests for logActivity helper, action constants, and queries
├── handlers.ts      # HTTP request controllers for querying the audit trail
├── routes.ts        # @hono/zod-openapi route definitions with adminOnly middleware
└── README.md        # Endpoint reference documentation (this file)
```

> **Note on OpenAPI:** Routes in this module are defined using `@hono/zod-openapi` in `routes.ts`, serving as the single source of truth for request validation and OpenAPI 3.1 specification generation.

---

## Core Concepts & Architecture

### 1. Data Model (`activity_logs`)
Each audit entry is permanently recorded with the following schema:
* `id` (*string*): Unique UUID generated on creation.
* `actorId` (*string*): UUID of the team member or service account performing the action.
* `actorName` (*string*): Denormalized display name (preserved even if the user is later deleted; falls back to `"Unknown"`).
* `actorRole` (*string*): `"admin"` or `"staff"`.
* `action` (*string*): Standardized dot-notation action identifier (e.g., `order.status_changed`, `stock.adjusted`, `mcp.tool_called`).
* `entityType` (*string*): Entity domain category (e.g., `order`, `customer`, `customer_group`, `customer_tag`, `driver`, `product`, `stock`, `review`, `user`, `mcp`).
* `entityId` (*string*): Primary key/ID of the target entity.
* `entityLabel` (*string*, optional): Human-readable snapshot at the time of the action (e.g., order number `ORD-2026-0042`, driver name, product title).
* `metadata` (*string*, optional): JSON-encoded contextual payload (e.g., `{ "from": "pending", "to": "confirmed" }`, `{ "role": "admin" }`, `{ "wilayaId": 16 }`).
* `createdAt` (*string / ISO 8601*): Timestamp when the action took place.

### 2. Fire-and-Forget Logging (`src/lib/activity.ts`)
Audit entries are created asynchronously via the `logActivity` helper:
```typescript
import { logActivity, ACTIONS } from "@/lib/activity";

await logActivity(
  db,
  actor, // Pick<AuthUser, "id" | "name" | "role">
  ACTIONS.ORDER_STATUS_CHANGED,
  { type: "order", id: orderId, label: orderNumber },
  { from: oldStatus, to: newStatus }
);
```
**Resilience Guarantee**: `logActivity` silently catches and logs any internal database write failures, ensuring that an audit logging issue never fails or rolls back the primary business transaction.

### 3. Comprehensive Action Types Catalog

The system defines standardized action identifiers in `ACTIONS`:

| Domain | Action Constants | Description |
| :--- | :--- | :--- |
| **Orders** | `order.created`<br>`order.status_changed`<br>`order.driver_assigned`<br>`order.dispatched`<br>`order.product_returned`<br>`order.deleted` | Order lifecycle, courier dispatch, driver assignment, partial returns, and cancellations. |
| **Customers** | `customer.created`<br>`customer.updated`<br>`customer.deleted` | Customer profile creation and modifications. |
| **Customer Groups** | `customer_group.created`<br>`customer_group.updated`<br>`customer_group.deleted`<br>`customer_group.member_added`<br>`customer_group.member_removed` | CRM customer segmentation and group memberships. |
| **Customer Tags** | `customer_tag.created`<br>`customer_tag.updated`<br>`customer_tag.deleted`<br>`customer_tag.assigned`<br>`customer_tag.unassigned` | Tag creation and assignment to customer records. |
| **Drivers** | `driver.created`<br>`driver.updated`<br>`driver.status_changed`<br>`driver.deleted` | Driver registry, availability status changes, compensation adjustments, and deletions. |
| **Products** | `product.created`<br>`product.updated`<br>`product.status_changed`<br>`product.deleted` | Product catalog mutations and publishing status. |
| **Stock** | `stock.adjusted` | Inventory adjustments across product variants. |
| **Reviews** | `review.approved`<br>`review.rejected`<br>`review.deleted` | Customer review moderation actions. |
| **Users / Team** | `user.created`<br>`user.updated`<br>`user.role_changed`<br>`user.scope_granted`<br>`user.scope_revoked` | Team member onboarding, role changes, and granular scope assignment. |
| **AI / MCP** | `mcp.tool_called`<br>`mcp.tool_declined`<br>`mcp.connection_revoked` | Audit trail for remote MCP AI agent tool executions and user-declined HITL confirmations. |

---

## REST Endpoints

All activity log endpoints require **Admin role** (`role === "admin"`). Requests by non-admin users return `403 Forbidden` (`INSUFFICIENT_PERMISSIONS`).

### 1. List Activity Logs
Get a paginated list of system-wide activity logs, ordered by `createdAt` descending.

* **Route:** `GET /api/activity-logs`
* **Access Control:** Admin Only
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `actorId` | `string` | No | — | Filter by the user ID who performed the action |
  | `entityType` | `string` | No | — | Filter by domain category (`order`, `customer`, `driver`, `product`, `stock`, `user`, etc.) |
  | `limit` | `integer` | No | `50` | Maximum number of logs to return (max `100`) |
  | `offset` | `integer` | No | `0` | Number of logs to skip |

* **Response (`200 OK`):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "e4f87a20-3b12-4c5d-9e6f-7a8b9c0d1e2f",
      "actorId": "usr_staff_01",
      "actorName": "Amira Khalil",
      "actorRole": "staff",
      "action": "order.status_changed",
      "entityType": "order",
      "entityId": "ord_8b1e42a0-1234-4567-89ab-cdef01234567",
      "entityLabel": "ORD-2026-0042",
      "metadata": "{\"from\":\"pending\",\"to\":\"confirmed\"}",
      "createdAt": "2026-01-20T14:30:00.000Z"
    }
  ]
}
```

---

### 2. Get User Activity Logs
Retrieve the chronological activity log for a specific team member. Used by the merchant dashboard's Team Member Profile Sheet.

* **Route:** `GET /api/activity-logs/users/:userId`
* **Access Control:** Admin Only
* **Path Parameters:**
  * `userId`: UUID of the team member
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `limit` | `integer` | No | `30` | Maximum number of logs to return (max `100`) |
  | `offset` | `integer` | No | `0` | Number of logs to skip |

* **Response (`200 OK`):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "e4f87a20-3b12-4c5d-9e6f-7a8b9c0d1e2f",
      "actorId": "usr_staff_01",
      "actorName": "Amira Khalil",
      "actorRole": "staff",
      "action": "order.driver_assigned",
      "entityType": "order",
      "entityId": "ord_8b1e42a0-1234-4567-89ab-cdef01234567",
      "entityLabel": "ORD-2026-0042",
      "metadata": "{\"driverId\":\"c1f76d49-411a-4d76-8051-92b19e2bf471\",\"driverName\":\"Mohamed Amiri\"}",
      "createdAt": "2026-01-20T14:30:00.000Z"
    }
  ]
}
```

---

## Error Handling & Error Codes

The Activity Logs endpoint adheres to the platform's standardized JSON error envelope:

```json
{
  "error": "Admin access required",
  "code": "INSUFFICIENT_PERMISSIONS",
  "category": "AUTHORIZATION",
  "context": {
    "requiredRole": "admin"
  }
}
```

### Handled Error Codes

| HTTP Status | Error Code | Category | Cause / Context |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | `VALIDATION` | Invalid query parameter (e.g. negative offset, invalid limit number). |
| `401 Unauthorized` | `UNAUTHENTICATED` | `AUTHENTICATION` | Missing or invalid authentication token. |
| `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` | `AUTHORIZATION` | Authenticated user is not an administrator (`role !== "admin"`). |


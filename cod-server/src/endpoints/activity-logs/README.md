# Activity Logs API

The audit trail system for the CRM. This API provides an immutable record of all significant actions performed by users across the system.

## Structure

```
activity-logs/
├── routes.ts       # Admin-only route definitions
├── handlers.ts     # HTTP request handlers (querying)
├── openapi.ts      # OpenAPI documentation paths
├── handlers.test.ts # Unit tests for logging and queries
└── README.md       # This file
```

## Core Concepts

The activity log is a **fire-and-forget** audit system. It records "who did what, to whom, and when." It is decoupled from the main business logic to ensure that a logging failure never blocks a user operation.

### Data Model
Each log entry contains:
- **Actor:** `actorId`, `actorName`, and `actorRole`.
- **Action:** A standardized dot-notation string (e.g., `order.created`).
- **Entity:** `entityType` (order, customer, etc.), `entityId`, and a human-readable `entityLabel`.
- **Metadata:** Optional JSON string for extra context (e.g., the new status in a status change).

## API Endpoints

**Access Control:** All activity log endpoints are **Admin-only**. Staff and other roles are blocked by middleware.

### GET /api/activity-logs
List all system activity with filtering and pagination.

**Query Parameters:**
- `actorId` - Filter logs by a specific user ID.
- `entityType` - Filter by entity (e.g., `order`, `customer`, `product`, `stock`, `user`).
- `limit` - Pagination limit (default: 50, max: 100).
- `offset` - Pagination offset (default: 0).

### GET /api/activity-logs/users/:userId
Get the activity history for a specific user. This is primarily used for the "Activity" tab in the team member profile sheet.

**Query Parameters:**
- `limit` - Pagination limit (default: 30, max: 100).
- `offset` - Pagination offset (default: 0).

## Implementation Details

### How Logging Works
Logging is handled by the `logActivity` helper (defined in `src/lib/activity.ts`). It is called at the end of successful handlers:

```typescript
await logActivity(db, actor, ACTIONS.ORDER_CREATED, {
  type: "order", 
  id: orderId, 
  label: orderNumber 
});
```

### Action Types
Actions are defined in the `ACTIONS` constant using the format `entity.action`:
- `order.created`, `order.status_changed`, `order.dispatched`
- `customer.created`, `customer.updated`, `customer.deleted`
- `stock.updated`, `stock.deducted`, `stock.restored`
- `user.created`, `user.login`, `user.deleted`

### Persistence
Logs are stored in the `activity_logs` table in the D1 database. They are ordered by `createdAt` descending (most recent first) and are intended to be read-only through the API.

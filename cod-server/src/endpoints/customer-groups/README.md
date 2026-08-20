# Customer Groups API

API for managing customer segments and membership. Groups allow you to categorize customers for specific workflows, such as "Wholesale", "VIP", or "Blacklisted".

## Structure

```
customer-groups/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
└── README.md       # This file
```

## API Endpoints

### GET /api/customer-groups
List all customer groups with optional search and pagination.

**Authorization:** Requires `customer_groups:read` scope

**Query Parameters:**
- `search` - Search groups by name
- `limit` - Pagination limit (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

### GET /api/customer-groups/:id
Get a single group's details.

**Authorization:** Requires `customer_groups:read` scope

**Query Parameters:**
- `members` - Set to `true` to include the `members` array containing summaries of all assigned customers.

### POST /api/customer-groups
Create a new customer group.

**Authorization:** Requires `customer_groups:manage` scope

**Request Body:**
```json
{
  "name": "Wholesale Customers",
  "description": "B2B customers with special pricing",
  "color": "#6366f1"
}
```

### PATCH /api/customer-groups/:id
Update group name, description, or color.

**Authorization:** Requires `customer_groups:manage` scope

### DELETE /api/customer-groups/:id
Permanently delete a group. This also removes all member associations, but does not affect the customer records themselves.

**Authorization:** Requires `customer_groups:manage` scope

### POST /api/customer-groups/:id/members
Add a customer to the group.

**Authorization:** Requires `customer_groups:manage` scope

**Request Body:**
```json
{
  "customerId": "uuid"
}
```

### DELETE /api/customer-groups/:id/members/:customerId
Remove a customer from the group.

**Authorization:** Requires `customer_groups:manage` scope

## Features & Implementation

- **Membership Tracking:** The `memberCount` is automatically updated on the group record whenever a customer is added or removed.
- **Idempotency:** Adding a customer who is already a member, or removing one who isn't, will succeed silently without errors.
- **Visual Categorization:** Supports custom hex colors (e.g., `#6366f1`) for better UI visualization.
- **Detailed Profiles:** Groups can have an optional `description` (up to 500 characters) to store internal policy or notes.
- **Audit Ready:** Memberships are tracked with an `assignedAt` timestamp.
- **Activity Logging:** All management actions (create, update, delete, add member, remove member) are logged in the activity system.

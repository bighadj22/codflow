# Customer Tags API

API for managing customer tags, allowing for granular segmentation and labeling of customers (e.g., "VIP", "Frequent Returner", "New Lead").

## Structure

```
customer-tags/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
└── README.md       # This file
```

## API Endpoints

### GET /api/customer-tags
List all customer tags with optional search and pagination.

**Authorization:** Requires `customer_tags:read` scope

**Query Parameters:**
- `search` - Search tags by name
- `limit` - Pagination limit (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

### GET /api/customer-tags/:id
Get a single tag's details.

**Authorization:** Requires `customer_tags:read` scope

**Query Parameters:**
- `customers` - Set to `true` to include the `customers` array containing summaries of all assigned customers.

### POST /api/customer-tags
Create a new tag.

**Authorization:** Requires `customer_tags:manage` scope

**Request Body:**
```json
{
  "name": "VIP",
  "color": "#FF5733"
}
```

### PATCH /api/customer-tags/:id
Update tag name or color.

**Authorization:** Requires `customer_tags:manage` scope

### DELETE /api/customer-tags/:id
Permanently delete a tag. This also removes all associations with customers, but does not affect the customer records themselves.

**Authorization:** Requires `customer_tags:manage` scope

### POST /api/customer-tags/:id/assignments
Assign the tag to a customer.

**Authorization:** Requires `customer_tags:manage` scope

**Request Body:**
```json
{
  "customerId": "uuid"
}
```

### DELETE /api/customer-tags/:id/assignments/:customerId
Remove the tag from a customer.

**Authorization:** Requires `customer_tags:manage` scope

## Features & Implementation

- **Assignment Tracking:** The `assignmentCount` is automatically updated on the tag record whenever a customer is assigned or unassigned.
- **Idempotency:** Assigning a tag to a customer who already has it, or unassigning it from one who doesn't, will succeed silently without errors.
- **Visual Labeling:** Supports custom hex colors (e.g., `#FF5733`) for better UI visualization.
- **Audit Ready:** Assignments are tracked with an `assignedAt` timestamp.
- **Activity Logging:** All management actions (create, update, delete, assign, unassign) are logged in the activity system.

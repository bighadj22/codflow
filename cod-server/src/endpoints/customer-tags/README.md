# Customer Tags API

API for managing customer tags, allowing for granular segmentation and labeling of customers (e.g., "VIP", "Frequent Returner", "New Lead").

## Structure

```
customer-tags/
├── routes.ts       # @hono/zod-openapi route definitions (validation + spec) with RBAC
├── handlers.ts     # HTTP request handlers (controller logic + audit logging)
├── queries.ts      # Re-exports shared queries from cod-shared/queries/customer-tags
├── validation.ts   # Zod validation schemas
├── ai-tools.ts     # AI/MCP tools for tag management
├── *.test.ts       # Unit & integration tests
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
Permanently delete a tag.

**Guard:** Blocked with `422 TAG_HAS_ASSIGNMENTS` (context includes `assignmentCount`) while any customer still carries the tag — unassign everyone first. Once deletable, the removal cascades to any remaining assignment rows; customer records themselves are never affected.

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

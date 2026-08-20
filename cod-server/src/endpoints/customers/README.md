# Customers Management API

Complete API for managing customer profiles, their contact information, purchase history, and segmentation via groups and tags.

## Structure

```
customers/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
├── customers.test.ts # Unit tests for validation and logic
└── README.md       # This file
```

## API Endpoints

### GET /api/customers
List all customers with optional filtering, segmentation, and pagination.

**Authorization:** Requires `customers:read` scope

**Query Parameters:**
- `wilayaId` - Filter by wilaya ID (1-58)
- `groupId` - Filter to customers in a specific group
- `tagId` - Filter to customers with a specific tag
- `search` - Search by customer name or phone
- `limit` - Pagination limit (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Ahmed Benali",
      "phone": "0555123456",
      "wilaya": "الجزائر",
      "totalOrders": 12,
      "totalSpent": 150000,
      "initials": "AB",
      "avatarColor": "#FF6B6B",
      "lastOrderAt": "2024-11-20T10:00:00Z"
    }
  ],
  "count": 10
}
```

### GET /api/customers/:id
Get a single customer's detailed profile and their 10 most recent orders.

**Authorization:** Requires `customers:read` scope

### GET /api/customers/:id/orders
Get the complete order history for a specific customer, including status history for each order.

**Authorization:** Requires `customers:read` scope

### GET /api/customers/:id/groups
List all segments/groups the customer belongs to.

**Authorization:** Requires `customer_groups:read` scope

### GET /api/customers/:id/tags
List all tags assigned to the customer.

**Authorization:** Requires `customer_tags:read` scope

### POST /api/customers
Register a new customer profile. 
- **Auto-generation:** Automatically generates `initials` and a unique `avatarColor` based on the name.
- **Reference Sync:** Automatically resolves `wilayaId` and `communeId` to their Arabic display names.

**Authorization:** Requires `customers:create` scope

**Request Body:**
```json
{
  "name": "Sarah Ahmed",
  "phone": "0770112233",
  "phone2": "0550112233",
  "wilayaId": 16,
  "communeId": "uuid",
  "address": "12 Rue Didouche Mourad",
  "profilePicUrl": "https://example.com/photo.jpg"
}
```

### PATCH /api/customers/:id
Update customer profile information. If `name` is changed, initials and avatar color are regenerated.

**Authorization:** Requires `customers:update` scope

### DELETE /api/customers/:id
Permanently remove a customer profile.

**Constraint:** Blocked (409 Conflict) if the customer has any existing orders. This protects the integrity of the order history.

**Authorization:** Requires `customers:delete` scope

## Features & Implementation

- **Initials & Avatars:** Enhances UI by automatically providing consistent initials and colors for customers without profile pictures.
- **Purchase Statistics:** Tracks `totalOrders`, `totalSpent`, and `lastOrderAt` automatically as orders are placed.
- **Segmentation:** Deep integration with `customer-groups` and `customer-tags` for targeted marketing and analysis.
- **Reference Table Integration:** Seamlessly maps IDs to Arabic display names for wilayas and communes using the central reference system.
- **RBAC:** Granular control over reading, creating, updating, and managing customer segments.

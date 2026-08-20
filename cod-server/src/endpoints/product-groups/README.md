# Product Groups API

Comprehensive API for managing the product category hierarchy and groups. Supports nested structures, positioning, and aggregated product counts.

## Structure

```
product-groups/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
├── product-groups.test.ts # Unit tests for validation and logic
└── README.md       # This file
```

## API Endpoints

### GET /api/product-groups
List all product categories with optional parent filtering.

**Authorization:** Requires `product_groups:read` scope

**Query Parameters:**
- `parentId` - Filter to sub-categories of a specific group.
- `search` - Search by group name.

**Response Includes:**
- `productsCount`: Total number of products currently assigned to this category.

### GET /api/product-groups/:id
Get detailed information about a product group.

**Authorization:** Requires `product_groups:read` scope

**Response Includes:**
- `children`: Array of all immediate sub-categories.
- `productsCount`: Total count of assigned products.

### POST /api/product-groups
Create a new product group. 
- **Auto-Slug:** If `slug` is omitted, a URL-safe lowercase slug is generated from the name + unique suffix.
- **Hierarchy:** Provide `parentId` to create a sub-category.

**Authorization:** Requires `product_groups:manage` scope

**Request Body:**
```json
{
  "name": "Summer Collection",
  "slug": "summer-2026",
  "description": "Seasonal highlights",
  "parentId": "uuid-optional",
  "imageUrl": "https://example.com/img.jpg",
  "position": 1
}
```

### PATCH /api/product-groups/:id
Update category information. Partial updates are supported.

**Authorization:** Requires `product_groups:manage` scope

### DELETE /api/product-groups/:id
Permanently delete a product group.

**Constraint:** Blocked (409 Conflict) if the group contains any products. These products must be reassigned or deleted first to ensure data consistency.

**Authorization:** Requires `product_groups:manage` scope

## Features & Implementation

- **Hierarchical Support:** Unlimited nesting depth via the `parentId` reference, allowing for deep category structures (e.g., Clothing > Men > T-Shirts).
- **Slug Management:** Automatically ensures lowercase, URL-safe slugs for clean storefront links.
- **Aggregated Analytics:** Provides real-time `productsCount` to the frontend for category list rendering.
- **Display Positioning:** The `position` field allows for custom ordering of categories in navigation menus.
- **RBAC:** Granular control over group reading (`product_groups:read`) and management (`product_groups:manage`).

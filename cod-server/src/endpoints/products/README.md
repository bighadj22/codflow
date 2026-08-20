# Products Management API

Complete API for managing the products catalog, variations, inventory, and media associations.

## Structure

```
products/
├── routes.ts       # Route definitions with RBAC protection
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
├── openapi.ts      # OpenAPI documentation paths
├── products.test.ts # Unit tests for validation and logic
└── README.md       # This file
```

## API Endpoints

### GET /api/products
List all products with comprehensive filtering, searching, and analytics (reviews/ratings).

**Authorization:** Requires `products:read` scope

**Query Parameters:**
- `categoryId` - Filter by product group/category ID
- `status` - Filter by lifecycle state (`DRAFT`, `ACTIVE`, `ARCHIVED`)
- `visibility` - Filter by store visibility (`true`, `false`)
- `search` - Search by name, handle, or description
- `limit` - Pagination limit (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**Response Includes:**
- `variantsCount`: Total number of variations.
- `totalInventory`: Sum of all variant stock (or base stock if no variants).
- `primaryImageSrc`: The first image in the position order.
- `reviewCount` & `avgRating`: Aggregated feedback metrics.

### GET /api/products/:id
Get a single product's full details, including its **Category**, **Variants**, and **Images**.

**Authorization:** Requires `products:read` scope

### POST /api/products
Create a new product. 
- **Auto-Handle:** If `handle` is omitted, a URL-safe slug is generated from the name + unique suffix.
- **Variant Blueprint:** Define `variantOptions` (e.g., Color, Size) here to prepare for variant creation.

**Authorization:** Requires `products:manage` scope

**Request Body (Partial):**
```json
{
  "name": "Samsung Galaxy A54",
  "price": 45000,
  "type": "PHYSICAL",
  "hasVariants": true,
  "variantOptions": [
    { 
      "name": "Color", 
      "values": [{ "value": "Red", "hexColor": "#FF0000" }] 
    }
  ],
  "status": "ACTIVE",
  "categoryId": "uuid"
}
```

### PATCH /api/products/:id
Update product information. Partial updates are supported.

**Authorization:** Requires `products:manage` scope

### PATCH /api/products/:id/status
Dedicated endpoint for updating a product's status (`DRAFT`, `ACTIVE`, `ARCHIVED`). 
- **Activation:** Setting status to `ACTIVE` automatically sets `publishedAt`.

**Authorization:** Requires `products:manage` scope

### DELETE /api/products/:id
Soft-delete a product. Sets `deletedAt`, excluding the product from all future listings while preserving order history integrity.

**Authorization:** Requires `products:manage` scope

---

## Sub-Resources

### Images (`/api/products/:id/images`)
- `GET`: List all images for a product ordered by position.
- `POST`: Associate an R2-uploaded image (`key`, `src`) with the product.
- `DELETE`: Remove an image record and its corresponding R2 object.

### Variants (`/api/products/:productId/variants`)
- `GET`: List all variants for a product.
- `POST`: Create a new variant based on the product's `variantOptions`.
- `PATCH`: Update variant-specific price, SKU, or inventory.
- `DELETE`: Remove a variant (blocked if linked to orders).

## Features & Implementation

- **Handle Management:** Ensures SEO-friendly, unique URL slugs for every product.
- **Hierarchical Inventory:** Automatically aggregates stock from variants to provide a high-level product inventory count.
- **Media Integration:** Tight coupling with Cloudflare R2 for reliable, edge-cached product imagery.
- **Review Aggregation:** Real-time calculation of average ratings and review counts for the product listing.
- **RBAC:** Granular control over catalog reading (`products:read`) and management (`products:manage`).

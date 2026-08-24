# Product Variants API

Sub-module for managing variations of a parent product. This API allows for the creation, update, and deletion of specific SKUs (e.g., "Red / Large") with independent pricing, inventory, and imagery.

## Structure

```
variants/
├── handlers.ts       # HTTP request handlers (list, get, create, update, delete)
├── queries.ts        # Re-exports shared queries from cod-shared/queries/variants
├── validation.ts     # Zod schemas for variant input
├── ai-tools.ts       # AI/MCP tools for variant management
├── *.test.ts         # Unit & integration tests
└── README.md         # This file
```

Routes are NOT defined here — variant endpoints are registered inside
`../products/routes.ts` under `/api/products/:productId/variants/*`, sharing that module's
RBAC and OpenAPI spec.

## Core Concepts

Product variants are linked to a parent `Product`. They allow for multi-attribute options (e.g., Color + Size).

### 1. Variations Data (`variations`)
Variations are stored as a JSON object of key-value pairs (e.g., `{ "Color": "Red", "Size": "XL" }`). These are **intended** to match the `variantOptions` declared on the parent product, but creation performs **no blueprint validation** — any key-value record is accepted as-is.

### 2. Independent SKU Attributes
Each variant can have its own:
- `price` and `compareAtPrice`.
- `sku` and `barcode`.
- `inventory` and `lowStockThreshold`.
- `imageId` (associates a specific product image with the variant).

## API Endpoints

### GET /api/products/:productId/variants
List all variants for a product.

**Authorization:** Requires `products:read` scope

### POST /api/products/:productId/variants
Create a new variant.

**Authorization:** Requires `products:manage` scope

**Request Body:**
```json
{
  "variations": { "Color": "Blue", "Size": "M" },
  "price": 1200,
  "sku": "SKU-B-M",
  "inventory": 50,
  "position": 1
}
```

### GET /api/products/:productId/variants/:variantId
Fetch a single variant by ID.

**Authorization:** Requires `products:read` scope

### PATCH /api/products/:productId/variants/:variantId
Update variant information. Partial updates are supported.

**Authorization:** Requires `products:manage` scope

### DELETE /api/products/:productId/variants/:variantId
Permanently delete a variant. NOT blocked by orders: referencing order lines keep their history with `variantId` set to null.

**Authorization:** Requires `products:manage` scope

## Implementation Details

- **Position Management:** Variants are returned in the order of their `position` field, allowing the merchant to control display sequence.
- **Default Variant:** A variant can be marked as `isDefault`; the storefront uses it to pick the initially-selected variant (falling back to the first variant when none is marked). Multiple variants may carry the flag — no exclusivity is enforced.
- **Order History Preservation:** Deleting a variant nulls `order_products.variantId` references before removing the row, so order history stays intact. (A legacy `VARIANT_HAS_ORDERS` guard remains in the handler but is unreachable with current query behavior.)
- **Inventory Sync:** When a variant is deleted, any inventory it held is lost. However, if inventory was being tracked at the variant level, the parent product's aggregated count will update accordingly in the storefront.
- **RBAC:** Closely linked with the `products` module; requires the same permissions (`products:read` / `products:manage`).

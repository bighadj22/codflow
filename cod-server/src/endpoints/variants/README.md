# Product Variants API

Sub-module for managing variations of a parent product. This API allows for the creation, update, and deletion of specific SKUs (e.g., "Red / Large") with independent pricing, inventory, and imagery.

## Structure

```
variants/
├── handlers.ts     # HTTP request handlers (list, get, create, update, delete)
├── queries.ts      # Database operations for variants and order checks
├── validation.ts   # Zod schemas for variant input
├── variants.test.ts # Unit tests for variant logic and validation
└── README.md       # This file
```

## Core Concepts

Product variants are linked to a parent `Product`. They allow for multi-attribute options (e.g., Color + Size).

### 1. Variations Data (`variations`)
Variations are stored as a JSON object of key-value pairs (e.g., `{ "Color": "Red", "Size": "XL" }`). These must correspond to the `variantOptions` defined on the parent product.

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

### PATCH /api/products/:productId/variants/:variantId
Update variant information. Partial updates are supported.

**Authorization:** Requires `products:manage` scope

### DELETE /api/products/:productId/variants/:variantId
Permanently delete a variant.

**Constraint:** Blocked (409 Conflict) if the variant is referenced by any existing orders. This prevents data inconsistency in order history.

**Authorization:** Requires `products:manage` scope

## Implementation Details

- **Position Management:** Variants are returned in the order of their `position` field, allowing the merchant to control display sequence.
- **Default Variant:** A variant can be marked as `isDefault`, which is used by the storefront for initial product selection.
- **Reference Guard:** The `deleteVariant` logic explicitly checks for links in the `order_products` table to ensure that active product history is never corrupted.
- **Inventory Sync:** When a variant is deleted, any inventory it held is lost. However, if inventory was being tracked at the variant level, the parent product's aggregated count will update accordingly in the storefront.
- **RBAC:** Closely linked with the `products` module; requires the same permissions (`products:read` / `products:manage`).

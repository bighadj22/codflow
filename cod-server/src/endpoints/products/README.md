# Products Management API

Complete API for managing the products catalog, variations, inventory, and media associations.

## Structure

```
products/
├── routes.ts       # @hono/zod-openapi route definitions (validation + spec) with RBAC — also mounts images & variants handlers
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Re-exports shared queries from cod-shared/queries/products
├── validation.ts   # Zod validation schemas
├── ai-tools.ts     # AI/MCP tools for product management
├── *.test.ts       # Unit & integration tests
└── README.md       # This file
```

## Description formats

`description` holds either literal text or sanitised HTML, and
`descriptionFormat` says which. Clients never infer it from the value.

| Field | Meaning |
|---|---|
| `description` | For `html`, sanitised rich text. For `text`, literal text. |
| `descriptionFormat` | `text` (the default, and every row that predates rich descriptions) or `html`. |
| `descriptionPlain` | Read-only. Tag-free rendering for `<meta>` and JSON-LD: tags stripped, images dropped, entities decoded, whitespace collapsed. Null when `description` is null. |

**Writing.** Send `description`, and `descriptionFormat: "html"` for rich text.
Sanitisation is server-side at the write chokepoint (`cod-shared/queries/products.ts`
→ `sanitizeRichText`) — the client is never trusted, and the MCP tools go through
the same path. A stored `html` value is sanitised **once**; reads return it
as-is and never re-sanitise it.

**Caps.** `description` is limited to 100,000 characters.

**Allow-list.** Unknown tags are unwrapped so their text survives;
`script`, `style`, `iframe`, `object`, `embed`, `svg`, `math` and `form` are
removed with their content. Every `on*`, `class`, `id` and `data-*` attribute
is dropped, with three deliberate exceptions the editor writes as attributes:
text alignment (an inline `text-align` on `p`/headings — the only `style` a
description may keep), the highlight colour (`mark` with a hex or `rgb()`
`background-color`), and checklists (`ul[data-type="taskList"]` /
`li[data-checked]`). Each is pinned to a fixed pattern or value set. The full
list is printed in `cod-astro/theme01/THEME_GUIDE.md` and a test compares it
against `RICH_TEXT_TAGS` in `cod-shared/lib/rich-text.ts`, so the docs cannot
drift.

**Switching a row from `text` to `html`.** Send `descriptionFormat: "html"`.
The stored `description` is re-sanitised even if the description itself did not
change — legacy text is never reinterpreted as markup. Switching back to `text`
changes only the interpretation: the stored bytes are kept and the markup is
then rendered literally, which is why the dashboard editor confirms before it
makes that change.

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
Soft-delete a product — blocked with `422 PRODUCT_HAS_ORDERS` if any order line references it. Otherwise sets `deletedAt`, excluding the product from all future listings.

**Authorization:** Requires `products:manage` scope

---

## Sub-Resources

### Images (`/api/products/:id/images`)
- `GET`: List all images for a product ordered by position.
- `POST`: Associate an R2-uploaded image (`key`, `src`) with the product.
- `PATCH /reorder`: Set display order — send the complete ordered array of image IDs.
- `DELETE /{imageId}`: Remove an image record and its corresponding R2 object.

### Variants (`/api/products/:productId/variants`)
- `GET`: List all variants for a product (position order).
- `GET /{variantId}`: Fetch a single variant.
- `POST`: Create a new variant based on the product's `variantOptions`.
- `PATCH`: Update variant-specific price, SKU, or inventory.
- `DELETE`: Permanently delete a variant. NOT blocked by orders — referencing order lines keep their history via a nullified `variantId`.

## Features & Implementation

- **Handle Management:** Ensures SEO-friendly, unique URL slugs for every product.
- **Hierarchical Inventory:** Automatically aggregates stock from variants to provide a high-level product inventory count.
- **Media Integration:** Tight coupling with Cloudflare R2 for reliable, edge-cached product imagery.
- **Review Aggregation:** Real-time calculation of average ratings and review counts for the product listing.
- **RBAC:** Granular control over catalog reading (`products:read`) and management (`products:manage`).

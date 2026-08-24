# Product Groups API

API for managing the product category/collection hierarchy. Supports nested
structures (via `parentId`), display ordering (via `position`), SEO metadata,
and aggregated active-product counts.

## Structure

```
product-groups/
├── routes.ts              # OpenAPIHono route definitions (validation + spec) with RBAC
├── handlers.ts            # HTTP request handlers (controller logic)
├── queries.ts             # Re-exports read/write functions from cod-shared
├── validation.ts          # Zod validation schemas (handler-level fallback)
├── ai-tools.ts            # AI SDK tools (getProductGroupTools)
├── product-groups.test.ts # Unit tests for validation and query logic
├── routes.test.ts         # Route-level integration tests (OpenAPIHono router)
├── handlers.test.ts       # Integration/error-scenario tests for handlers
└── README.md              # This file
```

`queries.ts` re-exports the actual implementations from
`cod-shared/queries/product-groups`, so both the API and `cod-client` consume
the same read functions directly from D1.

Routes are defined with `@hono/zod-openapi` (`createRoute`), making `routes.ts`
the single source of truth for request validation and the OpenAPI spec.
Handlers read pre-validated data via `(c.req as any).valid?.(...)` and fall
back to the Zod schemas in `validation.ts` when mounted standalone.

## API Endpoints

All routes are mounted under `/api/product-groups` and require an API key
(`ApiKeyAuth`). RBAC scopes are enforced per-route via `requireScope`.

### GET /api/product-groups

List all product groups with optional filtering.

- **Authorization:** `product_groups:read`
- **Query Parameters:**
  - `search` — Case-insensitive substring match on the group name.
  - `parentId` — Return only direct sub-categories of the given group id.
- **Ordering:** Results are ordered by the `position` field (ascending).
- **Response:**
  ```json
  { "success": true, "data": [ ... ], "count": <number of groups> }
  ```
  Each item in `data` includes `productsCount`: the number of **non-deleted**
  products assigned to that group (`products.deletedAt IS NULL`) — counted
  regardless of lifecycle status, so DRAFT and ARCHIVED products are included.

### GET /api/product-groups/:id

Get a single product group.

- **Authorization:** `product_groups:read`
- **Response:**
  ```json
  { "success": true, "data": { ... } }
  ```
  The `data` object includes:
  - `children`: Array of **immediate** sub-categories (rows whose `parentId`
    equals this id).
  - `productsCount`: Number of non-deleted products assigned (any lifecycle status).
- **Errors:**
  - `404` `PRODUCT_GROUP_NOT_FOUND` when no group exists with that id.

### POST /api/product-groups

Create a new product group.

- **Authorization:** `product_groups:manage`
- **Slug:** If `slug` is omitted, it is auto-generated from the `name`
  (lowercased, spaces/hyphens normalized, non-alphanumeric characters removed)
  plus a unique id suffix, e.g. `electronics-<id-prefix>`.
- **Hierarchy:** Provide `parentId` to create a sub-category; omit or set
  `null` for a top-level group.
- **Request Body:**
  ```json
  {
    "name": "Summer Collection",
    "slug": "summer-2026",
    "description": "Seasonal highlights",
    "parentId": "uuid-or-null",
    "imageUrl": "https://example.com/img.jpg",
    "metaTitle": "SEO title (max 60 chars)",
    "metaDescription": "SEO description (max 160 chars)",
    "metaKeywords": "comma, separated, keywords",
    "position": 1
  }
  ```
  Field rules (see `validation.ts`):
  - `name` — required, non-empty string.
  - `slug` — optional; must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase
    letters, numbers, hyphens).
  - `description` — optional, string or `null`.
  - `parentId` — optional, string or `null`.
  - `imageUrl` — optional, must be a valid URL or `null`.
  - `metaTitle` — optional, string ≤ 60 chars or `null`.
  - `metaDescription` — optional, string ≤ 160 chars or `null`.
  - `metaKeywords` — optional, string or `null`.
  - `position` — optional, integer ≥ 0; **defaults to `0`**.
- **Response:** `201`
  ```json
  { "success": true, "data": { ... } }
  ```

### PATCH /api/product-groups/:id

Partially update a product group. Only the fields you include are changed;
all fields are optional (same rules as POST, with `position` also optional).

- **Authorization:** `product_groups:manage`
- **Set `parentId` to `null`** to move a group to the top level.
- **Set any SEO field to `null`** to clear it.
- **Errors:**
  - `404` `PRODUCT_GROUP_NOT_FOUND` when no group exists with that id.

### DELETE /api/product-groups/:id

Permanently delete a product group.

- **Authorization:** `product_groups:manage`
- **Constraint:** Blocked with **`422`** (`PRODUCT_GROUP_HAS_PRODUCTS`) when the
  group's `productsCount` is greater than 0. Reassign or remove those products
  first to preserve data consistency.
- **Errors:**
  - `404` `PRODUCT_GROUP_NOT_FOUND` when no group exists with that id.
  - `422` `PRODUCT_GROUP_HAS_PRODUCTS` (with `context.groupId`,
    `context.groupName`, `context.productsCount`) when the group still has
    active products.

## Error Response Shape

Error responses consistently include `error` (message), `code` (error code), and
`category` (e.g. `BUSINESS_LOGIC`), and a `context` object where applicable.

## AI Tools

`ai-tools.ts` exports `getProductGroupTools(db)`, which returns an object of AI
SDK `tool(...)` definitions for product-group management. This lets an LLM
inspect and mutate the category tree through natural language.

**Two-layer validation pattern:** each tool uses a permissive
`z.object({}).passthrough()` input schema at the LLM layer (to avoid SDK
crashes on free-form input) and re-validates strictly inside `execute()` with
graceful, structured error messages.

The exposed tools are:

- **`listProductGroups`** — List groups (optionally filtered by `search` /
  `parentId`), ordered by `position`; returns each group's `productsCount`.
- **`getProductGroupDetails`** — Fetch one group by `groupId` (UUID), including
  its `children` and `productsCount`.
- **`createProductGroup`** — Create a group. `name` required; same optional
  fields as POST (`slug`, `description`, `parentId`, `imageUrl`, `position`,
  `metaTitle`, `metaDescription`, `metaKeywords`).
- **`updateProductGroup`** — Partial update by `groupId` (UUID) + `updates`
  object; `parentId: null` moves to top level, SEO fields `null` clear them.
- **`deleteProductGroup`** — Delete by `groupId` (UUID); fails if the group has
  active products (`PRODUCT_GROUP_HAS_PRODUCTS`).

## Features & Implementation

- **Hierarchical Support:** Unlimited nesting depth via the `parentId`
  reference (e.g. Clothing > Men > T-Shirts).
- **Slug Management:** Lowercase, URL-safe slugs; auto-generated from the name
  with a unique id suffix when omitted.
- **Aggregated Analytics:** `productsCount` counts **all non-deleted** products
  per group — including DRAFT and ARCHIVED — and is what the deletion guard checks.
- **Display Positioning:** The `position` field (integer ≥ 0, default 0)
  controls ordering in navigation and list responses.
- **SEO Metadata:** `metaTitle` (≤ 60), `metaDescription` (≤ 160), and
  `metaKeywords` per group.
- **RBAC:** Granular control over group reading (`product_groups:read`) and
  management (`product_groups:manage`).

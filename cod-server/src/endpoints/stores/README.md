# Stores Management API (Merchant)

Private management API for configuring store-wide settings, branding, localization, and Meta pixel tracking. This endpoint is used by the merchant/admin to control the look and feel of the storefront.

Not to be confused with `/api/store/*` — the public storefront API.

## Structure

```
stores/
├── routes.ts       # OpenAPIHono route definitions (validation + spec), admin-only
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Re-exports shared store queries
├── validation.ts   # Zod validation schemas (handler-level fallback)
├── stores.test.ts  # Unit tests for query logic and error classes
├── routes.test.ts  # Route-level integration tests (OpenAPIHono router)
└── README.md       # This file
```

Routes are defined with `@hono/zod-openapi` (`createRoute`), making `routes.ts`
the single source of truth for request validation and the OpenAPI spec.
Handlers read pre-validated data via `(c.req as any).valid?.(...)` and fall
back to the Zod schemas in `validation.ts` when mounted standalone.

## API Endpoints

### GET /api/stores/me
Retrieve the current store's configuration. In this single-tenant architecture, this returns the primary store record from the database.

**Authorization:** Admin role required (`requireAdmin()`)

**Response Includes:**
- **Branding:** `logoUrl`, `primaryColor`, `accentColor`, `bgColor`.
- **Theme:** `themeId` (active theme slug).
- **Typography:** `fontFamily`, `fontUrl`.
- **Localization:** `lang`, `currency`, `currencySymbol`.
- **Content:** `contentJson` (serialized storefront text strings).
- **SEO:** `metaTitle`, `metaDescription`, `ogImage`.
- **Settings:** `announcementBar`, `reviewsEnabled`, `status`.
- **Storefront key:** `storeApiKey` (plaintext; visible to the merchant in settings).

### PATCH /api/stores/me
Update store configuration. Partial updates are supported; set nullable fields to `null` to clear them.

**Authorization:** Admin role required (`requireAdmin()`)

**Request Body (Partial):**
```json
{
  "name": "My New Store Name",
  "primaryColor": "#3b82f6",
  "reviewsEnabled": true
}
```

Field rules: hex colors accept 3–8 characters (including alpha); `lang` is `"ar"` or `"en"`; URLs are validated; `metaTitle` ≤ 200, `metaDescription`/`announcementBar` ≤ 500 chars.

### GET /api/stores/pixel-config
Retrieve the store's Meta pixel tracking configuration, or `null` when none has been configured yet.

**Authorization:** Admin role required (`requireAdmin()`)

### POST /api/stores/pixel-config
Upsert the Meta pixel configuration used for server-side conversion events.

**Authorization:** Admin role required (`requireAdmin()`)

**Request Body:**
```json
{
  "pixelId": "1234567890123456",
  "accessToken": "EAAG...",
  "testEventCode": null,
  "enabled": true
}
```
Only `pixelId` is required. Omitted optional fields fall back to defaults (`accessToken` empty string, `enabled` true). `testEventCode` is for integration testing only — set to `null` in production.

## Implementation Details

- **Single-Tenant Guard:** The `queries.ts` is optimized to fetch the first and only store record in the D1 database, ensuring simplicity and performance for single-tenant deployments.
- **Visual Customization:** Supports full hex color validation (3-8 characters including alpha channel) to allow for advanced theme customization.
- **SEO Ready:** Provides fields for Open Graph images and Meta tags that are consumed directly by the public storefront SSR.

# Stores Management API (Merchant)

Private management API for configuring store-wide settings, branding, and localization. This endpoint is used by the merchant/admin to control the look and feel of the storefront.

## Structure

```
stores/
├── routes.ts       # Route definitions (GET /me, PATCH /me)
├── handlers.ts     # HTTP request handlers (controller logic)
├── queries.ts      # Database operations (Drizzle)
├── validation.ts   # Zod validation schemas
└── README.md       # This file
```

## API Endpoints

### GET /api/stores/me
Retrieve the current store's configuration. In this single-tenant architecture, this returns the primary store record from the database.

**Authorization:** Requires `stores:read` scope

**Response Includes:**
- **Branding:** `logoUrl`, `primaryColor`, `accentColor`, `bgColor`.
- **Typography:** `fontFamily`, `fontUrl`.
- **Localization:** `lang`, `currencySymbol`.
- **SEO:** `metaTitle`, `metaDescription`, `ogImage`.
- **Settings:** `announcementBar`, `reviewsEnabled`.

### PATCH /api/stores/me
Update store configuration. Partial updates are supported.

**Authorization:** Requires `stores:manage` scope

**Request Body (Partial):**
```json
{
  "name": "My New Store Name",
  "primaryColor": "#3b82f6",
  "reviewsEnabled": true
}
```

## Implementation Details

- **Single-Tenant Guard:** The `queries.ts` is optimized to fetch the first and only store record in the D1 database, ensuring simplicity and performance for single-tenant deployments.
- **Visual Customization:** Supports full hex color validation (3-8 characters including alpha channel) to allow for advanced theme customization.
- **SEO Ready:** Provides fields for Open Graph images and Meta tags that are consumed directly by the public storefront SSR.

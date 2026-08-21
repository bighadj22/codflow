# Shipping Profiles API

A robust configuration engine for managing multi-tier delivery pricing (Home & Stop-Desk) across Algeria's 58 wilayas.

## Structure

```
shipping-profiles/
├── routes.ts                # OpenAPIHono route definitions (validation + spec) with RBAC
├── handlers.ts              # Handlers for CRUD and bulk rule updates
├── queries.ts               # Re-exports shared queries; updateProfile/setProfileRules live here
├── validation.ts            # Zod schemas for profiles and rules (handler-level fallback)
├── ai-tools.ts              # AI SDK tools for shipping profile management
├── shipping-profiles.test.ts # Unit tests for validation and query logic
├── routes.test.ts           # Route-level integration tests (OpenAPIHono router)
├── handlers.test.ts         # Integration/error-scenario tests for handlers
└── README.md                # This file
```

Routes are defined with `@hono/zod-openapi` (`createRoute`), making `routes.ts`
the single source of truth for request validation and the OpenAPI spec.
Handlers read pre-validated data via `(c.req as any).valid?.(...)` and fall
back to the Zod schemas in `validation.ts` when mounted standalone.

`queries.ts` re-exports pure reads/writes from
`cod-shared/queries/shipping-profiles`; `updateProfile` and
`setProfileRules` stay in cod-server because they raise
`BusinessLogicError` / `ValidationError`.

## Core Concepts

The system uses **Shipping Profiles** as "rate cards." Each profile contains a set of rules that map a `wilayaId` to specific prices.

### 1. Default Profile
There is always one profile marked as `isDefault`. This profile is used by the storefront and dashboard order forms to automatically resolve delivery fees when a customer selects their location.

### 2. Multi-Tier Pricing
Each rule defines two prices per wilaya:
- **`homePrice`**: Door-to-door delivery fee.
- **`stopDeskPrice`**: Pickup fee at a carrier's station/office.

## API Endpoints

### GET /api/shipping-profiles
List all profiles. Each record includes `productCount` (how many products reference this profile as their override) and `ruleCount`.

### GET /api/shipping-profiles/:id
Retrieve a single profile with all of its wilaya rules (including `homeEnabled` / `stopDeskEnabled`).

### GET /api/shipping-profiles/default/rules
Returns the wilaya rules for the currently active default profile. Used by the order form to auto-fill delivery fees.

### POST /api/shipping-profiles
Create a profile. Setting `isDefault: true` atomically unsets the current default.

### PATCH /api/shipping-profiles/:id
Update name / notes / isDefault. The system always keeps exactly one default profile — setting `isDefault: false` on the **only** default is rejected with `DEFAULT_PROFILE_REQUIRED` (422).

### PUT /api/shipping-profiles/:id/rules
Bulk-replace all wilaya rules for a profile.
- **Request:** `{ "rules": [{ "wilayaId": 16, "homePrice": 400, "stopDeskPrice": 300, "homeEnabled": true, "stopDeskEnabled": true }, ...] }`
- **Dedup:** each `wilayaId` may appear at most once — duplicates are rejected with `DUPLICATE_WILAYA_RULE` (400).
- **Cascade:** existing rules are deleted first, which cascades to any commune overrides on those rules.

### GET /api/shipping-profiles/:id/rules/:wilayaId/communes
List every commune in a wilaya with its override status. Returns `hasOverride`, the raw override fields (null = inherited), and the effective values after inheritance.

### PUT /api/shipping-profiles/:id/rules/:wilayaId/communes/:communeId
Set or update a commune-level override. Any field left `null` inherits from the wilaya rule. If **all four** (`homeEnabled`, `stopDeskEnabled`, `homePrice`, `stopDeskPrice`) are `null`, the override row is deleted.

### DELETE /api/shipping-profiles/:id/rules/:wilayaId/communes/:communeId
Remove a commune override — reverts to the wilaya rule defaults. Returns 404 if no override exists.

### DELETE /api/shipping-profiles/:id
Delete a profile. Blocked (`PROFILE_IN_USE`, 422) when the profile is currently referenced by any product, or when it is the default profile (there must always be a default).

## Implementation Details

- **Product Link Only:** Profiles are referenced only by `products.shippingProfileId` (set-null on delete). Drivers and delivery companies do **not** link to shipping profiles — they have their own compensation tables.
- **Atomic Rule Replacement:** `setProfileRules` uses a delete-then-insert pattern. Commune overrides cascade automatically.
- **Reference Join:** Rules are joined with `wilayas` to provide French and Arabic names in responses.
- **Fee Resolution:** Order creation consults (1) product-level profile override, then (2) the default profile. Wilaya rule → commune override (inherit-on-null) → mode check → free-shipping offer. See `endpoints/orders/resolve-fee.ts`.
- **RBAC:** Requires `delivery:read` to view and `delivery:manage` to modify.

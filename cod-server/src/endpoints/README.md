# Endpoints Directory

Each subdirectory is one API domain. Migration status below tracks the
conversion from hand-written OpenAPI (`openapi.ts` + legacy generator) to
auto-generated specs via `@hono/zod-openapi`. Full details and per-endpoint
notes live in `cod-server/MIGRATION_STATUS.md`.

## Migrated to @hono/zod-openapi ✅

| Domain | Routes | Notes |
|---|---|---|
| `wilayas` | 2 | Pilot endpoint |
| `activity-logs` | 2 | Admin-only |
| `delivery-companies` | 13 | CRUD + stop-desks + webhook config |
| `reviews` | 3 | Moderation, RBAC |
| `customer-groups` | 7 | Segments + member management |
| `customer-tags` | 7 | Tags + assignment management |
| `product-groups` | 5 | Category tree CRUD; delete blocked with `422 PRODUCT_GROUP_HAS_PRODUCTS`; completed 2026-08-21 |
| `customers` | 8 | CRUD + orders/groups/tags lookups; granular scopes (`customers:read/create/update/delete`); completed 2026-08-21 |
| `shipping-profiles` | 10 | Rate cards + wilaya rules + commune overrides; delete guards (`PROFILE_IN_USE`, `DEFAULT_PROFILE_REQUIRED`); completed 2026-08-21 |
| `drivers` | 8 | Driver CRUD + status + per-wilaya compensations; delete guard (`409 DRIVER_HAS_ACTIVE_ORDERS`); completed 2026-08-21 |
| `users` | 8 | Team management + scopes + API-key rotation; admin-only (`requireAdmin`); one-time key reveals; completed 2026-08-21 |
| `stores` | 4 | Store settings + Meta pixel config; admin-only; completed 2026-08-21 |

## Pending migration (legacy openapi.ts present) ⏳

`products`,
`variants`, `stock`, `offers`, `images`, `driver-payments`, `orders`,
`abandoned-orders`, `webhooks`, `store`, `analytics`

Next up: **Products** (15 routes — CRUD + images + variants) — see `cod-server/NEXT_ENDPOINT.md`.

## Special

- `mcp` — MCP server surface, not part of the REST API migration.

## Progress

**12/23 endpoints migrated (~52%)** · ~4,445 legacy lines removed

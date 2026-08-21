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
| `products` | 15 | Product CRUD + nested images (R2 association, full-set reorder) + variants; `409 DUPLICATE_SKU`, `422 PRODUCT_HAS_ORDERS`; SKU required for simple products; completed 2026-08-21 |

| `driver-payments` | 3 | Payment create + history + pending settlement; `422 ORDER_NOT_FOUND` / `PAYMENT_ALREADY_SETTLED`; completed 2026-08-21 |
| `images` | 2+1 | Upload + presign generated (`products:manage`, multipart); public `/images/{key}` serve stays plain-Hono + legacy stub (regex param) — exception documented; completed 2026-08-21 |
| `orders` | 17 | Full COD lifecycle CRUD + driver/company dispatch (single+bulk) + shipment ops; transition guard (`INVALID_STATUS_TRANSITION`); 11-status enum now typed in cod-shared; completed 2026-08-21 |
| `webhooks` | 3 | Public receivers (Yalidine CRC/events, ZR Svix); no body validation — raw-byte signature contract documented; completed 2026-08-21 |
| `abandoned-orders` | 6 | Dashboard recovery CRUD/stats + storefront upsert/convert (StoreAuth); previously undocumented entirely — now fully specified; completed 2026-08-21 |
| `store` | 9 | Public storefront catalog/order/review surface behind X-Store-API-Key; list-vs-detail product shapes; completed 2026-08-21 |

## Pending migration (legacy openapi.ts present) ⏳

`analytics`

Next up: **Analytics** (last remaining domain) — see `cod-server/NEXT_ENDPOINT.md`.

## Special

- `mcp` — MCP server surface, not part of the REST API migration.

## Progress

**22/23 endpoints migrated (~96%)** · ~10,705 legacy lines removed

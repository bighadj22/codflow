# Endpoints Directory

Each subdirectory is one API domain. The standard pattern for all routes is
`defineRoute()` from `@/lib/route-builder`. Two endpoints have completed this
migration; the rest still use raw `createRoute()` from `@hono/zod-openapi` and
are pending conversion.

---

## Migration status

### Done — using `defineRoute()` ✅

| Domain | Routes |
|--------|--------|
| `wilayas` | 2 |
| `orders` | 17 |
| `products` | 15 |

### Pending — still using `createRoute()` ⏳

These endpoints are fully on `@hono/zod-openapi` (validation + spec generation
works), but have not been converted to `defineRoute()` yet. Convert one at a
time following `MIGRATION.md` in `.agents/skills/route-builder/`.

| Domain | Routes | Notes |
|--------|--------|-------|
| `abandoned-orders` | 6 | Dashboard CRUD/stats + storefront upsert/convert |
| `activity-logs` | 2 | Admin-only read |
| `analytics` | 1 | Dashboard status-count stats |
| `customer-groups` | 7 | Segments + member management |
| `customer-tags` | 7 | Tags + assignment management |
| `customers` | 8 | CRUD + orders/groups/tags lookups |
| `delivery-companies` | 13 | CRUD + stop-desks + webhook config |
| `driver-payments` | 3 | Payment create + history + pending settlement |
| `drivers` | 8 | Driver CRUD + status + per-wilaya compensations |
| `images` | 3 | Upload + presign + public serve (plain-Hono exception, see below) |
| `offers` | 5 | Promotional offer CRUD |
| `product-groups` | 5 | Category tree CRUD |
| `reviews` | 3 | Moderation + RBAC |
| `shipping-profiles` | 10 | Rate cards + wilaya rules + commune overrides |
| `stock` | 7 | Inventory adjustments, history, thresholds (two sub-routers) |
| `store` | 9 | Public storefront surface behind X-Store-API-Key |
| `stores` | 4 | Store settings + Meta pixel config |
| `users` | 8 | Team management + scopes + API-key rotation |
| `webhooks` | 3 | Public receivers — no body validation (raw-byte signature contract) |

---

## Special cases

- `variants/` — no `routes.ts`; handlers are mounted directly inside `products/routes.ts`.
- `mcp/` — MCP server surface, not part of the REST API.
- `images/{key}` public serve — stays plain-Hono (regex param); the `createRoute` documentation stub for it is intentional.

---

## Summary

**3 / 22 domains on `defineRoute()` (14%)**
19 domains still on `createRoute()` — fully functional, pending conversion.

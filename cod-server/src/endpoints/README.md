# Endpoints Directory

Each subdirectory is one API domain. The standard pattern for all routes is
`defineRoute()` from `@/lib/route-builder`. **All domains have completed this
migration** — raw `createRoute()` from `@hono/zod-openapi` is no longer used
anywhere. New endpoints must use `defineRoute()` (see
`.agents/skills/route-builder/NEW-ENDPOINTS.md`).

---

## All domains — on `defineRoute()` ✅

| Domain | Routes | Notes |
|--------|--------|-------|
| `abandoned-orders` | 6 | Dashboard CRUD/stats + storefront upsert/convert (`auth: "store"` on the storefront router) |
| `activity-logs` | 2 | Admin-only read; throw-based `adminOnly` middleware preserved for the documented `PERMISSION_DENIED` envelope |
| `analytics` | 1 | Dashboard status-count stats |
| `customer-groups` | 7 | Segments + member management |
| `customer-tags` | 7 | Tags + assignment management |
| `customers` | 8 | CRUD + orders/groups/tags lookups |
| `delivery-companies` | 13 | CRUD + stop-desks + webhook config; RBAC stays on router-level `use()` patterns (preserves existing gating) |
| `driver-payments` | 3 | Payment create + history + pending settlement |
| `drivers` | 8 | Driver CRUD + status + per-wilaya compensations |
| `images` | 3 | Upload (multipart via `bodyContent`) + presign + public serve (plain-Hono exception, see below) |
| `offers` | 5 | Promotional offer CRUD |
| `orders` | 17 | Full order lifecycle |
| `product-groups` | 5 | Category tree CRUD |
| `products` | 15 | Product + variant CRUD (variants nested, see below) |
| `reviews` | 3 | Moderation + RBAC |
| `shipping-profiles` | 10 | Rate cards + wilaya rules + commune overrides |
| `stock` | 7 | Inventory adjustments, history, thresholds (two sub-routers) |
| `store` | 9 | Public storefront surface behind X-Store-API-Key (`auth: "store"`) |
| `stores` | 4 | Store settings + Meta pixel config (`auth: "admin"`) |
| `users` | 8 | Team management + scopes + API-key rotation (`auth: "admin"`) |
| `webhooks` | 3 | Public receivers (`auth: "public"`) — no body validation (raw-byte signature contract) |
| `wilayas` | 2 | Read-only geography |

---

## Special cases

- `variants/` — no `routes.ts`; handlers are mounted directly inside `products/routes.ts`.
- `mcp/` — MCP server surface, not part of the REST API (plain Hono by design).
- `images/{key}` public serve — stays plain-Hono (regex param); the documentation stub for it is intentional.
- Router-level RBAC (not per-route `auth`): `activity-logs` (throw-based
  `adminOnly`) and `delivery-companies` (`use()` scope patterns) — both kept
  deliberately to preserve existing behavior; see each file's docblock.

---

## Summary

**22 / 22 domains on `defineRoute()` (100%)** — migration complete. Any new
endpoint starts on `defineRoute()` directly; there is no `createRoute()` path
left to convert.

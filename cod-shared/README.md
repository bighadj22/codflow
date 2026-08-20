# cod-shared

**The single source of truth shared by `cod-server` and `cod-client`.**

`cod-shared` holds everything the backend and dashboard must agree on:

- **The database schema** — every table, defined once.
- **Read/write queries** — the shared business-logic data access layer.
- **RBAC** — the canonical permission scope registry + check helpers.
- **Error codes** — one registry of error codes and categories for the whole API.

It is **TypeScript source, imported directly** — there is no build step and
nothing is published. Edit a file here and both apps see it on their next build.

---

## Table of contents

1. [Why a shared package?](#why-a-shared-package)
2. [Directory layout](#directory-layout)
3. [Database schema](#database-schema)
4. [Drizzle client](#drizzle-client)
5. [Queries (`queries/`)](#queries-queries)
6. [RBAC (`rbac/`)](#rbac-rbac)
7. [Error codes (`errors/`)](#error-codes-errors)
8. [How the apps consume it](#how-the-apps-consume-it)
9. [Migrations workflow](#migrations-workflow)
10. [Rules & conventions](#rules--conventions)

---

## Why a shared package?

Before `cod-shared` existed, the schema and logic lived in the server and the
dashboard maintained its own copies. That meant a column added in one place was
silently missing in the other. Today:

- `cod-server` and `cod-client` bind the **same D1 instance with the same
  table definitions** — they literally cannot drift.
- The dashboard reads D1 directly through the same query functions the backend
  uses, so behavior matches in both places.
- RBAC scopes and error codes have a single canonical definition.

---

## Directory layout

```
cod-shared/
├── db/
│   ├── schema.ts     # All 46 Drizzle table definitions (single source of truth)
│   └── client.ts     # getDb(d1) factory + AppDb type
├── queries/          # Dependency-injected data-access functions (one file per domain)
├── rbac/
│   ├── scopes.ts     # SCOPES registry, Scope type, SCOPE_CATEGORIES
│   └── utils.ts      # hasPermission / hasAnyPermission / hasAllPermissions
└── errors/
    └── codes.ts      # ERROR_CODES, ErrorCode type, ERROR_CATEGORIES
```

No runtime deps beyond `drizzle-orm`.

---

## Database schema

The canonical schema — **all table definitions, grouped by domain** (46 tables):

| Domain | Tables |
|--------|--------|
| **Auth (Better Auth)** | `users`, `userScopes`, `sessions`, `accounts`, `verifications` |
| **MCP / OAuth** | `jwkss`, `oauthClients`, `oauthRefreshTokens`, `oauthAccessTokens`, `oauthConsents` |
| **Customers** | `customers`, `customerGroups`, `customerGroupMembers`, `customerTags`, `customerTagAssignments` |
| **Geo (Algeria)** | `wilayas`, `communes` |
| **Shipping** | `shippingProfiles`, `shippingRules`, `shippingRuleCommunes` |
| **Delivery** | `drivers`, `driverCompensations`, `driverPayments`, `deliveryCompanies`, `companyStopDesks`, `companyShipments`, `companyApiLogs` |
| **Products** | `productCategories`, `products`, `productVariants`, `productImages`, `orderProducts` |
| **Orders** | `orders`, `orderAssignments`, `orderStatusHistory`, `abandonedOrders` |
| **Offers / Reviews** | `offers`, `reviews` |
| **Store** | `stores`, `storeApiKeys`, `dashboardBrand`, `storePixelConfig` |
| **Stock** | `stockMovements` |
| **Analytics / Audit** | `activityLogs`, `capiEventLog`, `webhookEvents` |

Both apps re-export the shared schema so feature code never imports raw
`cod-shared` paths:

```ts
// cod-server:  src/db/schema.ts  →  export * from "../../../cod-shared/db/schema";
// cod-client:  db/schema.ts      →  export * from "../../cod-shared/db/schema";

// in feature code, via the "@/" alias:
import { users } from "@/db/schema";
```

---

## Drizzle client

The Drizzle factory — it wires a Cloudflare `D1Database` to the shared schema:

```ts
import { getDb } from "cod-shared/db/client";

export function handle(request: Request, env: Env) {
  const db = getDb(env.DB);      // AppDb — a drizzle<D1Database, schema> instance
  // ...
}
```

- **`getDb(d1)`** — builds a typed Drizzle instance bound to the shared schema.
- **`AppDb`** — the type of that instance (`ReturnType<typeof getDb>`);
  **every shared query takes `db: AppDb`** as its first argument. This is the
  dependency-injection pattern: queries never read environment or globals, so
  they are trivially testable with any D1.

---

## Queries (`queries/`)

One file per domain, all following the same shape:

```ts
export async function listOrders(db: AppDb, filters: OrderFilters = {}) { … }
export async function getOrderById(db: AppDb, orderId: string) { … }
```

`cod-server` handlers and `cod-client` server actions **both** import these —
writes (create/update/status transitions) run in the server, and the dashboard's
reads call the same functions against the same D1 binding.

Available modules: `abandoned-orders`, `activity-logs`, `analytics`,
`customer-groups`, `customer-tags`, `customers`, `delivery-companies`,
`driver-payments`, `drivers`, `mcp-connections`, `offers`, `orders`,
`pixel-config`, `product-groups`, `products`, `reviews`, `shipping-profiles`,
`stock`, `store`, `stores`, `users`, `variants`, `webhooks`, `wilayas`.

> **If you touch a domain's reads, update the shared query — never write a
> local copy inside a package.** (The `cod-client` `check:reads` script
> enforces this.)

---

## RBAC (`rbac/`)

### `scopes.ts`

The **canonical scope registry**. Scopes follow `resource:action`
(e.g. `"orders:create"`, `"delivery:dispatch"`, `"*"` for admin):

- `SCOPES` — the frozen registry (const object).
- `Scope` — the type of any valid scope string.
- `ALL_SCOPES` — every scope except the `*` wildcard (used for assignable lists).
- `SCOPE_CATEGORIES` — scopes grouped for the dashboard's permissions UI.

### `utils.ts`

Framework-agnostic checks used on both sides of the boundary:

- `hasPermission(userScopes, requiredScope)` — wildcard-aware single check.
- `hasAnyPermission(userScopes, requiredScopes)` — at least one of a list.
- `hasAllPermissions(userScopes, requiredScopes)` — all of a list.

```ts
import { hasPermission } from "cod-shared/rbac/utils";
import { SCOPES } from "cod-shared/rbac/scopes";

if (!hasPermission(user.scopes, SCOPES.ORDERS_CREATE)) throw new PermissionError();
```

> Scopes are **not** enforced here — enforcement lives in the backend's
> RBAC middleware and the dashboard's `requirePermission`. `utils.ts` is the
> shared, pure logic.

---

## Error codes (`errors/`)

A single registry mapping the whole API surface to stable string codes:

- `ERROR_CODES` — every code, grouped by concern (`VALIDATION_FAILED`,
  `INVALID_STATUS_TRANSITION`, `SHIPMENT_CREATION_FAILED`, `INTERNAL_SERVER_ERROR`, …).
- `ErrorCode` — the union type.
- `ERROR_CATEGORIES` / `ErrorCategory` — `VALIDATION`, `AUTHENTICATION`,
  `BUSINESS_LOGIC`, `SYSTEM`.

The backend maps these onto HTTP responses via `cod-server/src/lib/errors`;
the dashboard maps them to UI messages. Keep new codes in sync in both places
— the registry is where they stay consistent.

---

## How the apps consume it

Everything is plain relative imports — no bundler trickery, no publish step:

- **`cod-server`** — `cod-shared/` is in the tsconfig `include`, and
  `src/db/index.ts` / `src/db/schema.ts` re-export the shared client/schema:
  ```ts
  // cod-server/src/db/index.ts
  export * from "../../../cod-shared/db/client";
  ```
- **`cod-client`** — the `cod-shared/*` path alias maps to `../cod-shared/*`,
  and `db/index.ts` / `db/schema.ts` re-export the same modules. Imports look like:
  ```ts
  import { SCOPES } from "@/../cod-shared/rbac/scopes";
  import { listAbandonedOrders } from "@/../cod-shared/queries/abandoned-orders";
  ```

Both apps also expose convenience aliases (`@/db`, `@/db/schema`) so feature
code rarely imports `cod-shared` paths directly.

---

## Migrations workflow

Migrations are generated and applied **from `cod-server` only** — the D1
binding in `cod-client` shares the same database but owns no migrations.

```bash
# 1. Edit the schema here:  cod-shared/db/schema.ts

# 2. Generate the migration from cod-server
cd cod-server && npm run db:generate

# 3. Apply locally (shared state: <repo-root>/.wrangler-shared)
npm run db:migrate:local

# 4. Production
npm run db:migrate:remote
```

See `cod-server/README.md` for the full database section.

---

## Rules & conventions

1. **One source of truth.** Schema, scopes, and shared queries live here — no
   local copies in `cod-server` or `cod-client`.
2. **No build step, no publishing.** Consume via relative imports; never add a
   bundler or make this an npm package.
3. **No environment access.** Queries receive `db` (and any config) as
   arguments; they must never read `env`, globals, or `fetch`.
4. **No external runtime deps** beyond `drizzle-orm`.
5. **Schema changes go through migrations.** Edit `schema.ts`, then generate +
   apply from `cod-server`.
6. **Every exported function is typed.** `AppDb` everywhere, explicit return
   types, no `any`.

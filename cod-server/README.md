# CodFlow Server

The backend engine for CodFlow — a COD-first e-commerce platform for Algeria
that is **agentic-ready**. It exposes the merchant REST API, the public
storefront API, delivery-carrier webhooks, and a complete **MCP remote server**
(RFC 9728) so AI agents can operate the store with RBAC-scoped tools. Built on
Cloudflare Workers, Hono, and Drizzle ORM, with Durable Objects and Cloudflare
Workflows under the hood.

This package is part of the [CodFlow monorepo](../README.md). The dashboard
(`cod-client`) and storefront (`cod-astro`) live in sibling folders and share
database schema + query logic via `cod-shared`.

## Tech Stack

- **Runtime:** Cloudflare Workers (Edge)
- **Framework:** Hono
- **Database:** Cloudflare D1 (SQLite) via Drizzle ORM
- **Validation:** Zod
- **Language:** TypeScript

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- A Cloudflare account with the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)

### 1. Install

```bash
npm install
```

### 2. Configure

All configuration lives in two files. **Nothing is hardcoded** — every URL,
database, and bucket is a placeholder you replace with your own resources.

1. **`wrangler.toml`** — non-secret config (D1 database, R2 bucket, public URLs).
   Create your resources and paste the values in:

   ```bash
   wrangler login
   wrangler d1 create codflow-db            # → copy the returned database_id into wrangler.toml
   wrangler r2 bucket create codflow-images # → match bucket_name in wrangler.toml
   ```

2. **`.dev.vars`** — local secrets (gitignored):

   ```bash
   cp .dev.vars.example .dev.vars
   ```

### 3. Create the database schema

```bash
# Apply migrations + seed demo store data (categories, products, variants, images)
npm run db:setup:local
```

The seed script also works standalone with `npm run db:seed:local`. It seeds a
demo store whose API key is taken from `$STORE_API_KEY`, then
`cod-astro/theme01/.dev.vars`, then a built-in dev default.

> **First dashboard login:** better-auth lets you sign up in the dashboard, but
> the first account defaults to role `staff`. To make yourself admin:
> ```bash
> wrangler d1 execute codflow-db --local --command "UPDATE users SET role='admin' WHERE email='you@example.com';"
> ```

### 4. Run locally

```bash
npm run dev
# Server → http://localhost:8787
# OpenAPI spec → http://localhost:8787/api/openapi.json
```

Local D1 state is shared with `cod-client` through `<repo-root>/.wrangler-shared`,
so dashboard and server read the same SQLite file during development.

### 5. Test

```bash
npm test          # full suite (Vitest)
npm run build:ci  # type-checks + dry-run wrangler bundle
```

### 6. Deploy

```bash
npm run deploy                 # default environment
npm run deploy -- --env production   # after editing [env.production] in wrangler.toml
```

R2 credentials (`CF_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`)
must be set as secrets in production, not in `wrangler.toml`:

```bash
wrangler secret put CF_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

## Environment Variables

### Non-secret (`wrangler.toml` `[vars]`)

| Variable | Purpose | Local default |
|----------|---------|---------------|
| `ENVIRONMENT` | `development` \| `production` | `development` |
| `WORKER_URL` | Public URL of this Worker (used in OpenAPI docs) | `http://localhost:8787` |
| `MEDIA_DOMAIN` | Domain fronting the R2 bucket (public image URLs) | `media.example.com` |
| `R2_BUCKET_NAME` | R2 bucket name | `codflow-images` |
| `BETTER_AUTH_URL` | Dashboard Worker's Better Auth origin — `iss` + JWKS source for MCP tokens | `http://localhost:3000/api/auth` |
| `WORKER_SELF_URL` | This Worker's own origin — required `aud` claim for MCP tokens | `http://localhost:8787/` |

### Secrets (`.dev.vars` locally / `wrangler secret put` in prod)

| Variable | Purpose |
|----------|---------|
| `STORE_API_KEY` | Shared secret the storefront sends as `X-Store-API-Key` (SHA-256 hashed at rest) |
| `CF_ACCOUNT_ID` | Cloudflare account id — builds the R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | R2 API token access key (presigned image uploads) |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |

## Project Structure

```
cod-server/
├── src/
│   ├── index.ts               # Hono app entry — wires routes, MCP server, CAPI workflow, cron
│   ├── types/                 # Env bindings (mirrors wrangler.toml), app context types
│   ├── db/                    # D1 + Drizzle helpers (schema re-export, migrate, migrations/)
│   ├── middleware/            # better-auth session/bearer auth, store API key, CORS, error handling
│   ├── endpoints/             # One folder per domain (see route list below)
│   ├── lib/                   # Meta CAPI client, activity log, shared errors
│   ├── mcp/                   # MCP remote server (Durable Object agent + scope-gated tool registry)
│   ├── workflows/             # Durable Cloudflare Workflows (CodCapiWorkflow)
│   ├── cron/                  # Scheduled handlers (abandoned-order sweep)
│   ├── openapi/               # OpenAPI spec generation (served at /api/openapi.json)
│   ├── rbac/                  # Scope-based authorization middleware
│   └── test-utils/            # Shared test helpers
├── scripts/                   # dev utilities (seed, R2 CORS, migration validation)
├── wrangler.toml              # Worker config — all values are placeholders
├── drizzle.config.ts
└── vitest.config.ts
```

## API Overview

REST API is mounted under `/api/*` and documented by the OpenAPI JSON spec at
`/api/openapi.json` (no Swagger UI is served). Public routes: `/`, `/health`,
`/images`, `/api` (OpenAPI spec), `/webhooks/*` (delivery-carrier callbacks),
`/store/*` (storefront read + order placement), `/.well-known/*`, and `/mcp`
(MCP protocol). All other `/api/*` routes require a session or bearer token.

- `/api/orders` — orders, status lifecycle, driver assignment, stats
- `/api/customers`, `/api/customer-groups`, `/api/customer-tags`
- `/api/drivers`, `/api/driver-payments`
- `/api/products`, `/api/product-groups`, `/api/products/:id/variants` (variants are nested, not a top-level route), `/api/stock`, `/api/offers`, `/api/reviews`
- `/api/wilayas`, `/api/shipping-profiles`
- `/api/delivery-companies` — carrier adapters (Yalidine, ZR Express, NOEST, EcoTrack) + webhook handlers
- `/api/stores` — `me`, `pixel-config` (the public storefront API lives at `/store/*`)
- `/api/users` — staff/admin + API keys
- `/api/analytics`, `/api/activity-logs`, `/api/abandoned-orders`
- `/api/images` — R2 presigned upload
- `/api/mcp` — MCP agent connection management (`/me`, `/team`; the `/mcp` endpoint itself serves the MCP protocol)

## Notable Subsystems

### MCP remote server
`src/mcp/` implements an MCP (Model Context Protocol) server so AI agents can
manage the store. Access tokens are **verified offline**: `iss`/`aud`/`exp`
claims are checked against `BETTER_AUTH_URL`'s published JWKS — no per-request
round trip to the dashboard. The 14 tool factories are gated by RBAC scopes.

### Meta CAPI workflow
`src/workflows/` (CodCapiWorkflow) fires Meta Conversions API `Purchase` events
when an order reaches `delivered` — or `out_for_delivery` for long-haul southern
wilayas (5–10 day delivery). Decoupled from the order status handler — an
analytics failure can never affect order state. Disabled for stores without an
enabled `storePixelConfig` (or a missing `accessToken`).

### Abandoned orders
An hourly cron sweeps pending orders older than 30 minutes to `abandoned`.

## Contributing

- One endpoint = one folder in `src/endpoints/`, following the
  `routes.ts` / `handlers.ts` / `validation.ts` / `openapi.ts` split.
- Shared schema and read queries live in `cod-shared` — do not duplicate them
  in `cod-server/src/db`.
- Keep `wrangler.toml` free of real credentials; if you add an env var, declare
  it in `src/types/env.ts`, `wrangler.toml`, and this README.
- Run `npm test` and `npm run build:ci` before opening a PR.

## License

Open source. See the [repository root](../README.md) for the license.
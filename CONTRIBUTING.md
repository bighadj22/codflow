# Contributing to CodFlow

Thanks for wanting to help! CodFlow is a COD-first e-commerce platform for the
Algerian market, built as a monorepo of four packages running on Cloudflare.

---

## Table of contents

1. [Repository layout](#repository-layout)
2. [First-time setup](#first-time-setup)
3. [Local development](#local-development)
4. [Configuration](#configuration)
5. [Architecture & code conventions](#architecture--code-conventions)
6. [Testing](#testing)
7. [Commit & PR guidelines](#commit--pr-guidelines)
8. [Hard rules](#hard-rules)
9. [Getting help](#getting-help)

---

## Repository layout

```
codflow-os/
├── cod-server/   # Backend API  — Cloudflare Worker (Hono + D1 + R2)
├── cod-client/   # Merchant dashboard — Next.js 15 + OpenNext on Cloudflare
├── cod-astro/    # Customer storefront — Astro, trilingual (AR/FR/EN)
│   └── theme01/  #   the default theme (theme layer is swappable)
└── cod-shared/   # Source-shared TS — D1 schema, RBAC scopes, read queries
```

There is **no root package.json / workspace**. Each package installs and runs
its own npm scripts. `cod-shared` is consumed directly from source via relative
imports (`../../cod-shared/...`) — it has no build step.

### Package scripts

| Package            | Install | Dev          | Test        | Build       |
|--------------------|---------|--------------|-------------|-------------|
| `cod-server`       | `npm i` | `npm run dev`| `npm test`  | `npm run build:ci` |
| `cod-client`       | `npm i` | `npm run dev`| `npm test`  | `npm run build` |
| `cod-astro/theme01`| `npm i` | `npm run dev`| `npm test`  | `npm run build` |

---

## First-time setup

### Prerequisites

- **Node.js 20+** and npm
- The [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)
- A Cloudflare account (D1 + R2 are free-tier friendly)

### 1. Install

```bash
cd cod-server        && npm install
cd ../cod-client     && npm install
cd ../cod-astro/theme01 && npm install
```

### 2. Create Cloudflare resources

```bash
wrangler login
wrangler d1 create codflow-db
wrangler r2 bucket create codflow-images
wrangler kv namespace create RATE_LIMIT_KV   # only needed for cod-client
```

### 3. Configure

Every package ships a **`wrangler.toml` with placeholder values** and a
**`.dev.vars.example`**. Copy the example files and paste your own resource IDs:

```bash
# backend
cd cod-server
cp .dev.vars.example .dev.vars
# paste your database_id / bucket_name into wrangler.toml

# dashboard
cd ../cod-client
cp .dev.vars.example .dev.vars
# paste database_id + kv id into wrangler.toml
# generate a secret: openssl rand -base64 32  →  BETTER_AUTH_SECRET

# storefront
cd ../cod-astro/theme01
cp .dev.vars.example .dev.vars
```

`STORE_API_KEY` in the storefront's `.dev.vars` must match the key the backend
seeds. The defaults (`codflow-dev-store-key`) already line up.

### 4. Create the database + seed

```bash
cd cod-server
npm run db:setup:local      # migrate + seed demo store (products, categories…)
```

### 5. Create an admin account

```bash
cd cod-client
ADMIN_EMAIL=you@example.com ADMIN_NAME=You node scripts/seed-admin.mjs
```

The script prints a generated password + API key. Without this you cannot sign
into the dashboard (the first sign-up would default to `staff`).

---

## Local development

Open **four terminals**, one per package (D1 state is shared through
`<repo-root>/.wrangler-shared` so they read the same local database):

| # | Command               | What runs                                 |
|---|-----------------------|-------------------------------------------|
| 1 | `cd cod-server && npm run dev`          | API on `http://localhost:8787` (+ OpenAPI at `/api`) |
| 2 | `cd cod-client && npm run dev`          | Dashboard on `http://localhost:3000` (auth) / `8788` (worker) |
| 3 | `cd cod-astro/theme01 && npm run dev`   | Storefront on `http://localhost:4321`     |
| 4 | *(optional)* `wrangler d1 execute codflow-db --local --command "…"` | Inspect the shared DB |

---

## Configuration

**There is no hardcoded configuration.** URLs, domains, database IDs, and bucket
names are placeholders in each `wrangler.toml`; secrets go in gitignored
`.dev.vars` files or `wrangler secret put` in production.

| Variable | Owner | Purpose |
|----------|-------|---------|
| `WORKER_URL`, `MEDIA_DOMAIN`, `R2_BUCKET_NAME`, `BETTER_AUTH_URL`, `WORKER_SELF_URL` | `cod-server` | public URLs + R2 (see `src/types/env.ts`) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WORKER_URL` | `cod-client` | dashboard origin + API origin (auth base URL, MCP audience, email sender domain) |
| `COD_SERVER_URL`, `STORE_API_KEY`, `MEDIA_DOMAIN` | `cod-astro/theme01` | backend base URL + store key + media CDN |
| `BETTER_AUTH_SECRET`, R2 creds, `CF_ACCOUNT_ID` | all | secrets — never in `wrangler.toml` |

---

## Architecture & code conventions

### The `cod-shared` boundary

- **D1 schema** lives in `cod-shared/db/schema.ts` — one source of truth.
- **Read queries** live in `cod-shared/queries/*.ts`. Both `cod-server` handlers
  and `cod-client` server actions import from there.
- **RBAC scopes** live in `cod-shared/rbac/scopes.ts`.

> Do **not** duplicate schema or query logic inside a package. If you touch a
> domain's reads, update the shared query, not a local copy.

### Backend endpoints (`cod-server`)

One folder per domain under `src/endpoints/`:

```
orders/
├── routes.ts       # Hono route wiring
├── handlers.ts     # request handling + errors (BusinessLogicError, NotFoundError, …)
├── validation.ts   # Zod schemas
├── openapi.ts      # OpenAPI spec for the route
└── queries.ts      # THIN re-export of the shared query module
```

- Mount routes in `src/index.ts`.
- New env vars must be declared in **three** places: `src/types/env.ts`,
  `wrangler.toml`, and this guide / the `cod-server/README.md`.

### Dashboard reads vs writes (`cod-client`)

- **Reads** → server actions read D1 directly via `cod-shared/queries/*` (after `requirePermission`).
- **Writes** → always go through the cod-server REST API via `apiClient`.
- Only `fetchCompanyStopDesks`, `getShipmentTracking`, `getPixelConfig` may
  call the API directly via `apiClient.get`. Don't add new direct `apiClient.get`
  calls to `actions/*.ts` outside those. (Enforced by `npm run check:reads`.)

### Storefront (`cod-astro/theme01`)

- `src/core/` is the **core engine** — "DO NOT MODIFY". All HTTP calls go
  through `src/core/api/client.ts`.
- `src/theme/` is the swappable **theme layer** (layout, colors, copy). A new
  theme = a new folder, not edits to the core.
- All user-facing text needs AR/FR/EN translations.
- Keep RTL support working.

### Naming

- New identifiers and variables: `camelCase`. Components: `PascalCase`.
- DB columns: `snake_case`.
- Commit messages: **Conventional Commits** — `feat(orders): …`, `fix(validation): …`,
  `ui(products): …`, `docs(openapi): …`, `chore(…): …`.

---

## Testing

Run the full suite of a package before pushing:

```bash
cd cod-server        && npm test       # ~700 tests
cd cod-client        && npm test       # ~140 tests
cd cod-astro/theme01 && npm test       # property + behavior tests
```

- New endpoints must ship with tests (`handlers.test.ts`, `validation.test.ts`).
- Property tests for the storefront scripts use `fast-check`.
- If a test is genuinely obsolete (e.g. it documents a bug in a feature that was
  removed), **delete it** — never leave an intentionally failing test in the tree.

---

## Commit & PR guidelines

1. Keep changes scoped to one package or concern. If a change spans packages,
   explain the dependency in the PR description.
2. Conventional Commits (see above). Reference the scope (e.g. `orders`, `mcp`,
   `capi`, `customers`) when it helps.
3. Never commit:
   - `.dev.vars`, `.env.local`, or any real secret / API key
   - real personal data (emails, names, phone numbers) in fixtures or docs
   - hardcoded production URLs or domain names — use placeholders + env vars
4. Run `npm test` and the package build before opening the PR.
5. For UI changes, check mobile + desktop and RTL.

---

## Hard rules

1. **No secrets in `wrangler.toml`** — they go in `.dev.vars` (local) or
   `wrangler secret put` (prod).
2. **No hardcoded URLs/domains** in source or config. Everything must be swappable
   so a fresh clone can run against its own Cloudflare account.
3. **A CAPI failure can never affect order state.** Analytics stays decoupled
   from business logic.

---

## Getting help

- Start a discussion / open an issue on the repository.
- Read the per-package READMEs: `cod-server/README.md`, `cod-client/README.md`,
  `cod-astro/theme01/THEME_GUIDE.md`, and the endpoint docs under
  `cod-server/src/endpoints/*/README.md`.

Happy shipping! 🚚
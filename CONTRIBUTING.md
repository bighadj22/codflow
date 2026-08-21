# Contributing to CodFlow

Thanks for wanting to help! CodFlow is a COD-first e-commerce platform for the
Algerian market, built as a monorepo of four packages running on Cloudflare.

---

## Table of contents

1. [Repository layout](#repository-layout)
2. [Where do I start? (first contribution)](#where-do-i-start-first-contribution)
3. [First-time setup](#first-time-setup)
4. [Local development](#local-development)
5. [Configuration](#configuration)
6. [Architecture & code conventions](#architecture--code-conventions)
7. [Testing](#testing)
8. [Commit & PR guidelines](#commit--pr-guidelines)
9. [Hard rules](#hard-rules)
10. [Getting help](#getting-help)

---

## Repository layout

```
codflow-os/
├── cod-server/   # Backend API  — Cloudflare Worker (Hono + D1 + R2)
├── cod-client/   # Merchant dashboard — Next.js 16 + OpenNext on Cloudflare
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

## Where do I start? (first contribution)

New here? Here's the shortest path to a merged change:

1. **Find an issue.** Look for issues labeled `good first issue`. They are
   scoped so a first-time contributor can finish them in one sitting.
2. **Pick your package.** Each package is self-contained (see the layout above).
   The `Area` dropdown in the issue tells you which one a task touches.
3. **Set up once.** Complete the [First-time setup](#first-time-setup) section —
   it takes about 10 minutes and applies to every later contribution.
4. **Make a small change.** Keep it under ~500 lines. Follow the conventions in
   [Architecture & code conventions](#architecture--code-conventions) — if the
   task touches `cod-shared`, read that boundary first.
5. **Verify before pushing.** Run `npm run typecheck` and `npm test` in the
   package you changed (theme01: `npx astro check` + `npm test`). CI runs the
   same checks.
6. **Open a PR** using the PR template. Mention the issue with "Closes #N".
7. **Review happens on the PR.** Keep it small, respond to feedback, and CI must
   be green.

> Tips:
> - `cod-astro/theme01` is the most self-contained package — a good place to
>   start if you are new to the platform.
> - The storefront's `src/core/` is **off-limits** (platform-owned engine). New
>   storefront work goes in `src/theme/`.
> - Never put a real secret in your PR — secrets live in `.dev.vars` and
>   `wrangler secret put`, never in a wrangler config file or source.

## First-time setup

### Prerequisites

- **Node.js 22.12+** and npm
- The [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)
- A Cloudflare account (D1 + R2 are free-tier friendly)

> The repo's `.nvmrc` pins Node 24; CI runs Node 24. Astro 7 (the storefront)
> requires Node 22.12+.

### ⚡ Fast Track: Automated Setup (AI Agents & Contributors)

You can bootstrap the entire local environment in **one command**:

```bash
# Automated setup (installs deps in order, generates .dev.vars, migrates D1, seeds store & admin)
node .agents/skills/codflow-setup/scripts/setup-local.mjs
```

> 🤖 **Working with an AI Coding Assistant?** CodFlow includes an autonomous setup skill. Instruct your agent: *"Set up CodFlow locally"* and it will follow the [`codflow-setup` runbook](./.agents/skills/codflow-setup/SKILL.md).

---

### Manual Setup Step-by-Step

#### 1. Install Dependencies (in order)

`cod-shared` MUST be installed first because other packages resolve its dependencies:

```bash
cd cod-shared        && npm install
cd ../cod-server     && npm install
cd ../cod-client     && npm install
cd ../cod-astro/theme01 && npm install
cd ../..
```

### 2. Create Cloudflare resources

```bash
wrangler login
wrangler d1 create codflow-db
wrangler r2 bucket create codflow-images
wrangler kv namespace create RATE_LIMIT_KV   # only needed for cod-client
```

### 3. Configure

Every package ships a Cloudflare config with placeholder values
(`wrangler.toml` in cod-server/cod-client, `wrangler.jsonc` in
cod-astro/theme01) and a **`.dev.vars.example`**. Copy the example files and
paste your own resource IDs:

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
names are placeholders in each package's Cloudflare config (`wrangler.toml` in
cod-server/cod-client, `wrangler.jsonc` in cod-astro/theme01); secrets go in
gitignored `.dev.vars` files or `wrangler secret put` in production.

| Variable | Owner | Purpose |
|----------|-------|---------|
| `WORKER_URL`, `MEDIA_DOMAIN`, `R2_BUCKET_NAME`, `BETTER_AUTH_URL`, `WORKER_SELF_URL` | `cod-server` | public URLs + R2 (see `src/types/env.ts`) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WORKER_URL` | `cod-client` | dashboard origin + API origin (auth base URL, MCP audience, email sender domain) |
| `COD_SERVER_URL`, `STORE_API_KEY`, `MEDIA_DOMAIN` | `cod-astro/theme01` | backend base URL + store key + media CDN |
| `BETTER_AUTH_SECRET`, R2 creds, `CF_ACCOUNT_ID` | all | secrets — never in a wrangler config file |

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
cd cod-server        && npm test       # 698 tests
cd cod-client        && npm test       # 141 tests
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

1. **No secrets in a wrangler config file** — they go in `.dev.vars` (local) or
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
- Coding agents should read the repo instructions: `AGENTS.md` (root) and
  `cod-astro/theme01/AGENTS.md` (storefront).

Happy shipping! 🚚
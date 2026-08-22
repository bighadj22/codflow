---
name: codflow-setup
description: >-
  Setup runbook for CodFlow — an AI agent following it authenticates with Cloudflare,
  creates the required resources (D1, R2, KV) in the developer's account, binds their real
  IDs into both wrangler.toml files, configures secrets, applies migrations and seeds demo
  data against the remote D1 database, then verifies the deployment. Use when a developer
  wants to set up CodFlow (development or production), bind Cloudflare resources, run
  migrations, seed sample data, create an admin user, or deploy to Cloudflare Workers.
---

# CodFlow Setup — Agent Runbook

CodFlow is a cash-on-delivery (COD) e-commerce platform built on Cloudflare
Workers, Next.js 16, Astro 7, and D1 SQLite. This runbook takes a fresh clone
to a fully working, verified deployment.

Every setup **creates real Cloudflare resources** in the developer's account,
**binds their real IDs** into the wrangler.toml files, and **migrates and seeds
that same database**. There is exactly one path — follow it in order and do not
skip a gate.

## Before Starting — State This Contract

State this to the developer before running anything:

> *"This setup will create D1 `<project>-db`, R2 bucket `<project>-images`, and
> a KV namespace for rate limiting in your Cloudflare account `<account>`, bind
> their real IDs into both `wrangler.toml` files, and migrate + seed the D1
> database in your account. Nothing is left on placeholder values."*

Both `cod-server/wrangler.toml` and `cod-client/wrangler.toml` ship with
all-zero placeholder resource IDs. After Step 3 of this runbook, **no
placeholder may remain anywhere in either file** — deploys fail or silently
break with placeholders.

## Prerequisites

- Node.js ≥ 22.12 and npm.
- Cloudflare authentication:
  ```bash
  npx wrangler whoami    # if not logged in: npx wrangler login (browser OAuth)
  ```
- R2 must be enabled on the account (requires a payment card on file, free
  tier): confirm dash.cloudflare.com → R2 shows enabled before creating buckets.
- Ports 3000 / 4321 / 8787 free if services will run locally:
  ```bash
  lsof -nP -iTCP:3000 -iTCP:4321 -iTCP:8787 -sTCP:LISTEN   # expect no output
  ```

If `whoami` lists multiple accounts, ask the developer which one to use and
record that `account_id`.

**Account-ID env gotcha:** if the shell exports `CLOUDFLARE_ACCOUNT_ID` for an
account the OAuth token cannot access, every wrangler API call fails with
`Authentication error [code: 10000]`. Run wrangler as
`env -u CLOUDFLARE_ACCOUNT_ID npx wrangler …` (or unset the variable) so it
targets the logged-in account.

---

## Step 1 — Install Dependencies (one command)

CodFlow is an **npm workspace monorepo**: one root `package.json`, one root
`package-lock.json`. Never create per-package lockfiles — OpenNext detects the
monorepo by walking up for the nearest lockfile, and a nested one breaks every
cod-client deploy (`ENOENT pages-manifest.json`).

```bash
npm ci        # at the repo root — installs all workspaces
```

Sanity check (optional): `npm ls vite` must show a single Vite major across all
workspaces; `node -e "require('sharp/package.json')"` must resolve to the
`sharp-stub` override, not real sharp.

## Step 2 — Create Dedicated Cloudflare Resources

Create fresh, dedicated resources for this CodFlow install. Default project
name is `codflow`; use the developer's preferred prefix (`<project>`)
otherwise.

```bash
npx wrangler d1 create <project>-db           # capture database_id
npx wrangler r2 bucket create <project>-images
npx wrangler kv namespace create RATE_LIMIT_KV --binding RATE_LIMIT_KV  # capture id
```

Rules:
- Always create new resources for this setup. Never bind to a resource that
  already exists in the account — it may belong to another application or
  store, and running migrations/seed against it would write into foreign data.
- If a name is taken, do not reuse the existing resource: choose a fresh,
  unique name (e.g. append the store name or a short suffix) and create again.
- Capture the D1 `database_id` (UUID) and KV `id` (32-hex) from command
  output. If parsing fails → hard stop, print the raw output, ask the
  developer. Never fall back to placeholder values.
- One KV namespace serves both workers (binding name differs per file:
  `RATE_LIMIT` in cod-server, `RATE_LIMIT_KV` in cod-client — only the
  namespace `id` matters).

## Step 3 — Bind Real IDs into BOTH wrangler.toml Files

Files: `cod-server/wrangler.toml` **and** `cod-client/wrangler.toml`.

- `[[d1_databases]]`: set `database_id` (same database in both files).
- `[[kv_namespaces]]`: set `id`.
- `[[r2_buckets]]`: confirm `bucket_name` matches the bucket created in Step 2.

Then read both files back and verify no placeholder remains anywhere,
including `[env.production]` blocks:

```bash
grep -rn "00000000-0000\|00000000000000000000000000000000" \
  cod-server/wrangler.toml cod-client/wrangler.toml
# expected: no matches — fix any hit before continuing
```

While editing, also replace the example domains in `[vars]` /
`[env.production.vars]` (`WORKER_URL`, `BETTER_AUTH_URL`, `WORKER_SELF_URL`,
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WORKER_URL`, `ALLOWED_ORIGINS`) with the
developer's real URLs when they are known; localhost defaults are correct for
local runs. In `cod-astro/theme01/wrangler.jsonc`, set `COD_SERVER_URL` to the
cod-server public URL before deploying the storefront (localhost default is
correct for local dev only).

## Step 4 — Generate Keys & Configure Secrets

Generate both keys once and keep them:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # STORE_API_KEY
```

Set secrets on the deployed workers (paste when prompted — never pipe secrets
through `echo`; it leaks to shell history and process lists):

```bash
cd cod-server         && npx wrangler secret put BETTER_AUTH_SECRET   # paste generated value
cd ../cod-client      && npx wrangler secret put BETTER_AUTH_SECRET   # same value
cd ../cod-astro/theme01 && npx wrangler secret put STORE_API_KEY      # paste generated store key
cd ../..
```

If the worker does not exist yet, wrangler offers to create it — accept.
For services that will also run locally, create `.dev.vars` from each package's
`.dev.vars.example` with the same key values (`.dev.vars` is gitignored).

Keep `STORE_API_KEY` at hand: Step 5 seeds its hash into the database, so the
storefront secret and the seeded hash must come from the identical string.

## Step 5 — Migrate & Seed the Cloudflare D1 Database

All schema and demo data go against the D1 created in Step 2 (remote), not an
emulated copy:

```bash
cd cod-server
npm run db:migrate:local                        # REQUIRED first: seed-admin writes local + remote
STORE_API_KEY=<generated-store-key> npm run db:seed:remote   # demo store متجر التطوير + catalog

cd ../cod-client
ADMIN_EMAIL=admin@example.com ADMIN_NAME=Admin node scripts/seed-admin.mjs <password> --remote
```

Notes:
- `db:migrate:local` must run before `seed-admin.mjs`: the script seeds the
  emulated local D1 first and needs its schema to exist.
- The seeder writes better-auth ≥ 1.7 credential rows (`issuer =
  'local:credential'`, `account_id = user id`) — re-run it after any password
  reset request for the seeded admin.
- Verify the seeder reports all statements executed and note the admin
  email/password and API key output — they appear once.

## Step 6 — Deploy in Dependency Order + Smoke Test

```bash
cd cod-server           && npm run deploy
cd ../cod-client        && npm run deploy     # opennextjs-cloudflare build && deploy
cd ../cod-astro/theme01 && npm run deploy     # astro build && wrangler deploy
```

Smoke-test after each deploy; do not continue past a failing check:

| Worker | Check | Expectation |
| :--- | :--- | :--- |
| cod-server | `curl -s -o /dev/null -w "%{http_code}" https://<workers-url>/api/docs` | `200` |
| cod-client sign-in API | `curl -s -X POST https://<dashboard-url>/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"<admin>","password":"<pass>"}'` | `200` + user JSON (401 = credentials/schema issue, 500 = config) |
| cod-client UI | open the workers URL | login page loads |
| cod-astro/theme01 | open the workers URL | homepage renders |

The first cod-server deploy also applies Durable Object / Workflow migrations —
watch the deploy output for migration errors before declaring success.

**workers.dev limitation (error 1042):** Cloudflare blocks Worker→Worker
`fetch()` between two `*.workers.dev` hosts. A storefront deployed to
workers.dev cannot load products from a cod-server also on workers.dev. For a
production storefront, put cod-server on a custom domain/route and point
`COD_SERVER_URL` at it (or wire a Service Binding), then re-deploy theme01 and
confirm `/products` shows the seeded catalog. Local development is unaffected.

## Step 7 — Closing Summary (Mandatory)

Print a resource inventory:

| Resource | Name | ID | Bound in | Verified by |
| :--- | :--- | :--- | :--- | :--- |
| D1 | `<project>-db` | `<uuid>` | cod-server/wrangler.toml, cod-client/wrangler.toml | `d1 create` output + Step 3 grep |
| R2 | `<project>-images` | n/a (name-bound) | cod-server/wrangler.toml | `r2 bucket create` confirmation |
| KV | rate-limit namespace | `<32-hex>` | cod-server/wrangler.toml, cod-client/wrangler.toml | `kv namespace create` output |

Plus a credentials table (admin email/password, STORE_API_KEY) shown **once**.

---

## Running the Stack Locally During Development

The `npm run dev` scripts execute Workers on the local machine with
Miniflare-emulated storage persisted to `<repo-root>/.wrangler-shared` — they
do not read the deployed D1. To boot all three services locally:

```bash
cd cod-server && npm run db:migrate:local && STORE_API_KEY=<key> npm run db:seed:local
cd ../cod-client && ADMIN_EMAIL=… ADMIN_NAME=Admin node scripts/seed-admin.mjs <password>
```

Then start one terminal per service:

| Package | Directory | Command | URL |
| :--- | :--- | :--- | :--- |
| API Server | `cod-server` | `npm run dev` | http://localhost:8787 (docs at `/api/docs`) |
| Dashboard | `cod-client` | `npm run dev` | http://localhost:3000 |
| Storefront | `cod-astro/theme01` | `npm run dev` | http://localhost:4321 |

Localhost→localhost is unaffected by the workers.dev limitation: the storefront
renders the full seeded catalog locally.

The storefront directory is `cod-astro/theme01` — bare `cod-astro/` has no
scripts.

---

## Troubleshooting

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **Deploy fails with placeholder-looking binding errors** | Resource IDs were never replaced in wrangler.toml | Re-run the Step 3 verification greps; bind real IDs. |
| **`grep` finds placeholders inside `[env.production]` blocks** | Production block edited incompletely | Replace every all-zero `database_id` / KV `id` occurrence in the file. |
| **cod-client deploy: `ENOENT … pages-manifest.json`** | A per-package `package-lock.json` exists again, or the root one is missing — OpenNext cannot detect the monorepo | Delete nested lockfiles, run `npm ci` at the repo root, rebuild. |
| **cod-client build: `Can't resolve '../../cod-shared/...'`** | Workspace root inference broken (nested lockfile or removed root package.json) | Restore single-root-lockfile layout; do NOT re-add `turbopack.root`/`outputFileTracingRoot` pins. |
| **Worker bundling fails on `sharp` / `.node` files** | Real sharp entered the graph | Keep the root `"overrides": { "sharp": "file:vendor/sharp-stub" }`; do not install real sharp into cod-client. |
| **theme01 dev dies: `Missing field 'moduleType'`** | Dual Vite majors | Root `package.json` overrides pin `vite` to ^8.2.2 (root-only — npm ignores child overrides). `rm -rf node_modules && npm ci`; `npm ls vite` must show one major. |
| **Storefront deployed but products empty** | Worker→Worker fetch between two `*.workers.dev` hosts blocked (CF error 1042) | Put cod-server on a custom domain/route, set `COD_SERVER_URL`, redeploy theme01. Local dev unaffected. |
| **Sign-in returns 500 `Secondary-storage rate limiting requires SecondaryStorage.increment`** | lib/auth.ts swapped back to `withCloudflare({ kv })` shortcut | Keep the full custom `secondaryStorage` in `cod-client/lib/auth.ts`; better-auth-cloudflare@0.3.1 lacks `increment`. |
| **Sign-in returns 401 with correct credentials** | Admin row predates better-auth 1.7 semantics (missing `issuer`, `account_id = email`) | Apply migration 0010, re-run `scripts/seed-admin.mjs <password> --remote`. |
| **get-session 500: field "alg" does not exist in "jwkss"** | Migration 0011 missing on that database | Run `npm run db:migrate:remote` (or `:local`). |
| **wrangler API calls fail `Authentication error [code: 10000]`** | Shell exports `CLOUDFLARE_ACCOUNT_ID` for an account the token can't access | Prefix commands with `env -u CLOUDFLARE_ACCOUNT_ID` or unset it. |
| **theme01 boots then wedges/crashes at first render: `optimized dependencies changed. reloading`** | Late SSR dep discovery races the workerd reload ([astro#16933](https://github.com/withastro/astro/issues/16933)) | Keep `vite.environments.ssr.optimizeDeps` (`noDiscovery: true` + excludes) in `astro.config.mjs`. |
| **`Address already in use :8787`** | Another checkout's wrangler holds the port | Kill that process tree; run the port preflight before starting servers. |
| **`Another astro dev server is already running`** | Astro 7 dev lockfile left behind | `npx astro dev stop` (or kill the stale process). |
| **Astro behaves unexpectedly under an agent (backgrounded, JSON output)** | Astro auto-enables background+JSON mode when `AGENT`, `CLAUDE_CODE_*`, or `OPENCODE` env vars are present | Humans get foreground behavior; agents should use `npx astro dev status` / `logs` / `stop`. |
| **`wrangler login` fails in headless/SSH** | No GUI browser available | Run `npx wrangler login` on a local machine, or configure `CLOUDFLARE_API_TOKEN` in the environment. |
| **`wrangler r2 bucket create` fails** | R2 subscription not enabled on Cloudflare account | Navigate to dash.cloudflare.com → R2, add a payment card to activate the Free Tier, then retry. |
| **Local D1 split-brain / missing tables** | Wrangler ran without `--persist-to` | Always run local migrations and commands with `--persist-to ../.wrangler-shared`. |
| **Better Auth 500 on sign-in** | `BETTER_AUTH_SECRET` missing | Ensure `BETTER_AUTH_SECRET` is set in `cod-client/.dev.vars` (local) or via `wrangler secret put` (production). |
| **Image uploads fail in browser** | R2 CORS not configured for PUT requests | Run `node scripts/setup-r2-cors.mjs` in `cod-server` with R2 API tokens. |

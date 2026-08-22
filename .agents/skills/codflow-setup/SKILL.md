---
name: codflow-setup
description: >-
  Autonomous setup guide for CodFlow — sets up prerequisites, Cloudflare resources (D1, R2, KV),
  environment variables (.dev.vars), database migrations, demo store seeding, admin account generation,
  and local or production execution. Use when a developer wants to set up CodFlow locally, bind Cloudflare
  resources, run migrations, seed sample data, create an admin user, or deploy to Cloudflare Workers.
---

# CodFlow Setup — Developer & Agent Runbook

CodFlow is an open-source, cash-on-delivery (COD) e-commerce platform for Algeria and emerging markets, built on Cloudflare Workers, Next.js 16, Astro 7, and D1 SQLite.

This skill provides an exact, verified procedure for setting up CodFlow from a fresh clone into a fully operational local development stack or production deployment on Cloudflare.

---

## Read This First — What Exists Where (Expectation Contract)

> [!IMPORTANT]
> State this contract to the developer **before** running any setup step. Most
> setup confusion comes from expecting local mode to provision real resources.

| Mode | D1 | R2 | KV | DO / Workflow | Bindings in wrangler.toml |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Local (`--persist-to ../.wrangler-shared`) | Emulated (SQLite file) | Emulated | Emulated | Emulated | Placeholder IDs OK — ignored |
| Cloud / production | **Real, created by you** | **Real** (needs card-on-file for R2) | **Real** | Real at deploy | **Placeholder IDs forbidden** |

Both `wrangler.toml` files ship with all-zero placeholder IDs:

```toml
database_id = "00000000-0000-0000-0000-000000000000"   # placeholder
id          = "00000000000000000000000000000000"        # placeholder
```

Miniflare ignores these IDs locally — that is why local dev works out of the
box. **Production deploys fail or silently break with them**, so every
placeholder must be replaced during cloud provisioning (Step C2 below).

Contract sentence to state verbatim before starting (fill `<project>` and account):

> *"Local mode will not create anything in your Cloudflare dashboard. Cloud mode will create D1 `<project>-db`, R2 bucket `<project>-images`, and a KV namespace for rate limiting in account `<account>` and bind their real IDs into both wrangler.toml files."*

---

## Essential Cloudflare Prerequisites & Account Setup

> [!IMPORTANT]
> **1. Cloudflare Login & Browser OAuth:**
> Before running any remote deployment or provisioning commands, the developer must authenticate with Cloudflare:
> ```bash
> npx wrangler whoami
> ```
> If not logged in, run:
> ```bash
> npx wrangler login
> ```
> This command will open a browser window for Cloudflare OAuth authorization. The user must approve the connection in their browser before continuing.

> [!WARNING]
> **2. Cloudflare R2 Activation & Credit Card Requirement:**
> - Cloudflare R2 provides a **generous Free Tier** (10 GB storage, 1,000,000 Class A write operations, and 10,000,000 Class B read operations per month at $0.00 cost).
> - **However**, Cloudflare requires an **active payment method (credit/debit card) on file** in the Cloudflare Dashboard to enable the R2 subscription on the account before creating buckets.
> - **How to activate R2:**
>   1. Open [https://dash.cloudflare.com](https://dash.cloudflare.com) and navigate to **R2 Object Storage**.
>   2. Click **Enable R2** / **Subscribe to R2** (select the default Free Tier).
>   3. Add a payment card to activate the service.
>   4. Once activated, R2 buckets can be created via `npx wrangler r2 bucket create <bucket-name>`.
> - **Note for Local Development:** Local dev runs 100% offline using Miniflare / SQLite emulation in `.wrangler-shared` and **does NOT require a Cloudflare account or credit card**.

---

## Interactive Setup Workflow for AI Agents

When a developer asks to set up CodFlow, follow this decision path:

1. **Clarify Setup Mode & Preferences with the Developer:**
   - **Mode**: Local Development (default, 100% free offline emulation) OR Cloudflare Cloud / Production?
   - **Store/Project Name**: Resource name prefix (default: `codflow` or custom store brand).
   - **Admin Account**: Email (default: `admin@example.com`) and Name (default: `Admin`).
   - If Cloudflare Cloud is selected: verify `npx wrangler whoami`, remind about the R2 card-on-file activation, then follow the **Cloud Provisioning Runbook (C0–C6)** below.
   - State the expectation contract above before executing anything.
2. **Execute Setup Autonomously:**
   - Install dependencies in strict order (`cod-shared` first).
   - Configure `.dev.vars` with cryptographic keys.
   - Run D1 migrations to shared state (`.wrangler-shared` for local, or remote D1 via Step C4).
   - Seed sample products, categories, 58-wilaya shipping rates, and store API key.
   - Create admin credentials with Better Auth hashed passwords.
3. **Verify the Running Services:**
   - Verify Backend API & Swagger Docs: `http://localhost:8787/api/docs`.
   - Verify Merchant Dashboard: `http://localhost:3000`.
   - Verify Storefront: `http://localhost:4321`.

---

## Automation Scripts

### Automated Local Setup (One Command)

```bash
node .agents/skills/codflow-setup/scripts/setup-local.mjs

# Or with custom admin parameters:
ADMIN_EMAIL=you@example.dz ADMIN_NAME="Store Owner" node .agents/skills/codflow-setup/scripts/setup-local.mjs
```

There is intentionally **no provisioning script for Cloud mode**. Remote
provisioning is agent-driven: silent fallbacks, blind re-creation on name
collisions, regex-edited TOML, and echo-piped secrets are exactly the failure
modes written steps avoid. Follow the runbook below instead.

---

## Detailed Step-by-Step Runbook (Local Development)

### Step 1: Install Dependencies in Strict Order

> [!IMPORTANT]
> There is no root `package.json` and no npm workspaces. Dependencies must be installed per-package, starting with `cod-shared` because other packages resolve it via relative paths.

```bash
# 1. cod-shared (MUST BE FIRST)
cd cod-shared && npm install

# 2. Backend Worker (cod-server)
cd ../cod-server && npm install

# 3. Merchant Dashboard (cod-client)
cd ../cod-client && npm install

# 4. Storefront Theme (cod-astro/theme01)
cd ../cod-astro/theme01 && npm install
cd ../..
```

---

### Step 2: Configure Environment Files (`.dev.vars`)

Create `.dev.vars` files from examples across the three runtime applications:

#### 1. Backend (`cod-server/.dev.vars`)
```ini
STORE_API_KEY=codflow-dev-store-key
ENVIRONMENT=development
WORKER_URL=http://localhost:8787
WORKER_SELF_URL=http://localhost:8787/
BETTER_AUTH_URL=http://localhost:3000/api/auth
MEDIA_DOMAIN=media.example.com
R2_BUCKET_NAME=codflow-images
ALLOWED_ORIGINS=*
```

#### 2. Dashboard (`cod-client/.dev.vars`)
Generate a 32-byte base64 string for `BETTER_AUTH_SECRET`:
```bash
# Generate secret:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
```ini
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
BETTER_AUTH_SECRET=<32_BYTE_BASE64_SECRET>
```

#### 3. Storefront (`cod-astro/theme01/.dev.vars`)
```ini
STORE_API_KEY=codflow-dev-store-key
COD_SERVER_URL=http://localhost:8787
```

---

### Step 3: Run Database Migrations & Seed Local Store

Local D1 SQLite database is persisted to `<repo-root>/.wrangler-shared` so `cod-server` and `cod-client` share the exact same state without split-brain.

```bash
cd cod-server
# Apply 10 D1 migrations (0000 to 0009) to .wrangler-shared
npm run db:migrate:local

# Seed demo store (متجر التطوير), 4 categories, 8 products, variants, and API key
npm run db:seed:local
```

---

### Step 4: Create Local Merchant Admin Account

Create an admin credentials account in Better Auth:

```bash
cd ../cod-client
ADMIN_EMAIL=admin@example.com ADMIN_NAME=Admin node scripts/seed-admin.mjs [optional-password]
```

*Output displays generated password and admin API key.*

---

### Step 5: Start Local Development Servers

Before starting servers, confirm the ports are free — a stale server from
another checkout produces confusing failures:

```bash
lsof -nP -iTCP:3000 -iTCP:4321 -iTCP:8787 -sTCP:LISTEN   # expect no output
```

Open three terminals or launch background processes:

| Package | Directory | Command | URL | Description |
| :--- | :--- | :--- | :--- | :--- |
| **API Server** | `cod-server` | `npm run dev` | `http://localhost:8787` | Hono Worker, OpenAPI at `/api/docs`, MCP at `/mcp` |
| **Dashboard** | `cod-client` | `npm run dev` | `http://localhost:3000` | Next.js 16 Merchant UI (Sign in with admin credentials) |
| **Storefront** | `cod-astro/theme01` | `npm run dev` | `http://localhost:4321` | Astro 7 COD Storefront (Place test orders) |

> The storefront lives in `cod-astro/theme01`, **not** bare `cod-astro/` —
> the parent folder has no `dev` script (`Missing script: "dev"`).

---

## Cloud Provisioning Runbook (C0–C6)

Ordered steps for creating and binding real Cloudflare resources. Every step
ends in a verified artifact; **do not skip a gate**. Reuse existing resources
rather than blind-creating: name collisions across checkouts are expected
(two clones of CodFlow on one account is a common situation). Prefer unique
per-project names (`<project>-db`), else reuse deliberately.

### Step C0 — Preflight

```bash
npx wrangler whoami        # logged in? which account? multiple accounts → pin account_id
```

- If multiple accounts: ask the developer which one; record the `account_id`.
- R2 gate: ask the developer to confirm dash.cloudflare.com → R2 shows enabled
  (card on file). Do not proceed to bucket creation until confirmed.
- Port gate (if also running dev): check 3000/4321/8787 free.

### Step C1 — Reuse-or-Create Each Resource (Never Blind-Create)

```bash
npx wrangler d1 list                          # exists? capture its database_id → REUSE
npx wrangler d1 create <project>-db           # only if absent
npx wrangler r2 bucket list                   # exists? reuse
npx wrangler r2 bucket create <project>-images
npx wrangler kv namespace list                # exists? reuse (match by title)
npx wrangler kv namespace create RATE_LIMIT_KV --binding RATE_LIMIT_KV  # capture id
```

Rules:
- Capture the D1 `database_id` (UUID) and KV `id` (32-hex). If parsing fails →
  **hard stop**, print raw output, ask the developer. Never fall back to
  placeholder values.
- A KV namespace reused by title may carry a different binding label than the
  TOML expects (`RATE_LIMIT` in cod-server, `RATE_LIMIT_KV` in cod-client) —
  only the namespace `id` matters in the config.

### Step C2 — Bind Real IDs into BOTH wrangler.toml Files

Files: `cod-server/wrangler.toml` **and** `cod-client/wrangler.toml`.

- Set `[[d1_databases]]` `database_id` (same database in both files).
- Set `[[kv_namespaces]]` `id`.
- Confirm `[[r2_buckets]]` `bucket_name` matches the created/reused bucket.

Then **read both files back** and verify no placeholder remains anywhere,
including any `[env.production]` blocks:

```bash
grep -rn "00000000-0000\|00000000000000000000000000000000" \
  cod-server/wrangler.toml cod-client/wrangler.toml
# expected: no matches
```

If any match remains, fix it before proceeding. Placeholder IDs break deploys.

### Step C3 — Secrets (Interactive, No Echo-Piping)

Generate the auth secret once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then set secrets interactively (paste when prompted):

```bash
cd cod-server    && npx wrangler secret put BETTER_AUTH_SECRET   # paste generated 32-byte base64
cd cod-client    && npx wrangler secret put BETTER_AUTH_SECRET   # same value
cd cod-astro/theme01 && npx wrangler secret put STORE_API_KEY && npx wrangler secret put COD_SERVER_URL
```

Print each secret **once** in a summary table (name, where used); tell the
developer to store it. Never pipe secrets through `echo` — it leaks to shell
history and the process list.

### Step C4 — Remote Migrations & Admin

```bash
cd cod-server && npm run db:migrate:remote

cd ../cod-client
ADMIN_EMAIL=admin@yourdomain.com ADMIN_NAME=Admin node scripts/seed-admin.mjs <password> --remote
```

### Step C5 — Deploy in Dependency Order + Smoke Test

```bash
cd cod-server         && npm run deploy   # then smoke-test below BEFORE deploying the rest
cd ../cod-client      && npm run deploy
cd ../cod-astro/theme01 && npm run deploy
```

Smoke tests after each deploy:

| Worker | Check | Expectation |
| :--- | :--- | :--- |
| cod-server | `curl -s -o /dev/null -w "%{http_code}" https://<workers-url>/api/docs` | `200` |
| cod-client | open the workers URL | login page loads |
| cod-astro/theme01 | open the workers URL | homepage renders store title |

> The first `cod-server` deploy also applies Durable Object / Workflow
> migrations (`mcp-v1`). Watch the deploy output for migration errors before
> declaring success.

### Step C6 — Closing Summary (Mandatory)

Print a resource inventory table:

| Resource | Name | ID | Bound in file | Verified by |
| :--- | :--- | :--- | :--- | :--- |
| D1 | `<project>-db` | `<uuid>` | cod-server/wrangler.toml, cod-client/wrangler.toml | `wrangler d1 list` + C2 grep |
| R2 | `<project>-images` | n/a (name-bound) | cod-server/wrangler.toml | `wrangler r2 bucket list` |
| KV | rate-limit namespace | `<32-hex>` | cod-server/wrangler.toml, cod-client/wrangler.toml | `wrangler kv namespace list` |

Plus a credentials table (admin email/password, store API key) shown **once**.

---

## Troubleshooting & Common Traps

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **"You did not create anything in my CF account" after local setup** | Expected behavior: local mode is 100% Miniflare emulation | Point to the expectation contract table above; run C0–C6 for real resources. |
| **Deploy fails with placeholder-looking binding errors** | Resource IDs were never replaced in wrangler.toml | Run the Step C2 verification greps; bind real IDs. |
| **cod-client pages 500: `Module not found: Can't resolve '../../cod-shared/...'`** | Turbopack workspace root pinned inside `cod-client` | Keep `turbopack.root` AND `outputFileTracingRoot` pointed at the monorepo root in `cod-client/next.config.mjs` (both keys, same value). |
| **theme01 dev dies instantly: `Missing field 'moduleType'` / `Dev server process exited before becoming ready`** | Dual Vite majors from npm flat hoisting ([astro#16229](https://github.com/withastro/astro/issues/16229)) | Keep `"overrides": { "vite": "^8.2.2" }` + vitest 4 in theme01 package.json; `rm -rf node_modules && npm install`. `npm ls vite` must show a single major. |
| **theme01 boots then wedges/crashes at first render: `optimized dependencies changed. reloading` → `The file does not exist at .../deps_ssr/server-*.js`** | Late SSR dep discovery races the workerd reload ([astro#16933](https://github.com/withastro/astro/issues/16933)) | Keep `vite.environments.ssr.optimizeDeps` (`noDiscovery: true` + excludes) in `astro.config.mjs`. The legacy `vite.ssr.optimizeDeps` key has no effect. |
| **`Address already in use :8787`** | Another checkout's wrangler holds the port | Kill that process tree; add the port preflight before starting servers. |
| **`Another astro dev server is already running`** | Astro 7 dev lockfile left behind | `npx astro dev stop` (or kill the stale process). |
| **Astro behaves unexpectedly under an agent (backgrounded, JSON output)** | Astro auto-enables background+JSON mode when `AGENT`, `CLAUDE_CODE_*`, or `OPENCODE` env vars are present | Humans get foreground behavior; agents should use `npx astro dev status` / `logs` / `stop`. |
| **`wrangler login` fails in headless/SSH** | No GUI browser available | Run `npx wrangler login` on a local machine, or configure `CLOUDFLARE_API_TOKEN` in the environment. |
| **`wrangler r2 bucket create` fails** | R2 subscription not enabled on Cloudflare account | Navigate to `https://dash.cloudflare.com → R2`, add a payment card to activate the Free Tier, then retry. |
| **Local D1 split-brain / missing tables** | Wrangler ran without `--persist-to` | Always run local migrations and commands with `--persist-to ../.wrangler-shared`. |
| **`npm test` fails after git pull** | `cod-shared` was not installed first | Run `cd cod-shared && npm install` before running tests in other packages. |
| **Better Auth 500 on sign-in** | `BETTER_AUTH_SECRET` missing | Ensure `BETTER_AUTH_SECRET` is set in `cod-client/.dev.vars` (local) or via `wrangler secret put` (production). |
| **Image uploads fail in browser** | R2 CORS not configured for PUT requests | Run `node scripts/setup-r2-cors.mjs` in `cod-server` with R2 API tokens. |

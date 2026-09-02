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
Workers, Astro 7 (dashboard + storefront), and D1 SQLite. This runbook takes a
fresh clone to a fully working, verified deployment.

Every setup **creates real Cloudflare resources** in the developer's account,
**binds their real IDs** into the wrangler.toml files, and **migrates and seeds
that same database**. There is exactly one path — follow it in order and do not
skip a gate.

The dashboard is `cod-client-astro` (Astro, prerendered static + auth
worker). (The legacy Next.js dashboard was removed in v1.1.x.)

## Before Starting — State This Contract

State this to the developer before running anything:

> *"This setup will create D1 `<project>-db`, R2 bucket `<project>-images`, and
> two KV namespaces in your Cloudflare account `<account>`, bind their real
> IDs into both `wrangler.toml` files, and migrate + seed the D1 database in
> your account. Nothing is left on placeholder values."*

Both `cod-server/wrangler.toml` and `cod-client-astro/wrangler.toml` ship with
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
- Ports 4321 / 8787 free if services will run locally:
  ```bash
  lsof -nP -iTCP:4321 -iTCP:8787 -sTCP:LISTEN   # expect no output
  ```
  Processes on these ports often belong to ANOTHER checkout's dev servers;
  identify via `ps -p <pid>` and confirm with the human before killing.

If `whoami` lists multiple accounts, ask the developer which one to use and
record that `account_id`.

**CRITICAL: Strip stale `CLOUDFLARE_ACCOUNT_ID` everywhere.** If the shell
exports `CLOUDFLARE_ACCOUNT_ID` for an account the OAuth token cannot access,
every wrangler command fails with `Authentication error [code: 10000]` —
including npm scripts (which invoke wrangler) and seeders. Shell rc files
re-export this variable in every new shell. **Prefix EVERY wrangler invocation**
with `env -u CLOUDFLARE_ACCOUNT_ID` so it targets the logged-in account, or
`unset CLOUDFLARE_ACCOUNT_ID` once per session. Examples throughout this
runbook show the prefix inline where practical.

---

## Step 1 — Install Dependencies (one command)

CodFlow is an **npm workspace monorepo**: one root `package.json`, one root
`package-lock.json`. Never create per-package lockfiles.

```bash
npm ci        # at the repo root — installs all workspaces
```

Sanity check (optional): `npm ls vite` must show a single Vite major across all
workspaces (the root `overrides` pin enforces it).

## Step 2 — Create Dedicated Cloudflare Resources

Create fresh, dedicated resources for this CodFlow install. Default project
name is `codflow`; use the developer's preferred prefix (`<project>`)
otherwise.

```bash
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler d1 create <project>-db                  # capture database_id
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler r2 bucket create <project>-images
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler kv namespace create RATE_LIMIT          # capture id
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler kv namespace create OAUTH_KV            # capture id (MCP OAuth)
```

Rules:
- Always create new resources for this setup. Never bind to a resource that
  already exists in the account — it may belong to another application or
  store, and running migrations/seed against it would write into foreign data.
- **Unique names apply to WORKER names, not just resources.** Default worker
  `name` fields in wrangler configs collide across clones, and deploying
  silently overwrites another installation. Require the developer to choose a
  unique prefix (e.g. `mystore-server`, `mystore-dashboard`, `mystore-theme01`)
  and update the `name` field in all three wrangler files before first deploy.
  This prevents cross-clone overwrite.
- If a resource name is taken, do not reuse the existing resource: choose a
  fresh, unique name (e.g. append the store name or a short suffix) and create
  again.
- Capture the D1 `database_id` (UUID) and both KV `id`s (32-hex) from command
  output. If parsing fails → hard stop, print the raw output, ask the
  developer. Never fall back to placeholder values.
- Create **two** KV namespaces (rate limiting + MCP OAuth provider). Binding
  names differ per file: cod-server uses `RATE_LIMIT` + `OAUTH_KV`;
  cod-client-astro uses `RATE_LIMIT_KV` (its own namespace, only the `id`
  matters).

## Step 3 — Bind Real IDs into BOTH wrangler.toml Files

```bash
cp cod-server/wrangler.toml.example cod-server/wrangler.toml
cp cod-client-astro/wrangler.toml.example cod-client-astro/wrangler.toml
```

Files: `cod-server/wrangler.toml` **and** `cod-client-astro/wrangler.toml`.

- `[[d1_databases]]`: set `database_id` (same database in both files).
- `[[kv_namespaces]]`: set `id`s.
- `[[r2_buckets]]`: confirm `bucket_name` matches the bucket created in Step 2.

Then read both files back and verify no placeholder remains anywhere,
including `[env.production]` blocks:

```bash
grep -rn "00000000-0000\|00000000000000000000000000000000" \
  cod-server/wrangler.toml cod-client-astro/wrangler.toml
# expected: no matches — fix any hit before continuing
```

**Propagate renamed D1 database through scripts:** If the database name differs
from `codflow-os-db`, it is hardcoded in multiple locations that must be updated:
- `cod-server/package.json`: `db:migrate:local` and `db:migrate:remote` scripts
- `cod-server/scripts/seed-local.mjs`: both `--local` and `--remote` wrangler
  d1 execute calls
- `cod-client-astro/scripts/seed-admin.mjs`: both `--local` and `--remote`
  wrangler d1 execute calls

After updating, grep the repo to confirm only README/doc mentions of the old
name remain:

```bash
grep -r "codflow-os-db" --exclude-dir=node_modules --exclude-dir=.git
# expected: only documentation files, zero script/config hits
```

Confirm the filled `wrangler.toml` files are not tracked by git:

```bash
git status cod-server/wrangler.toml cod-client-astro/wrangler.toml
# expected: nothing listed (both ignored)
```

If either file appears in `git status`, stop — the `.gitignore` is not applied
correctly. Do not continue until both are untracked.

While editing, also replace the example domains in `[vars]` /
`[env.production.vars]` (`WORKER_URL`, `BETTER_AUTH_URL`, `WORKER_SELF_URL`,
`PUBLIC_APP_URL`, `PUBLIC_API_URL`, `PUBLIC_TRUSTED_ORIGINS`) with the
developer's real URLs when they are known; localhost defaults are correct for
local runs. In `cod-astro/theme01/wrangler.jsonc`, set `COD_SERVER_URL` to the
cod-server public URL before deploying the storefront (localhost default is
correct for local dev only).

Also create the dashboard's build-time client env:

```bash
cd cod-client-astro && cp .env.example .env
# edit .env → PUBLIC_API_URL is the cod-server URL (baked in at build time)
```

## Step 3b — Configure R2 for Image Uploads

This step requires values only the developer can retrieve from the Cloudflare
dashboard. The agent must ask for them — do not guess or skip.

### Agent instructions

**Ask the developer for these four things before proceeding:**

1. The **media subdomain** they want to use for serving images
   (e.g. `media.yourdomain.com`). They must add this as a custom domain on
   the R2 bucket first:
   > Cloudflare dashboard → R2 → `<project>-images` → Settings →
   > Custom Domains → Connect Domain → enter the subdomain → wait for Active.

2. Their **Cloudflare Account ID**
   (Cloudflare dashboard → top-right account menu, or any Workers page sidebar).

3. An **R2 API token** created specifically for this bucket:
   > Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API Token →
   > Permissions: Object Read & Write → Bucket: `<project>-images` → Create.
   >
   > This shows two values **once** — copy both:
   > - Access Key ID
   > - Secret Access Key

Once the developer provides all four values, continue with the steps below.

---

### 1. Give the developer the CORS JSON to paste

Tell the developer to set the CORS policy on the bucket manually:

> Cloudflare dashboard → R2 → `<project>-images` → Settings → CORS Policy →
> Add CORS policy → paste this JSON (replacing the dashboard domain):

```json
[
  {
    "AllowedOrigins": [
      "https://<dashboard-domain>",
      "http://localhost:4321"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Wait for the developer to confirm it is saved before continuing.

### 2. Set MEDIA_DOMAIN in wrangler.toml

Update `MEDIA_DOMAIN` in `cod-server/wrangler.toml` `[vars]` and
`[env.production]` to the media subdomain the developer provided. No scheme —
hostname only:

```toml
MEDIA_DOMAIN = "media.yourdomain.com"
```

### 3. Set R2 secrets on the cod-server worker

After cod-server is deployed (Step 6), set the three secrets using the values
the developer provided. Use stdin redirect — never echo secrets into the shell:

```bash
printf '<CF_ACCOUNT_ID>' | env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put CF_ACCOUNT_ID --name <server-worker-name>
printf '<R2_ACCESS_KEY_ID>' | env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put R2_ACCESS_KEY_ID --name <server-worker-name>
printf '<R2_SECRET_ACCESS_KEY>' | env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put R2_SECRET_ACCESS_KEY --name <server-worker-name>
```

Also add them to `cod-server/.dev.vars` for local dev:

```
CF_ACCOUNT_ID=<value>
R2_ACCESS_KEY_ID=<value>
R2_SECRET_ACCESS_KEY=<value>
MEDIA_DOMAIN=media.yourdomain.com
```

### 4. Set MEDIA_DOMAIN on the storefront worker and redeploy

After theme01 is deployed (Step 6):

```bash
printf 'media.yourdomain.com' | env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put MEDIA_DOMAIN --name <theme01-worker-name>
cd cod-astro/theme01 && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy
```

### 5. Redeploy cod-server with updated MEDIA_DOMAIN

```bash
cd cod-server && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy
```

### Verify

```bash
# presignedUrl must appear and publicUrl must start with https://media.yourdomain.com/
curl -s -X POST https://<api-domain>/api/images/presign \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <admin-api-key>" \
  -d '{"contentType":"image/jpeg"}'
```

If `publicUrl` starts with the Worker URL instead of the media domain,
`MEDIA_DOMAIN` is not set or the worker was not redeployed after setting it.

---

## Step 4 — Generate Keys & Configure Secrets

Generate the keys once and keep them:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # STORE_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"       # MCP_LOGIN_TICKET_SECRET
```

**Deploy workers BEFORE setting secrets:** In non-interactive sessions,
`wrangler secret put` against a nonexistent worker fails or hangs on the create
prompt. Either deploy each worker first (Step 6), or wait until after deploy to
set secrets. When setting secrets, provide values via stdin redirect from a
chmod-600 temp file — never use `echo` or heredocs, which leak secrets into
shell history and process lists:

```bash
# After cod-server is deployed:
cd cod-server
echo "<BETTER_AUTH_SECRET_value>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put BETTER_AUTH_SECRET < /tmp/secret.txt
echo "<MCP_LOGIN_TICKET_SECRET_value>" > /tmp/secret.txt
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put MCP_LOGIN_TICKET_SECRET < /tmp/secret.txt
rm /tmp/secret.txt

# After cod-client-astro is deployed — SAME two values (must match cod-server):
cd ../cod-client-astro
echo "<BETTER_AUTH_SECRET_value>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put BETTER_AUTH_SECRET < /tmp/secret.txt
echo "<MCP_LOGIN_TICKET_SECRET_value>" > /tmp/secret.txt
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put MCP_LOGIN_TICKET_SECRET < /tmp/secret.txt
rm /tmp/secret.txt

# theme01: STORE_API_KEY (same string the seeder will hash in Step 5)
```

For services that will also run locally, create `.dev.vars` from each package's
`.dev.vars.example` with the same key values (`.dev.vars` is gitignored).

Keep `STORE_API_KEY` at hand: Step 5 seeds its hash into the database, so the
storefront secret and the seeded hash must come from the identical string.

## Step 5 — Migrate & Seed the Cloudflare D1 Database

**Remote migrations are mandatory.** All schema and demo data go against the D1
created in Step 2 (remote), not an emulated copy. Both local and remote
migrations must run:

```bash
cd cod-server
env -u CLOUDFLARE_ACCOUNT_ID npm run db:migrate:local   # REQUIRED first: seed-admin writes local + remote
env -u CLOUDFLARE_ACCOUNT_ID npm run db:migrate:remote  # MANDATORY: deployed sign-in 500s without this
env -u CLOUDFLARE_ACCOUNT_ID STORE_API_KEY=<generated-store-key> npm run db:seed:remote   # demo store متجر التطوير + catalog

cd ../cod-client-astro
ADMIN_EMAIL=admin@example.com ADMIN_NAME=Admin npm run seed:admin:remote
```

Notes:
- `db:migrate:local` must run before `seed-admin`: the script seeds the
  emulated local D1 first and needs its schema to exist.
- `db:migrate:remote` is MANDATORY before any deployed sign-in attempt —
  without it, Better Auth 1.7 schema requirements fail (`field "alg" does not
  exist in "jwkss"`), producing 500 errors.
- The seeder writes better-auth ≥ 1.7 credential rows (`issuer =
  'local:credential'`, `account_id = user id`) — re-run it after any password
  reset request for the seeded admin.
- Verify the seeder reports all statements executed and note the admin
  email/password and API key output — they appear once.

## Step 6 — Deploy in Dependency Order + Smoke Test

```bash
cd cod-server           && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy
cd ../cod-client-astro  && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy     # wrangler deploy (build first: npm run build)
cd ../cod-astro/theme01 && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy     # astro build && wrangler deploy
```

**After deploy, replace localhost URL vars with real deployed URLs and
redeploy:** Once workers are live, set `PUBLIC_APP_URL` /
`PUBLIC_API_URL` / `PUBLIC_TRUSTED_ORIGINS` (cod-client-astro wrangler.toml
`[vars]`), `WORKER_URL`, `WORKER_SELF_URL`, `BETTER_AUTH_URL` (cod-server
wrangler.toml `[vars]`), and `COD_SERVER_URL` (theme01 wrangler.jsonc) to the
actual deployed URLs, then redeploy affected workers. For the dashboard also
update `.env` (`PUBLIC_API_URL`) and **rebuild** — it is baked into the client
bundle at build time. Skipping this causes browser sign-in failures (R6/R7).

Smoke-test after each deploy; do not continue past a failing check:

| Worker | Check | Expectation |
| :--- | :--- | :--- |
| cod-server | `curl -s -o /dev/null -w "%{http_code}" https://<workers-url>/api/docs` | `200` |
| dashboard sign-in API | `curl -s -X POST https://<dashboard-url>/api/auth/sign-in/email -H "Content-Type: application/json" -H "Origin: https://<dashboard-url>" -d '{"email":"<admin>","password":"<pass>"}'` | `200` + user JSON (401 = credentials/schema issue, 500 = config, **403 `INVALID_ORIGIN` = R6 not applied**) |
| dashboard UI | open the workers URL | login page loads |
| cod-astro/theme01 | open the workers URL | homepage renders |

**CRITICAL — Origin header in sign-in tests:** Plain curl omits the `Origin`
header; Better Auth skips its origin check and returns 200, while every real
browser request gets `403 INVALID_ORIGIN` (which the UI masks as "Invalid email
or password"). The canonical sign-in check MUST send
`-H "Origin: https://<dashboard-url>"` and expect 200 + user JSON. If browser
login fails but curl without Origin passes, the dashboard origin is missing
from `PUBLIC_TRUSTED_ORIGINS` — apply R6, redeploy, and retest with the Origin
header.

**Diagnose unclear failures with `wrangler tail`:** Run
`env -u CLOUDFLARE_ACCOUNT_ID npx wrangler tail <worker-name> --format pretty`
in the background, have the human retry the failing operation, then read the
log — the true error surfaces there, not in UI text.

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
| D1 | `<project>-db` | `<uuid>` | cod-server/wrangler.toml, cod-client-astro/wrangler.toml | `d1 create` output + Step 3 grep |
| R2 | `<project>-images` | n/a (name-bound) | cod-server/wrangler.toml | `r2 bucket create` confirmation |
| KV (rate limit) | rate-limit namespace | `<32-hex>` | cod-server + cod-client-astro wrangler.toml | `kv namespace create` output |
| KV (MCP OAuth) | oauth namespace | `<32-hex>` | cod-server/wrangler.toml | `kv namespace create` output |

**Credentials file delivery (mandatory):** Write credentials to a chmod-600
markdown file OUTSIDE git-tracked directories (e.g. `~/codflow-credentials.md`
or `/tmp/codflow-setup-<timestamp>.md`). Place every value inside a fenced code
block so humans can copy-paste them without trailing-space login failures. Extract values programmatically from `.dev.vars` or source files; never retype from memory. Delete temporary secret files afterward. Show credentials in chat output at most once.

Example credentials file structure:

```markdown
# CodFlow Setup Credentials — <project-name>

## Admin User
- **Email:** `admin@example.com`
- **Password:**
  ```
  <actual-password>
  ```

## API Keys
- **BETTER_AUTH_SECRET:**
  ```
  <base64-value>
  ```
- **MCP_LOGIN_TICKET_SECRET:**
  ```
  <hex-value>
  ```
- **STORE_API_KEY:**
  ```
  <base64url-value>
  ```

## Deployed URLs
- Dashboard: https://<dashboard-url>
- API Server: https://<cod-server-url>
- Storefront: https://<theme01-url>

**Security:** This file contains sensitive credentials. Store it securely and delete after transferring values to a password manager.
```

---

## Running the Stack Locally During Development

The `npm run dev` scripts execute Workers on the local machine with
Miniflare-emulated storage persisted to `<repo-root>/.wrangler-shared` — they
do not read the deployed D1. To boot all three services locally:

```bash
cd cod-server && npm run db:migrate:local && STORE_API_KEY=<key> npm run db:seed:local
cd ../cod-client-astro && ADMIN_EMAIL=… ADMIN_NAME=Admin npm run seed:admin
```

Then start one terminal per service:

| Package | Directory | Command | URL |
| :--- | :--- | :--- | :--- |
| API Server | `cod-server` | `npm run dev` | http://localhost:8787 (docs at `/api/docs`) |
| Dashboard | `cod-client-astro` | `npm run dev` | http://localhost:4321 |
| Storefront | `cod-astro/theme01` | `npm run dev` | http://localhost:4321 — run `astro dev --port 4322` when the dashboard is up |

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
| **theme01 dev dies: `Missing field 'moduleType'`** | Dual Vite majors | Root `package.json` overrides pin `vite` to ^8.2.2 (root-only — npm ignores child overrides). `rm -rf node_modules && npm ci`; `npm ls vite` must show one major. |
| **Storefront deployed but products empty** | Worker→Worker fetch between two `*.workers.dev` hosts blocked (CF error 1042) | Put cod-server on a custom domain/route, set `COD_SERVER_URL`, redeploy theme01. Local dev unaffected. |
| **Sign-in returns 500 `Secondary-storage rate limiting requires SecondaryStorage.increment`** | auth server swapped back to `withCloudflare({ kv })` shortcut | Keep the full custom `secondaryStorage` in `cod-client-astro/src/lib/auth/server.ts`; better-auth-cloudflare@0.3.1 lacks `increment`. |
| **Sign-in returns 401 with correct credentials** | Admin row predates better-auth 1.7 semantics (missing `issuer`, `account_id = email`) | Apply migration 0010, re-run `npm run seed:admin:remote`. |
| **get-session 500: field "alg" does not exist in "jwkss"** | Migration 0011 missing on that database | Run `npm run db:migrate:remote` (or `:local`). |
| **Sign-in works but every API call returns 401** | `BETTER_AUTH_SECRET` differs between cod-server and cod-client-astro — the dashboard-issued JWT fails cod-server's JWKS verification | Set the identical secret on both workers. |
| **theme01 boots then wedges/crashes at first render: `optimized dependencies changed. reloading`** | Late SSR dep discovery races the workerd reload ([astro#16933](https://github.com/withastro/astro/issues/16933)) | Keep `vite.environments.ssr.optimizeDeps` (`noDiscovery: true` + excludes) in `astro.config.mjs`. |
| **`Address already in use :8787`** | Another checkout's wrangler holds the port (see Prerequisites port preflight) | Identify via `ps -p <pid>`, confirm with human, then kill that process tree. |
| **`Another astro dev server is already running`** | Astro 7 dev lockfile left behind | `npx astro dev stop` (or kill the stale process). |
| **Astro behaves unexpectedly under an agent (backgrounded, JSON output)** | Astro auto-enables background+JSON mode when `AGENT`, `CLAUDE_CODE_*`, or `OPENCODE` env vars are present | Humans get foreground behavior; agents should use `npx astro dev status` / `logs` / `stop`. |
| **`wrangler login` fails in headless/SSH** | No GUI browser available | Run `npx wrangler login` on a local machine, or configure `CLOUDFLARE_API_TOKEN` in the environment. |
| **`wrangler r2 bucket create` fails** | R2 subscription not enabled on Cloudflare account | Navigate to dash.cloudflare.com → R2, add a payment card to activate the Free Tier, then retry. |
| **Local D1 split-brain / missing tables** | Wrangler ran without `--persist-to` | Always run local migrations and commands with `--persist-to ../.wrangler-shared`. cod-client-astro's astro dev reads the same path via the adapter's `persistState`. |
| **Better Auth 500 on sign-in** | `BETTER_AUTH_SECRET` missing | Ensure `BETTER_AUTH_SECRET` is set in `cod-client-astro/.dev.vars` (local) or via `wrangler secret put` (production). |
| **Image uploads fail in browser** | R2 CORS not configured for PUT requests | Cloudflare dashboard → R2 → bucket → Settings → CORS Policy. Add the JSON from Step 3b with your dashboard domain in `AllowedOrigins`. |
| **Presign returns 500 with missing credentials error** | `CF_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, or `R2_SECRET_ACCESS_KEY` not set on the Worker | Run `wrangler secret put` for all three on the cod-server worker, then redeploy. |
| **`publicUrl` points to Worker URL instead of media domain** | `MEDIA_DOMAIN` not set in `wrangler.toml` or worker not redeployed after setting it | Set `MEDIA_DOMAIN` in `[vars]` and redeploy cod-server. For theme01 image resizing, also set `MEDIA_DOMAIN` as a secret on the storefront worker and redeploy. |

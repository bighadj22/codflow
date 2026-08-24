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
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler d1 create <project>-db           # capture database_id
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler r2 bucket create <project>-images
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler kv namespace create RATE_LIMIT_KV --binding RATE_LIMIT_KV  # capture id
```

Rules:
- Always create new resources for this setup. Never bind to a resource that
  already exists in the account — it may belong to another application or
  store, and running migrations/seed against it would write into foreign data.
- **Unique names apply to WORKER names, not just resources.** Default worker
  `name` fields in wrangler configs (`codflow-server`, `codflow-main`/dashboard,
  `cod-astro-theme01`) collide across clones, and deploying silently overwrites
  another installation. Require the developer to choose a unique prefix (e.g.
  `mystore-server`, `mystore-dashboard`, `mystore-theme01`) and update the
  `name` field in all three wrangler files before first deploy. This prevents
  cross-clone overwrite.
- If a resource name is taken, do not reuse the existing resource: choose a
  fresh, unique name (e.g. append the store name or a short suffix) and create
  again.
- Capture the D1 `database_id` (UUID) and KV `id` (32-hex) from command
  output. If parsing fails → hard stop, print the raw output, ask the
  developer. Never fall back to placeholder values.
- One KV namespace serves both workers (binding name differs per file:
  `RATE_LIMIT` in cod-server, `RATE_LIMIT_KV` in cod-client — only the
  namespace `id` matters).

## Step 3 — Bind Real IDs into BOTH wrangler.toml Files

```bash
cp cod-server/wrangler.toml.example cod-server/wrangler.toml
cp cod-client/wrangler.toml.example cod-client/wrangler.toml
```

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

**Propagate renamed D1 database through scripts:** If the database name differs
from `codflow-db`, it is hardcoded in multiple locations that must be updated:
- `cod-server/package.json`: `db:migrate:local` and `db:migrate:remote` scripts
- `cod-server/scripts/seed-local.mjs`: both `--local` and `--remote` wrangler
  d1 execute calls
- `cod-client/scripts/seed-admin.mjs`: both `--local` and `--remote` wrangler
  d1 execute calls

After updating, grep the repo to confirm only README/doc mentions of the old
name remain:

```bash
grep -r "codflow-db" --exclude-dir=node_modules --exclude-dir=.git
# expected: only documentation files, zero script/config hits
```

Confirm the filled `wrangler.toml` files are not tracked by git:

```bash
git status cod-server/wrangler.toml cod-client/wrangler.toml
# expected: nothing listed (both ignored)
```

If either file appears in `git status`, stop — the `.gitignore` is not applied
correctly. Do not continue until both are untracked.

While editing, also replace the example domains in `[vars]` /
`[env.production.vars]` (`WORKER_URL`, `BETTER_AUTH_URL`, `WORKER_SELF_URL`,
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WORKER_URL`, `ALLOWED_ORIGINS`) with the
developer's real URLs when they are known; localhost defaults are correct for
local runs. In `cod-astro/theme01/wrangler.jsonc`, set `COD_SERVER_URL` to the
cod-server public URL before deploying the storefront (localhost default is
correct for local dev only).

## Step 3b — Configure R2 for Image Uploads

This step requires two one-time actions in the Cloudflare dashboard. Both must
be done before the merchant dashboard can upload product images.

### 1. Add a custom domain to the R2 bucket

Cloudflare dashboard → R2 → `<project>-images` → Settings → Custom Domains →
Connect Domain. Enter the media subdomain (e.g. `media.yourdomain.com`).
Cloudflare adds the DNS record automatically. Wait for status to show Active.

Then set `MEDIA_DOMAIN` in `cod-server/wrangler.toml [vars]` to that hostname
(no scheme):

```toml
MEDIA_DOMAIN = "media.yourdomain.com"
```

### 2. Set the CORS policy on the bucket

Cloudflare dashboard → R2 → `<project>-images` → Settings → CORS Policy →
Add CORS policy. Paste this JSON, replacing the origin with the actual
dashboard domain:

```json
[
  {
    "AllowedOrigins": [
      "https://app.yourdomain.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Without this, browser presigned PUT requests are blocked by CORS and all image
uploads fail.

### 3. Create R2 API tokens

Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API Token.

- Permissions: **Object Read & Write**
- Bucket: the bucket created in Step 2

Copy the `Access Key ID` and `Secret Access Key` — shown once. After
cod-server is deployed (Step 6), set them as secrets:

```bash
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put CF_ACCOUNT_ID --name <server-worker-name>
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put R2_ACCESS_KEY_ID --name <server-worker-name>
env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put R2_SECRET_ACCESS_KEY --name <server-worker-name>
```

For local dev, add these to `cod-server/.dev.vars`:

```
CF_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<key-id>
R2_SECRET_ACCESS_KEY=<secret>
MEDIA_DOMAIN=media.yourdomain.com
```

### 4. Set MEDIA_DOMAIN on the storefront worker

After theme01 is deployed (Step 6), set the secret and redeploy:

```bash
printf 'media.yourdomain.com' | env -u CLOUDFLARE_ACCOUNT_ID npx wrangler secret put MEDIA_DOMAIN --name <theme01-worker-name>
cd cod-astro/theme01 && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy
```

### Verify

After all workers are deployed and secrets are set:

```bash
# Should return { success: true, data: { presignedUrl, key, publicUrl } }
curl -s -X POST https://<api-domain>/api/images/presign \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <admin-api-key>" \
  -d '{"contentType":"image/jpeg"}'
```

`publicUrl` must start with `https://media.yourdomain.com/` — if it shows the
Worker URL instead, `MEDIA_DOMAIN` is not set or the worker was not redeployed.

---

## Step 4 — Generate Keys & Configure Secrets

Generate both keys once and keep them:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # STORE_API_KEY
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
rm /tmp/secret.txt

# Repeat for cod-client and theme01 STORE_API_KEY
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

cd ../cod-client
ADMIN_EMAIL=admin@example.com ADMIN_NAME=Admin node scripts/seed-admin.mjs <password> --remote
```

Notes:
- `db:migrate:local` must run before `seed-admin.mjs`: the script seeds the
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
cd ../cod-client        && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy     # opennextjs-cloudflare build && deploy
cd ../cod-astro/theme01 && env -u CLOUDFLARE_ACCOUNT_ID npm run deploy     # astro build && wrangler deploy
```

**After deploy, replace localhost URL vars with real deployed URLs and
redeploy:** Once workers are live, set `NEXT_PUBLIC_APP_URL` /
`NEXT_PUBLIC_WORKER_URL` (cod-client wrangler.toml `[vars]`), `WORKER_URL`,
`WORKER_SELF_URL`, `BETTER_AUTH_URL` (cod-server wrangler.toml `[vars]`), and
`COD_SERVER_URL` (theme01 wrangler.jsonc) to the actual deployed URLs, then
redeploy affected workers. Skipping this causes browser sign-in failures
(R6/R7).

Smoke-test after each deploy; do not continue past a failing check:

| Worker | Check | Expectation |
| :--- | :--- | :--- |
| cod-server | `curl -s -o /dev/null -w "%{http_code}" https://<workers-url>/api/docs` | `200` |
| cod-client sign-in API | `curl -s -X POST https://<dashboard-url>/api/auth/sign-in/email -H "Content-Type: application/json" -H "Origin: https://<dashboard-url>" -d '{"email":"<admin>","password":"<pass>"}'` | `200` + user JSON (401 = credentials/schema issue, 500 = config, **403 `INVALID_ORIGIN` = R6 not applied**) |
| cod-client UI | open the workers URL | login page loads |
| cod-astro/theme01 | open the workers URL | homepage renders |

**CRITICAL — Origin header in sign-in tests:** Plain curl omits the `Origin`
header; Better Auth skips its origin check and returns 200, while every real
browser request gets `403 INVALID_ORIGIN` (which the UI masks as "Invalid email
or password"). The canonical sign-in check MUST send
`-H "Origin: https://<dashboard-url>"` and expect 200 + user JSON. If browser
login fails but curl without Origin passes, `NEXT_PUBLIC_APP_URL` still points
to localhost — apply R6, redeploy, and retest with the Origin header.

**Diagnose unclear failures with `wrangler tail`:** Run
`env -u CLOUDFLARE_ACCOUNT_ID npx wrangler tail <worker-name> --format pretty`
in the background, have the human retry the failing operation, then read the
log — the true error surfaces there, not in UI text.

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
| **theme01 boots then wedges/crashes at first render: `optimized dependencies changed. reloading`** | Late SSR dep discovery races the workerd reload ([astro#16933](https://github.com/withastro/astro/issues/16933)) | Keep `vite.environments.ssr.optimizeDeps` (`noDiscovery: true` + excludes) in `astro.config.mjs`. |
| **`Address already in use :8787`** | Another checkout's wrangler holds the port (see Prerequisites port preflight) | Identify via `ps -p <pid>`, confirm with human, then kill that process tree. |
| **`Another astro dev server is already running`** | Astro 7 dev lockfile left behind | `npx astro dev stop` (or kill the stale process). |
| **Astro behaves unexpectedly under an agent (backgrounded, JSON output)** | Astro auto-enables background+JSON mode when `AGENT`, `CLAUDE_CODE_*`, or `OPENCODE` env vars are present | Humans get foreground behavior; agents should use `npx astro dev status` / `logs` / `stop`. |
| **`wrangler login` fails in headless/SSH** | No GUI browser available | Run `npx wrangler login` on a local machine, or configure `CLOUDFLARE_API_TOKEN` in the environment. |
| **`wrangler r2 bucket create` fails** | R2 subscription not enabled on Cloudflare account | Navigate to dash.cloudflare.com → R2, add a payment card to activate the Free Tier, then retry. |
| **Local D1 split-brain / missing tables** | Wrangler ran without `--persist-to` | Always run local migrations and commands with `--persist-to ../.wrangler-shared`. |
| **Better Auth 500 on sign-in** | `BETTER_AUTH_SECRET` missing | Ensure `BETTER_AUTH_SECRET` is set in `cod-client/.dev.vars` (local) or via `wrangler secret put` (production). |
| **Image uploads fail in browser** | R2 CORS not configured for PUT requests | Cloudflare dashboard → R2 → bucket → Settings → CORS Policy. Add the JSON from Step 3b with your dashboard domain in `AllowedOrigins`. |
| **Presign returns 500 with missing credentials error** | `CF_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, or `R2_SECRET_ACCESS_KEY` not set on the Worker | Run `wrangler secret put` for all three on the cod-server worker, then redeploy. |
| **`publicUrl` points to Worker URL instead of media domain** | `MEDIA_DOMAIN` not set in `wrangler.toml` or worker not redeployed after setting it | Set `MEDIA_DOMAIN` in `[vars]` and redeploy cod-server. For theme01 image resizing, also set `MEDIA_DOMAIN` as a secret on the storefront worker and redeploy. |

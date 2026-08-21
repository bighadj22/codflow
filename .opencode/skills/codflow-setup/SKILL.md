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
   - If Cloudflare Cloud is selected: Verify `npx wrangler whoami` and remind about the R2 card-on-file activation.
2. **Execute Setup Autonomously:**
   - Install dependencies in strict order (`cod-shared` first).
   - Configure `.dev.vars` with cryptographic keys.
   - Run D1 migrations to shared state (`.wrangler-shared` for local, or remote D1).
   - Seed sample products, categories, 58-wilaya shipping rates, and store API key.
   - Create admin credentials with Better Auth hashed passwords.
3. **Verify the Running Services:**
   - Verify Backend API & Swagger Docs: `http://localhost:8787/api/docs`.
   - Verify Merchant Dashboard: `http://localhost:3000`.
   - Verify Storefront: `http://localhost:4321`.

---

## Quick Automation Scripts

The skill includes pre-tested, zero-assumption automation scripts in `scripts/`:

### 1. Automated Local Setup (One Command)
```bash
node .agents/skills/codflow-setup/scripts/setup-local.mjs

# Or with custom admin parameters:
ADMIN_EMAIL=you@example.dz ADMIN_NAME="Store Owner" node .agents/skills/codflow-setup/scripts/setup-local.mjs
```

### 2. Automated Cloudflare Remote Provisioning
```bash
# Verify authentication first:
npx wrangler whoami || npx wrangler login

# Run automated provisioning:
PROJECT_NAME=mystore ADMIN_EMAIL=admin@mystore.dz node .agents/skills/codflow-setup/scripts/setup-cloudflare.mjs
```

---

## Detailed Step-by-Step Runbook (Manual / Autonomous Execution)

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

# 4. Storefront Theme (cod-astro)
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

Open three terminals or launch background processes:

| Package | Directory | Command | URL | Description |
| :--- | :--- | :--- | :--- | :--- |
| **API Server** | `cod-server` | `npm run dev` | `http://localhost:8787` | Hono Worker, OpenAPI at `/api/docs`, MCP at `/mcp` |
| **Dashboard** | `cod-client` | `npm run dev` | `http://localhost:3000` | Next.js 16 Merchant UI (Sign in with admin credentials) |
| **Storefront** | `cod-astro/theme01` | `npm run dev` | `http://localhost:4321` | Astro 7 COD Storefront (Place test orders) |

---

## Cloudflare Remote Provisioning & Production Setup

When deploying to a live Cloudflare account:

### 1. Authenticate with Cloudflare
```bash
npx wrangler whoami
# If not authenticated, run:
npx wrangler login
```

### 2. Verify R2 Activation & Provision Cloudflare Resources
```bash
# 1. Create D1 Database (save the database_id from output)
npx wrangler d1 create codflow-db

# 2. Create R2 Image Bucket (ensure card is on file in dash.cloudflare.com → R2)
npx wrangler r2 bucket create codflow-images

# 3. Create KV Namespace for Rate Limiting & Auth Cache (save the id)
npx wrangler kv namespace create RATE_LIMIT_KV
```

### 3. Bind Resources in `wrangler.toml` Files

- In `cod-server/wrangler.toml`:
  - Set `[[d1_databases]]`: `database_name = "codflow-db"`, `database_id = "<your-d1-uuid>"`
  - Set `[[r2_buckets]]`: `bucket_name = "codflow-images"`
  - Set `[[kv_namespaces]]`: `id = "<your-kv-id>"`
- In `cod-client/wrangler.toml`:
  - Set `[[d1_databases]]`: `database_name = "codflow-db"`, `database_id = "<your-d1-uuid>"`
  - Set `[[kv_namespaces]]`: `id = "<your-kv-id>"`

### 4. Upload Cloudflare Production Secrets
```bash
# 1. Set Auth Secret on Server and Dashboard
cd cod-server
echo "<BETTER_AUTH_SECRET>" | npx wrangler secret put BETTER_AUTH_SECRET

cd ../cod-client
echo "<BETTER_AUTH_SECRET>" | npx wrangler secret put BETTER_AUTH_SECRET

# 2. Set Store Key and Server URL on Storefront
cd ../cod-astro/theme01
echo "<STORE_API_KEY>" | npx wrangler secret put STORE_API_KEY
echo "https://api.yourdomain.com" | npx wrangler secret put COD_SERVER_URL
```

### 5. Apply Migrations & Seed Remote Admin
```bash
# Apply schema to remote Cloudflare D1
cd ../cod-server
npm run db:migrate:remote

# Seed remote admin user
cd ../cod-client
ADMIN_EMAIL=admin@yourdomain.com ADMIN_NAME=Admin node scripts/seed-admin.mjs <password> --remote
```

### 6. Deploy Workers
```bash
cd ../cod-server && npm run deploy
cd ../cod-client && npm run deploy
cd ../cod-astro/theme01 && npm run deploy
```

---

## Troubleshooting & Common Traps

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **`wrangler login` fails in headless/SSH** | No GUI browser available | Run `npx wrangler login` on a local machine, or configure `CLOUDFLARE_API_TOKEN` in the environment. |
| **`wrangler r2 bucket create` fails** | R2 subscription not enabled on Cloudflare account | Navigate to `https://dash.cloudflare.com → R2`, add a payment card to activate the Free Tier, then retry. |
| **Local D1 split-brain / missing tables** | Wrangler ran without `--persist-to` | Always run local migrations and commands with `--persist-to ../.wrangler-shared`. |
| **`npm test` fails after git pull** | `cod-shared` was not installed first | Run `cd cod-shared && npm install` before running tests in other packages. |
| **Better Auth 500 on sign-in** | `BETTER_AUTH_SECRET` missing | Ensure `BETTER_AUTH_SECRET` is set in `cod-client/.dev.vars` (local) or via `wrangler secret put` (production). |
| **Image uploads fail in browser** | R2 CORS not configured for PUT requests | Run `node scripts/setup-r2-cors.mjs` in `cod-server` with R2 API tokens. |

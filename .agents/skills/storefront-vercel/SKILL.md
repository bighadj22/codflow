---
name: storefront-vercel
description: >-
  Deploy or redeploy the CodFlow storefront (cod-astro/theme01) to Vercel — an AI agent
  following it configures the Vercel project with DEPLOY_TARGET=vercel, binds environment
  variables (COD_SERVER_URL, STORE_API_KEY, MEDIA_DOMAIN), builds and deploys using
  the Vercel CLI or Git integration, and verifies storefront functionality. Use when a developer
  wants to deploy the storefront to Vercel, switch from Cloudflare Workers to Vercel, or troubleshoot
  Vercel storefront deployments.
---

# CodFlow Storefront — Vercel Deployment Runbook

`cod-astro/theme01` is the customer-facing storefront theme for CodFlow (Astro 7).
While the CodFlow backend (`cod-server`) and merchant dashboard (`cod-client-astro`)
run on Cloudflare Workers (using D1, R2, and KV), the storefront supports dynamic
deployment targets (`DEPLOY_TARGET=vercel` or `DEPLOY_TARGET=cloudflare`).

Deploying the storefront to **Vercel** is often preferred because:
1. **Solves Cloudflare Error 1042 (Worker-to-Worker block):** When `cod-server` is deployed on a free `*.workers.dev` subdomain without a custom domain, Cloudflare blocks another Cloudflare Worker on `*.workers.dev` from fetching it. Vercel runs outside Cloudflare's internal network, allowing the storefront to fetch `cod-server` on `*.workers.dev` without needing a custom domain.
2. **Generous Global Edge Bandwidth:** Vercel includes generous bandwidth and Edge CDN caching for storefront traffic.
3. **Automatic Preview Deployments:** Every Git branch/PR can have its own preview URL for testing theme changes.

---

## Required Environment Variables

Before deploying, collect these values:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DEPLOY_TARGET` | **Mandatory.** Tells `astro.config.mjs` to use `@astrojs/vercel` | `vercel` |
| `COD_SERVER_URL` | **Mandatory.** Base URL of deployed `cod-server` API | `https://api.yourdomain.com` or `https://codflow-server.<account>.workers.dev` |
| `STORE_API_KEY` | **Mandatory.** Raw store API key matching the seeded key in D1 | Generated in `codflow-setup` Step 4 |
| `MEDIA_DOMAIN` | **Optional.** Custom domain for R2 image CDN | `media.yourdomain.com` |

> [!IMPORTANT]
> `STORE_API_KEY` is secret. It is used on the server side in SSR routes and API proxies. Never expose it in client-side bundles.

---

## Deployment Methods

Choose **Method 1 (Vercel CLI)** for automated/terminal deployments, or **Method 2 (Vercel Dashboard / Git)** for continuous deployment from GitHub.

---

### Method 1: Deploy via Vercel CLI (Recommended for AI Agents)

#### 1. Prerequisites
- Ensure Vercel CLI is accessible via `npx vercel` (or installed globally).
- Check authentication:
  ```bash
  npx vercel whoami
  ```
  If not logged in:
  - If a browser is available: `npx vercel login`
  - If headless/CI: Set `VERCEL_TOKEN` in the environment (`export VERCEL_TOKEN="<token>"`).

#### 2. Configure and Link Project
Navigate to the storefront directory:
```bash
cd cod-astro/theme01
```

Run initial setup:
```bash
npx vercel link
```
Follow the interactive prompts (or provide flags in non-interactive sessions):
- Link to existing project? `No` (or `Yes` if linking existing)
- Project name: `<project>-storefront` (e.g. `mystore-storefront`)
- In which directory is your code located? `./`

#### 3. Set Environment Variables
Add the required production environment variables using the CLI:

```bash
# 1. Deployment Target
printf "vercel" | npx vercel env add DEPLOY_TARGET production

# 2. Backend API URL (must start with https://)
printf "https://<your-cod-server-domain>" | npx vercel env add COD_SERVER_URL production

# 3. Store API Key
printf "<your-raw-store-api-key>" | npx vercel env add STORE_API_KEY production

# 4. Optional: Media Domain (if R2 custom domain is configured)
printf "<media.yourdomain.com>" | npx vercel env add MEDIA_DOMAIN production
```

*(Optional: also add them to `preview` and `development` environments if you plan to use preview branches).*

#### 4. Build and Deploy to Production
Execute production deployment with the Vercel adapter:

```bash
cd cod-astro/theme01
npx vercel --prod
```

Vercel will upload the project, execute `npm run build:vercel` (or `astro build` with `DEPLOY_TARGET=vercel`), compile the SSR serverless/edge functions, and provide the live production URL (e.g. `https://<project>-storefront.vercel.app`).

---

### Method 2: Deploy via Vercel Dashboard (Git Integration)

Use this method when connecting a GitHub / GitLab / Bitbucket repository:

1. **Import Repository in Vercel:**
   - In the Vercel Dashboard, click **Add New... → Project**.
   - Select the `codflow-os` repository.

2. **Configure Project Settings:**
   - **Project Name:** e.g. `codflow-storefront`
   - **Framework Preset:** `Astro`
   - **Root Directory:** Click **Edit** and choose `cod-astro/theme01`. Check the option **"Include source files outside of the Root Directory in the Build Step"** (needed because workspace dependencies resolve to root `node_modules`).
   - **Build Command:** Toggle **Override** and set:
     ```bash
     npm run build:vercel
     ```
     *(Or leave default `astro build` if `DEPLOY_TARGET=vercel` is set in Environment Variables).*
   - **Output Directory:** Leave default (`.vercel/output`).
   - **Install Command:** Leave default (`npm install` / root workspace install).

3. **Configure Environment Variables:**
   Under **Environment Variables**, add:
   - `DEPLOY_TARGET` = `vercel`
   - `COD_SERVER_URL` = `https://<your-cod-server-domain>`
   - `STORE_API_KEY` = `<your-raw-store-api-key>`
   - `MEDIA_DOMAIN` = `<media.yourdomain.com>` (optional)

4. **Deploy:**
   - Click **Deploy**. Vercel will build the workspace, bundle the Astro site with `@astrojs/vercel`, and assign a production URL.

---

## Verification & Smoke Testing

Once deployment completes, run these checks against the live Vercel URL:

| Target | Test Command / Action | Expected Result |
| :--- | :--- | :--- |
| **Homepage** | `curl -s -o /dev/null -w "%{http_code}" https://<storefront-url>` | `200` (HTML response) |
| **Catalog SSR** | Open `https://<storefront-url>/` in browser | Products load with images, prices, and title |
| **Product Detail** | Open `https://<storefront-url>/product/<slug>` | Product page renders with checkout / order form |
| **Cart / Order Flow** | Submit test order (or test modal) | Order registers and thank-you page displays |

### Test via Terminal:
```bash
# Verify homepage returns 200 OK
curl -s -I "https://<your-storefront>.vercel.app" | head -n 5

# Verify API connectivity through storefront proxy
curl -s "https://<your-storefront>.vercel.app/api/cart/validate" \
  -H "Content-Type: application/json" \
  -d '{"items":[]}'
# Expect valid JSON response
```

---

## Custom Domain Setup

To attach a custom domain to the Vercel storefront:
1. In Vercel Dashboard: Project → **Settings → Domains**.
2. Enter your domain (e.g. `store.yourdomain.com` or `yourdomain.com`).
3. Configure DNS records:
   - For subdomains (`store.yourdomain.com`): Add `CNAME` pointing to `cname.vercel-dns.com`.
   - For apex domain (`yourdomain.com`): Add `A` record pointing to `76.76.21.21`.
4. Wait for SSL certificate issuance (automatic via Let's Encrypt).

---

## Troubleshooting

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **Build fails: `Cannot find module '@astrojs/vercel'`** | Missing dependency in `cod-astro/theme01` | Run `npm install @astrojs/vercel --workspace=cod-astro-theme01` at repository root. |
| **Build produces Cloudflare output instead of Vercel output** | `DEPLOY_TARGET` not set to `vercel` | Ensure `DEPLOY_TARGET=vercel` is present in Vercel environment variables, or run `npm run build:vercel`. |
| **Storefront loads but shows empty products / error banner** | `COD_SERVER_URL` incorrect or unreachable | Confirm `COD_SERVER_URL` has `https://` prefix and matches the live API worker. Verify `curl https://<api-url>/api/docs` returns 200. |
| **Orders fail with 401 Unauthorized** | `STORE_API_KEY` mismatch | The value in Vercel `STORE_API_KEY` must match the key seeded into the D1 database in `codflow-setup` Step 5. Re-check or update the secret in Vercel. |
| **Monorepo build fails to resolve shared packages** | Vercel root directory configuration | If using Git integration, ensure **"Include source files outside of the Root Directory"** is enabled in Vercel project settings, or deploy via `npx vercel` inside `cod-astro/theme01`. |
| **Node.js version warning: `Node.js 26 is not supported`** | Vercel serverless functions support up to Node 24 | Normal warning on Node 26 development machines; Vercel automatically runs Node 24 in its cloud functions. |
| **Images do not load from R2** | `MEDIA_DOMAIN` misconfigured or missing CORS | Verify `MEDIA_DOMAIN` is set (hostname only, without `https://`). Ensure R2 bucket CORS policy allows requests from the Vercel domain. |

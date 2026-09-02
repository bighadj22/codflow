# Deploying to Cloudflare

Deploy CodFlow to production on Cloudflare Workers.

---

## Prerequisites

- Custom domain added to Cloudflare (recommended)
- Wrangler CLI authenticated: `wrangler login`
- R2 enabled on your Cloudflare account (requires payment card, free tier available)

---

## Production Resources

Create production resources with unique names:

```bash
wrangler d1 create <project>-prod-db
wrangler r2 bucket create <project>-prod-images
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create OAUTH_KV
```

**Save the IDs** from each command output.

**Important:** Always create new resources for each installation. Never reuse existing resources from other projects.

---

## Update wrangler.toml Files

Update resource IDs in both `cod-server/wrangler.toml` and `cod-client-astro/wrangler.toml`:

### cod-server/wrangler.toml

```toml
name = "mystore-api"  # Choose unique worker name

[[d1_databases]]
binding = "DB"
database_id = "your-production-database-id"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "<project>-prod-images"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "your-kv-namespace-id"

[[kv_namespaces]]
binding = "OAUTH_KV"
id = "your-oauth-kv-namespace-id"
```

### cod-client-astro/wrangler.toml

```toml
name = "mystore-dashboard"  # Choose unique worker name

[[d1_databases]]
binding = "DB"
database_id = "your-production-database-id"  # Same as cod-server

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"  # Separate namespace from cod-server's

[vars]
PUBLIC_APP_URL = "https://dashboard.yourdomain.com"
PUBLIC_API_URL = "https://api.yourdomain.com"
PUBLIC_TRUSTED_ORIGINS = "https://mystore-dashboard.<your-subdomain>.workers.dev,https://dashboard.yourdomain.com"
```

Also set the build-time client env (used by the browser API client):

```bash
cd cod-client-astro
cp .env.example .env
# edit .env → PUBLIC_API_URL="https://api.yourdomain.com"
```

**Verify no placeholders remain:**

```bash
grep -rn "00000000-0000\|00000000000000000000000000000000" \
  cod-server/wrangler.toml cod-client-astro/wrangler.toml
```

Expected: no matches.

---

## Apply Migrations & Seed Data

**Both local and remote migrations must run:**

```bash
cd cod-server
npm run db:migrate:local   # REQUIRED first
npm run db:migrate:remote  # MANDATORY - deployed sign-in fails without this
STORE_API_KEY=<your-store-key> npm run db:seed:remote
```

The remote migration is **critical**. Without it, Better Auth will fail with 500 errors (`field "alg" does not exist`).

---

## Create Admin Account

```bash
cd cod-client-astro
ADMIN_EMAIL=admin@yourdomain.com ADMIN_NAME=Admin npm run seed:admin:remote
```

**Save the output** - it shows your admin password and API key (displayed once).

---

## Deploy Workers

Deploy in order:

```bash
cd cod-server && npm run deploy
cd ../cod-client-astro && npm run build && npm run deploy
cd ../cod-astro/theme01 && npm run build && npm run deploy
```

**After first deploy, update URLs and redeploy:**

1. Get your deployed worker URLs from the deploy output
2. Update these in the configs:
   - `PUBLIC_APP_URL` + `PUBLIC_TRUSTED_ORIGINS` (cod-client-astro wrangler.toml) → your dashboard URL
   - `.env` `PUBLIC_API_URL` (cod-client-astro) → your API URL — then **rebuild** (it is baked into the client bundle)
   - `WORKER_URL`, `BETTER_AUTH_URL`, `WORKER_SELF_URL` (cod-server wrangler.toml) → your API + dashboard URLs
   - `COD_SERVER_URL` (cod-astro/theme01/wrangler.jsonc) → your API URL
3. Redeploy affected workers

---

## Set Secrets

**Generate keys:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # STORE_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"       # MCP_LOGIN_TICKET_SECRET
```

**Set secrets (use temp file for security):**

```bash
# Backend
cd cod-server
echo "<BETTER_AUTH_SECRET>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put BETTER_AUTH_SECRET < /tmp/secret.txt
echo "<STORE_API_KEY>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put STORE_API_KEY < /tmp/secret.txt
echo "<MCP_LOGIN_TICKET_SECRET>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put MCP_LOGIN_TICKET_SECRET < /tmp/secret.txt
rm /tmp/secret.txt

# Dashboard (BETTER_AUTH_SECRET + MCP_LOGIN_TICKET_SECRET MUST match backend)
cd ../cod-client-astro
echo "<BETTER_AUTH_SECRET>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put BETTER_AUTH_SECRET < /tmp/secret.txt
echo "<MCP_LOGIN_TICKET_SECRET>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put MCP_LOGIN_TICKET_SECRET < /tmp/secret.txt
rm /tmp/secret.txt

# Storefront
cd ../cod-astro/theme01
echo "<STORE_API_KEY>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put STORE_API_KEY < /tmp/secret.txt
rm /tmp/secret.txt
```

**Critical:** `BETTER_AUTH_SECRET` and `MCP_LOGIN_TICKET_SECRET` must be
identical in both cod-server and cod-client-astro (they share the auth D1 and
the MCP login-ticket relay).

---

## R2 Image Upload Setup

For product image uploads to work, you need:

### 1. Get R2 Credentials

1. **Cloudflare Account ID:** Dashboard → top-right account menu
2. **R2 API Token:** Dashboard → R2 → Manage R2 API Tokens → Create API Token
   - Permissions: Object Read & Write
   - Bucket: your images bucket
   - **Copy both Access Key ID and Secret Access Key** (shown once)

### 2. Add Custom Domain to R2 Bucket

Dashboard → R2 → your bucket → Settings → Custom Domains → Connect Domain

Enter your media subdomain (e.g., `media.yourdomain.com`)

### 3. Set CORS Policy

Dashboard → R2 → your bucket → Settings → CORS Policy → Add CORS policy

Paste this JSON (replace with your dashboard domain):

```json
[
  {
    "AllowedOrigins": [
      "https://dashboard.yourdomain.com"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 4. Update wrangler.toml

In `cod-server/wrangler.toml` `[vars]`:

```toml
MEDIA_DOMAIN = "media.yourdomain.com"  # no scheme, hostname only
```

### 5. Set R2 Secrets on cod-server

```bash
cd cod-server
echo "<CF_ACCOUNT_ID>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put CF_ACCOUNT_ID < /tmp/secret.txt
rm /tmp/secret.txt

# Repeat for R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY
```

### 6. Set MEDIA_DOMAIN on Storefront

```bash
cd cod-astro/theme01
echo "media.yourdomain.com" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put MEDIA_DOMAIN < /tmp/secret.txt
rm /tmp/secret.txt
```

### 7. Redeploy Both Workers

```bash
cd cod-server && npm run deploy
cd ../cod-astro/theme01 && npm run build && npm run deploy
```

**Full R2 setup details:** [cod-server/src/endpoints/images/README.md](../cod-server/src/endpoints/images/README.md)

---

## Custom Domains

**Critical:** Cloudflare blocks Worker→Worker fetch on `*.workers.dev` (error 1042). Deploy at least cod-server to a custom domain.

### Add Custom Domains

Cloudflare dashboard:
1. **Workers & Pages** → Your worker
2. **Settings** → **Domains & Routes**
3. **Add** → **Custom Domain**
4. Enter: `api.yourdomain.com` (backend), `dashboard.yourdomain.com` (dashboard), `shop.yourdomain.com` (storefront)

After custom domains are active, update URLs in the wrangler configs and redeploy.

---

## Verify Deployment

### Check Each Worker

```bash
# Backend
curl -s -o /dev/null -w "%{http_code}" https://api.yourdomain.com/api/docs
# Expected: 200

# Dashboard sign-in API (include Origin header!)
curl -s -X POST https://dashboard.yourdomain.com/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -H "Origin: https://dashboard.yourdomain.com" \
  -d '{"email":"admin@yourdomain.com","password":"<your-password>"}'
# Expected: 200 + user JSON (not 403 INVALID_ORIGIN)
```

**If sign-in returns 403 `INVALID_ORIGIN`:** your dashboard origin is missing
from `PUBLIC_TRUSTED_ORIGINS` in `cod-client-astro/wrangler.toml`. Update it
and redeploy.

Visit your dashboard and storefront URLs to verify UI loads correctly.

---

## Monitoring

### View Logs

```bash
wrangler tail <worker-name>
```

Or in Cloudflare dashboard:
**Workers & Pages** → Your worker → **Logs**

### Diagnose Failures

If something isn't working:

```bash
wrangler tail <worker-name> --format pretty
```

Run this in the background, then retry the failing operation. The real error will appear in the logs.

---

## Rollback

```bash
wrangler deployments list
wrangler rollback --message "Rolling back due to X"
```

---

## Backup Database

```bash
wrangler d1 export <project>-prod-db --output backup-$(date +%Y%m%d).sql
```

Schedule regular backups via Cloudflare Cron Triggers.

---

## Troubleshooting

**"Worker threw exception"**
Run `wrangler tail <worker-name>` and check for missing secrets or config errors.

**"Failed to fetch" from storefront**
Both workers on `workers.dev`? Move at least cod-server to custom domain.

**Dashboard won't authenticate (500 error)**
Run `npm run db:migrate:remote` - Better Auth 1.7 requires migration 0011.

**Dashboard shows 403 `INVALID_ORIGIN` on sign-in**
Add your dashboard domain to `PUBLIC_TRUSTED_ORIGINS` in
`cod-client-astro/wrangler.toml` and redeploy.

**Dashboard signs in but API calls fail (401)**
`BETTER_AUTH_SECRET` differs between cod-server and cod-client-astro — the
JWT the dashboard issues must be verifiable by cod-server's JWKS check. Set
the same secret on both workers.

**Image uploads fail**
Check CORS policy on R2 bucket includes your dashboard domain and allows PUT requests.

---

## Related Docs

- [CONFIGURATION.md](./CONFIGURATION.md) — All environment variables
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture
- [cod-server/src/endpoints/images/README.md](../cod-server/src/endpoints/images/README.md) — Complete R2 setup guide

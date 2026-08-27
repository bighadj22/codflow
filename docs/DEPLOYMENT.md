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
wrangler kv namespace create RATE_LIMIT_KV_PROD
```

**Save the IDs** from each command output.

**Important:** Always create new resources for each installation. Never reuse existing resources from other projects.

---

## Update wrangler.toml Files

Update resource IDs in both `cod-server/wrangler.toml` and `cod-client/wrangler.toml`:

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
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"
```

### cod-client/wrangler.toml

```toml
name = "mystore-dashboard"  # Choose unique worker name

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"  # Can be same or different

[[d1_databases]]
binding = "DB"
database_id = "your-production-database-id"  # Same as cod-server
```

**Verify no placeholders remain:**

```bash
grep -rn "00000000-0000\|00000000000000000000000000000000" \
  cod-server/wrangler.toml cod-client/wrangler.toml
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
cd cod-client
ADMIN_EMAIL=admin@yourdomain.com ADMIN_NAME=Admin node scripts/seed-admin.mjs <password> --remote
```

**Save the output** - it shows your admin password and API key (displayed once).

---

## Deploy Workers

Deploy in order:

```bash
cd cod-server && npm run deploy
cd ../cod-client && npm run deploy
cd ../cod-astro/theme01 && npm run deploy
```

**After first deploy, update URLs and redeploy:**

1. Get your deployed worker URLs from the deploy output
2. Update these in wrangler.toml files:
   - `NEXT_PUBLIC_APP_URL` (cod-client) → your dashboard URL
   - `NEXT_PUBLIC_WORKER_URL` (cod-client) → your API URL  
   - `WORKER_URL` (cod-server) → your API URL
   - `COD_SERVER_URL` (cod-astro/theme01/wrangler.jsonc) → your API URL
3. Redeploy affected workers

---

## Set Secrets

**Generate keys:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # STORE_API_KEY
```

**Set secrets (use temp file for security):**

```bash
# Backend
cd cod-server
echo "<BETTER_AUTH_SECRET>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put BETTER_AUTH_SECRET < /tmp/secret.txt
rm /tmp/secret.txt

# Dashboard (MUST match backend)
cd ../cod-client
echo "<BETTER_AUTH_SECRET>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put BETTER_AUTH_SECRET < /tmp/secret.txt
rm /tmp/secret.txt

# Storefront
cd ../cod-astro/theme01
echo "<STORE_API_KEY>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put STORE_API_KEY < /tmp/secret.txt
rm /tmp/secret.txt
```

**Critical:** `BETTER_AUTH_SECRET` must be identical in both cod-server and cod-client.

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
      "https://admin.yourdomain.com"
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
cd ../cod-astro/theme01 && npm run deploy
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
4. Enter: `api.yourdomain.com` (backend), `admin.yourdomain.com` (dashboard), `shop.yourdomain.com` (storefront)

After custom domains are active, update URLs in wrangler.toml files and redeploy.

---

## Verify Deployment

### Check Each Worker

```bash
# Backend
curl -s -o /dev/null -w "%{http_code}" https://api.yourdomain.com/api/docs
# Expected: 200

# Dashboard sign-in API (include Origin header!)
curl -s -X POST https://admin.yourdomain.com/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -H "Origin: https://admin.yourdomain.com" \
  -d '{"email":"admin@yourdomain.com","password":"<your-password>"}'
# Expected: 200 + user JSON (not 403 INVALID_ORIGIN)
```

**If sign-in returns 403 `INVALID_ORIGIN`:** Your `NEXT_PUBLIC_APP_URL` still points to localhost. Update it in `cod-client/wrangler.toml` and redeploy.

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
Update `NEXT_PUBLIC_APP_URL` in `cod-client/wrangler.toml` to your actual dashboard URL and redeploy.

**Image uploads fail**
Check CORS policy on R2 bucket includes your dashboard domain and allows PUT requests.

---

## Related Docs

- [CONFIGURATION.md](./CONFIGURATION.md) — All environment variables
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture
- [cod-server/src/endpoints/images/README.md](../cod-server/src/endpoints/images/README.md) — Complete R2 setup guide

# Configuration Reference

Environment variables and Cloudflare bindings.

---

## Configuration Files

```
cod-server/
├── wrangler.toml       # Cloudflare bindings (D1, R2, KV)
└── .dev.vars           # Local secrets (gitignored)

cod-client/
├── wrangler.toml       # Cloudflare bindings
└── .dev.vars           # Local secrets

cod-astro/theme01/
├── wrangler.jsonc      # Cloudflare config
└── .dev.vars           # Local secrets
```

---

## Generate Secrets

```bash
# BETTER_AUTH_SECRET (base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# STORE_API_KEY (base64url)
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

---

## Backend (cod-server)

### wrangler.toml

```toml
name = "mystore-api"  # Choose unique worker name

[vars]
WORKER_URL = "https://api.yourdomain.com"
WORKER_SELF_URL = "https://api.yourdomain.com"
BETTER_AUTH_URL = "https://admin.yourdomain.com/api/auth"
MEDIA_DOMAIN = "media.yourdomain.com"  # After R2 setup

[[d1_databases]]
binding = "DB"
database_id = "your-database-id"  # From: wrangler d1 create

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "mystore-prod-images"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-id"  # From: wrangler kv namespace create
```

### Secrets (via wrangler secret put)

**Required:**
```bash
wrangler secret put BETTER_AUTH_SECRET  # MUST match cod-client
```

**For R2 image uploads:**
```bash
wrangler secret put CF_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

### .dev.vars (local development)

```env
BETTER_AUTH_SECRET=<your-generated-secret>

# Optional - for local R2 presigned URL testing
CF_ACCOUNT_ID=<your-account-id>
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
MEDIA_DOMAIN=media.yourdomain.com
```

---

## Dashboard (cod-client)

### wrangler.toml

```toml
name = "mystore-dashboard"  # Choose unique worker name

[vars]
NEXT_PUBLIC_APP_URL = "https://admin.yourdomain.com"
NEXT_PUBLIC_WORKER_URL = "https://api.yourdomain.com"
ALLOWED_ORIGINS = "https://admin.yourdomain.com"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"

[[d1_databases]]
binding = "DB"
database_id = "your-database-id"  # Same as cod-server
```

### Secrets

```bash
wrangler secret put BETTER_AUTH_SECRET  # MUST match cod-server
```

### .dev.vars (local development)

```env
BETTER_AUTH_SECRET=<your-generated-secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

---

## Storefront (cod-astro/theme01)

### wrangler.jsonc

```jsonc
{
  "name": "mystore-store",
  "compatibility_date": "2025-01-21",
  "vars": {
    "COD_SERVER_URL": "https://api.yourdomain.com"
  }
}
```

### Secrets

```bash
wrangler secret put STORE_API_KEY  # From admin seed script
wrangler secret put MEDIA_DOMAIN   # After R2 setup (e.g., media.yourdomain.com)
```

### .dev.vars (local development)

```env
STORE_API_KEY=codflow-dev-store-key
COD_SERVER_URL=http://localhost:8787
```

---

## Critical Secrets

| Secret | Where | Must Match |
| :--- | :--- | :--- |
| `BETTER_AUTH_SECRET` | cod-server + cod-client | **YES** (must be identical) |
| `STORE_API_KEY` | Seed script → DB → cod-astro | **YES** (storefront uses seeded hash) |

---

## Setting Secrets Securely

**Never echo secrets into shell.** Use temp file with stdin redirect:

```bash
echo "<secret-value>" > /tmp/secret.txt && chmod 600 /tmp/secret.txt
wrangler secret put SECRET_NAME < /tmp/secret.txt
rm /tmp/secret.txt
```

List secrets (names only, not values):
```bash
wrangler secret list
```

Delete a secret:
```bash
wrangler secret delete SECRET_NAME
```

---

## Meta Pixel & Carrier APIs

**Not configured via environment variables.** Set via dashboard UI:

### Meta Pixel

1. Login to dashboard
2. **Settings** → **Meta Pixel**
3. Enter Pixel ID and Conversions API Access Token

Stored in D1 `settings` table.

### Carrier API Keys

1. **Settings** → **Delivery**
2. For each carrier (Yalidine, ZR Express, NOEST, EcoTrack):
   - Click **Configure**
   - Enter API credentials
   - Test connection

Stored in D1 `carrier_configs` table.

---

## R2 Image Upload Configuration

See [DEPLOYMENT.md](./DEPLOYMENT.md#r2-image-upload-setup) for complete R2 setup.

**Required:**
1. Custom domain on R2 bucket
2. CORS policy allowing PUT from dashboard domain
3. Secrets: `CF_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` on cod-server
4. `MEDIA_DOMAIN` in cod-server wrangler.toml `[vars]` and as secret on theme01
5. Redeploy both workers after configuration

---

## Local vs Production

### Local Development URLs

```
cod-server:  http://localhost:8787
cod-client:  http://localhost:3000
cod-astro:   http://localhost:4321
```

Local D1 database shared at `../.wrangler-shared/`

### Production URLs

Update these in wrangler.toml `[vars]` after first deploy:

```
cod-server:  https://api.yourdomain.com
cod-client:  https://admin.yourdomain.com
cod-astro:   https://shop.yourdomain.com
```

Then redeploy affected workers.

---

## Verify Configuration

### No Placeholders

```bash
grep -rn "00000000-0000\|00000000000000000000000000000000" \
  cod-server/wrangler.toml cod-client/wrangler.toml
```

Expected: no matches

### Secrets Set

```bash
wrangler secret list --name <worker-name>
```

Expected: `BETTER_AUTH_SECRET` (and R2 secrets if using image uploads)

---

## Troubleshooting

**"DB is not defined"**
Missing D1 binding in `wrangler.toml`. Add `[[d1_databases]]` with your database ID.

**"Failed to fetch" between workers**
Both on `workers.dev`? Deploy at least cod-server to custom domain.

**Dashboard authentication fails**
```bash
# Verify BETTER_AUTH_SECRET matches in both workers
wrangler secret list --name mystore-api
wrangler secret list --name mystore-dashboard
```

If they don't match, regenerate and set the same secret in both.

**Dashboard shows 403 `INVALID_ORIGIN`**
`NEXT_PUBLIC_APP_URL` in `cod-client/wrangler.toml` doesn't match your actual dashboard URL. Update and redeploy.

**Image uploads fail**
1. Check CORS policy on R2 bucket includes dashboard domain
2. Verify `MEDIA_DOMAIN` is set in cod-server wrangler.toml
3. Verify R2 secrets are set on cod-server worker

---

## Related Docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production deployment
- [cod-server/src/endpoints/images/README.md](../cod-server/src/endpoints/images/README.md) — Complete R2 setup

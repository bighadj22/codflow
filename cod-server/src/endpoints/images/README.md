# Images

Product and category images are stored in Cloudflare R2. The dashboard uploads
directly to R2 via presigned URLs (browser → R2, never through the Worker).
The storefront serves images through the R2 custom domain with Cloudflare Image
Resizing.

## How it works

1. Dashboard calls `POST /api/images/presign` with a MIME type.
2. Worker generates a signed R2 PUT URL (10-minute expiry) and returns
   `{ presignedUrl, key, publicUrl }`.
3. Browser PUTs the file directly to R2 using the presigned URL.
4. Dashboard calls `POST /api/products/:id/images` with `{ key, src: publicUrl }`
   to create the database record.
5. Storefront reads `src` from the database and serves it through
   `https://<MEDIA_DOMAIN>/...` — Cloudflare Image Resizing rewrites the URL to
   `/cdn-cgi/image/<params>/<key>` automatically.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/images/upload` | `products:manage` | Multipart upload through the Worker (≤ 10 MB) |
| `POST` | `/api/images/presign` | `products:manage` | Generate presigned URL for direct browser → R2 upload |
| `GET` | `/images/:key` | none | Serve image from R2 (fallback — prefer the R2 custom domain) |

The serve route (`GET /images/:key`) uses plain Hono (not OpenAPIHono) because
the `:key{.+}` regex param is required for keys containing slashes
(`products/abc.jpg`). A legacy OpenAPI documentation stub exists in
`openapi.ts`.

## Required secrets (cod-server)

Set these via `wrangler secret put` — never in `wrangler.toml`:

| Secret | Where to get it |
|--------|-----------------|
| `CF_ACCOUNT_ID` | Cloudflare dashboard → top-right account menu |
| `R2_ACCESS_KEY_ID` | R2 → Manage R2 API Tokens → Create API Token (Object Read & Write) |
| `R2_SECRET_ACCESS_KEY` | Same token creation — shown once |

`MEDIA_DOMAIN` and `R2_BUCKET_NAME` are non-secret and live in `wrangler.toml [vars]`.

## Required secret (cod-astro/theme01)

| Secret | Value |
|--------|-------|
| `MEDIA_DOMAIN` | Your R2 custom domain hostname, e.g. `media.yourdomain.com` |

Set via `wrangler secret put MEDIA_DOMAIN --name <theme01-worker-name>` then
redeploy the storefront.

## R2 bucket setup

Two one-time steps before image uploads work from a browser:

### 1. Add a custom domain to the R2 bucket

Cloudflare dashboard → R2 → your bucket → Settings → Custom Domains →
Connect Domain. Enter your media domain (e.g. `media.yourdomain.com`).
Cloudflare adds the DNS record automatically.

### 2. Set the CORS policy on the bucket

Cloudflare dashboard → R2 → your bucket → Settings → CORS Policy →
Add CORS policy. Paste this JSON (replace the origin with your dashboard domain):

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

Without this, browser presigned PUT requests are blocked by CORS and image
uploads fail silently.

## Files

```
images/
├── routes.ts     — upload + presign routers; plain-Hono serve router
├── handlers.ts   — uploadImage, serveImage, listProductImages, saveProductImage,
│                   reorderProductImages, deleteProductImage
├── presign.ts    — presigned URL generation via @aws-sdk/client-s3 S3Client
├── openapi.ts    — legacy OpenAPI stub for the serve route
└── *.test.ts     — unit + integration tests
```

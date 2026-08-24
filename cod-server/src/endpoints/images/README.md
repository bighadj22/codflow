# Images & Media Management API

A robust media management system powered by **Cloudflare R2** (S3-compatible object storage), supporting direct uploads, presigned URLs, and optimized public serving.

## Structure

```
images/
├── routes.ts       # Two routers: authed upload/presign (/api/images) + public plain-Hono serve route
├── handlers.ts     # Proxy upload, R2 serving, product-image record CRUD helpers
├── presign.ts      # S3-compatible presigned URL generation (10-minute expiry)
├── openapi.ts      # OpenAPI documentation paths (incl. the legacy serve-route entry)
├── *.test.ts       # Unit & integration tests
└── README.md       # This file
```

## Core Concepts

The system is designed to handle product images and other media assets with high performance and low latency by offloading storage and bandwidth to Cloudflare's edge.

### 1. Storage Backend (Cloudflare R2)
All images are stored in a Cloudflare R2 bucket. Access is managed through:
- **Binding:** The `IMAGES` bucket is bound directly to the worker for proxy uploads and serving.
- **S3 API:** The `presign` logic uses the AWS SDK S3 client to communicate with the R2 endpoint via `CF_ACCOUNT_ID` and access keys.

### 2. Upload Strategies

#### Strategy A: Server-Side Proxy (`POST /api/images/upload`)
The client sends a `multipart/form-data` request containing the file. The server validates type/size, loads the file into memory, and writes it to R2.
- **Pros:** Simple for small files; hides R2 credentials completely.
- **Cons:** Holds the whole file in Worker memory (bounded by the 10 MB cap).

#### Strategy B: Client-Side Direct (`POST /api/images/presign`)
The client requests a temporary "presigned" URL for a specific `contentType`. The server returns a URL that allows the browser to `PUT` the file directly to R2.
- **Pros:** Zero load on the Worker; handles large files efficiently.
- **Cons:** Requires the client to perform two steps (get URL, then upload).

## API Endpoints

### POST /api/images/upload
Upload an image directly through the server.
- **MIME Types:** `jpg`, `png`, `webp`, `gif`
- **Max Size:** 10 MB
- **Authorization:** Requires `products:manage` scope

### POST /api/images/presign
Generate a presigned URL for direct-to-R2 upload.
- **Request:** `{ "contentType": "image/webp" }`
- **Response:** `{ "presignedUrl": "...", "key": "...", "publicUrl": "..." }`
- **Authorization:** Requires `products:manage` scope

### GET /images/:key
Publicly serve an image from R2.
- **Caching:** Served with `immutable` cache-control headers (1 year).
- **Security:** Path traversal protection included. No authentication required for viewing.

## Integration with Products

While the files are stored in R2, their relationship with products is managed in the database (`product_images` table).

1. **Upload:** Client uploads via proxy or presigned URL and receives a `key`.
2. **Link:** Client calls `POST /api/products/:id/images` with the `key` to save the record in the DB.
3. **Display:** The DB record stores the `src` (public URL) which points to `/images/:key`.

## Configuration

The following environment variables/secrets are required for the **presign** functionality:
- `CF_ACCOUNT_ID`: Your Cloudflare account ID.
- `R2_ACCESS_KEY_ID`: R2 API access key.
- `R2_SECRET_ACCESS_KEY`: R2 API secret key.
- `R2_BUCKET_NAME`: The name of the bucket.
- `MEDIA_DOMAIN`: Custom domain for serving (e.g., `media.yourdomain.com`).

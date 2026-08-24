# Images Context

Getting product pictures into object storage and back out to shoppers fast: two upload strategies, one public serving route, and a strict split between the bytes in R2 and the database records that reference them.

## Language

### Storage

**R2 Bucket Binding**:
The single object-storage bucket wired directly into the Worker, used for both writing files and serving them.
_Avoid_: Media server, CDN config

**Object Key**:
The storage address of every image — `products/` plus an un-gapped UUID and the extension. Generated server-side in both upload strategies; clients never name their own files.
_Avoid_: File path, filename

**Immutable Media**:
Every image is written and served with one-year immutable cache headers. A stored image's content never changes; replacing means uploading under a new key.
_Avoid_: Editable asset, cache busting

### Upload Strategies

**Proxy Upload**:
Multipart upload through the Worker: validated against the type whitelist and the 10 MB cap, buffered in memory, then written to storage. Credentials never reach the client.
_Avoid_: Direct upload, streaming transfer

**Presigned Direct Upload**:
A ten-minute PUT URL handed to the browser so the file travels straight to storage, bypassing the Worker entirely. Requires S3-compatible credentials configured as secrets.
_Avoid_: Delegated auth, signed session

**Two-Step Linking**:
Uploading only stores bytes; a second call attaches the returned key to a product as a database record. Bytes and records are joined deliberately, never automatically.
_Avoid_: Auto-attach, inline media

### Serving & Records

**Public Serving**:
Images are readable by anyone at `/images/<key>` with no authentication. The route is deliberately plain Hono because keys contain slashes that typed routes cannot express.
_Avoid_: Protected media, signed read

**Path Traversal Guard**:
Keys containing dot-dot segments or leading slashes are rejected before storage is touched.

**Content-Type Passthrough**:
Serving returns the exact metadata stored at upload time, plus the immutable cache headers and an ETag.
_Avoid_: Re-encoding, transformation

## Boundaries

Terms owned by neighboring contexts — use them, don't redefine them here:

- **Product-image records**: Products context owns listing, attaching, reordering, and deleting `product_images` rows (and calls into this module for byte deletion)
- **Variant image pointers**: Variants context references image IDs; this module knows nothing about variants
- **Derived sizes**: width, height, and the small/medium/large URL columns exist but nothing populates or serves them today

## Edge Cases

**Proxy uploads buffer fully**: The whole file sits in Worker memory before writing — safe only because of the hard 10 MB cap.

**Deletion aborts on storage failure**: The R2 object is removed first; if that fails, the database record is intentionally left untouched rather than orphaning the object.

**Orphaned uploads accumulate**: Files uploaded but never linked to a product have no garbage collection and live forever.

**Derivative fields are aspirational**: Every saved record writes nulls for dimensions and resized variants — no pipeline fills them yet.

**Unknown MIME types fall back**: Anything unlisted is refused, but the extension mapper still defaults unknown entries to `.jpg` defensively.

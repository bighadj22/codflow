import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { productImages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NotFoundError, ValidationError, SystemError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] ?? "jpg";
}

/**
 * POST /api/images/upload
 * Receives multipart/form-data with a "file" field.
 * Stores in R2, returns { key, url }.
 */
export async function uploadImage(c: Context<AppContext>) {
  const bucket = c.env.IMAGES;

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    throw new ValidationError(
      "Expected multipart/form-data",
      ERROR_CODES.VALIDATION_FAILED
    );
  }

  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    throw new ValidationError(
      "Missing file field",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { field: "file" }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ValidationError(
      "Invalid file type. Allowed: jpg, png, webp, gif",
      ERROR_CODES.INVALID_FILE_TYPE,
      { fileType: file.type, allowedTypes: Array.from(ALLOWED_TYPES) }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new ValidationError(
      "File too large. Max 10 MB",
      ERROR_CODES.FILE_TOO_LARGE,
      { fileSize: file.size, maxSize: MAX_SIZE_BYTES, fileName: file.name }
    );
  }

  const ext = extFromMime(file.type);
  const key = `products/${crypto.randomUUID().replace(/-/g, "")}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  try {
    await bucket.put(key, arrayBuffer, {
      httpMetadata: { 
        contentType: file.type,
        cacheControl: "public, max-age=31536000, immutable"
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw new SystemError(
      "Failed to upload image to storage",
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      { key, fileName: file.name, error: error instanceof Error ? error.message : String(error) }
    );
  }

  const origin = new URL(c.req.url).origin;
  const url = `${origin}/images/${key}`;

  return c.json({ success: true, data: { key, url } }, 201);
}

/**
 * GET /images/:key{.+}
 * Serves an image from R2. No auth — images are public.
 * Uses writeHttpMetadata() per R2 docs for correct Content-Type passthrough.
 */
export async function serveImage(c: Context<AppContext>) {
  const bucket = c.env.IMAGES;
  const key = c.req.param("key");

  if (!key) {
    throw new ValidationError(
      "Missing key",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { field: "key" }
    );
  }

  // Prevent path traversal
  if (key.includes("..") || key.startsWith("/")) {
    throw new ValidationError(
      "Invalid key",
      ERROR_CODES.VALIDATION_FAILED,
      { key }
    );
  }

  try {
    const object = await bucket.get(key);
    if (!object) {
      throw new NotFoundError("Image", key);
    }

    const headers = new Headers();
    // writeHttpMetadata copies Content-Type, Content-Disposition, etc. from the stored metadata
    object.writeHttpMetadata(headers);
    // Use httpEtag (quoted) — required by HTTP spec
    headers.set("ETag", object.httpEtag);
    // Set strong cache headers for images
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    // Additional cache headers for better CDN support
    headers.set("Expires", new Date(Date.now() + 31536000 * 1000).toUTCString());
    headers.set("Pragma", "public");

    return new Response(object.body, { headers });
  } catch (error) {
    // Re-throw custom errors so middleware can handle them
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    // Wrap unexpected errors
    throw new SystemError(
      "Failed to retrieve image from storage",
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      { key, error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * GET /api/products/:id/images
 * Returns all images for a product ordered by position.
 */
export async function listProductImages(c: Context<AppContext>) {
  const productId = c.req.param("id")!;
  const db = getDb(c.env.DB);

  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(productImages.position)
    .all();

  return c.json({ success: true, data: images }, 200);
}

/**
 * POST /api/products/:id/images
 * Saves an image record after it's been uploaded to R2.
 * Body: { key, src, altText?, position? }
 */
export async function saveProductImage(c: Context<AppContext>) {
  const productId = c.req.param("id")!;
  const db = getDb(c.env.DB);

  const jsonData: any = (c.req as any).valid?.("json");
  const body = jsonData ?? (await c.req.json<{
    key: string;
    src: string;
    altText?: string;
    position?: number;
  }>());

  if (!jsonData && (!body.key || !body.src)) {
    throw new ValidationError(
      "key and src are required",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { missingFields: ["key", "src"].filter(f => !body[f as keyof typeof body]) }
    );
  }

  // Get current max position to append at end
  const existing = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .all();

  const position =
    body.position ??
    (existing.length > 0
      ? Math.max(...existing.map((i) => i.position)) + 1
      : 1);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const image = {
    id,
    productId,
    src: body.src,
    r2Key: body.key,
    altText: body.altText ?? null,
    width: null,
    height: null,
    srcSm: null,
    srcMd: null,
    srcLg: null,
    type: 1,
    position,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(productImages).values(image);

  return c.json({ success: true, data: image }, 201);
}

/**
 * PATCH /api/products/:id/images/reorder
 * Updates the position of all product images.
 * Body: { imageIds: string[] } — ordered array of all image IDs for the product.
 * Validates: complete set (all product images must be present), no duplicates, all belong to product.
 */
export async function reorderProductImages(c: Context<AppContext>) {
  const productId = c.req.param("id")!;
  const db = getDb(c.env.DB);

  const jsonData: any = (c.req as any).valid?.("json");
  const body = jsonData ?? (await c.req.json<{ imageIds?: unknown }>());

  if (!Array.isArray(body.imageIds) || body.imageIds.length === 0) {
    throw new ValidationError(
      "imageIds must be a non-empty array of image IDs",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { field: "imageIds" }
    );
  }

  const imageIds = body.imageIds as string[];

  if (new Set(imageIds).size !== imageIds.length) {
    throw new ValidationError(
      "imageIds must not contain duplicate IDs",
      ERROR_CODES.VALIDATION_FAILED,
      { field: "imageIds" }
    );
  }

  const existing = await db
    .select({ id: productImages.id })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .all();

  const existingIds = new Set(existing.map((img) => img.id));

  for (const id of imageIds) {
    if (!existingIds.has(id)) {
      throw new ValidationError(
        `Image ${id} does not belong to product ${productId}`,
        ERROR_CODES.VALIDATION_FAILED,
        { imageId: id, productId }
      );
    }
  }

  if (imageIds.length !== existing.length) {
    throw new ValidationError(
      "imageIds must include all images for this product",
      ERROR_CODES.VALIDATION_FAILED,
      { expected: existing.length, received: imageIds.length }
    );
  }

  for (let position = 1; position <= imageIds.length; position++) {
    await db
      .update(productImages)
      .set({ position })
      .where(eq(productImages.id, imageIds[position - 1]));
  }

  const updated = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position))
    .all();

  return c.json({ success: true, data: updated }, 200);
}

/**
 * DELETE /api/products/:id/images/:imageId
 * Deletes image record from DB and object from R2.
 */
export async function deleteProductImage(c: Context<AppContext>) {
  const productId = c.req.param("id")!;
  const imageId = c.req.param("imageId")!;
  const db = getDb(c.env.DB);
  const bucket = c.env.IMAGES;

  const image = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .get();

  if (!image) {
    throw new NotFoundError("Image", imageId);
  }

  // Delete from R2 first — a storage failure aborts the whole operation so the
  // DB record never points at a missing object.
  if (image.r2Key) {
    try {
      await bucket.delete(image.r2Key);
    } catch (error) {
      console.error(`R2 delete failed for key: ${image.r2Key}`, error);
      throw new SystemError(
        "Failed to delete image from storage",
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        { imageId, r2Key: image.r2Key, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  await db.delete(productImages).where(eq(productImages.id, imageId));

  return c.json({ success: true }, 200);
}

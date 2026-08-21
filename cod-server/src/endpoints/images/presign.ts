import { Context } from "hono";
import type { AppContext } from "@/types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ValidationError, SystemError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const PRESIGN_EXPIRY_SECONDS = 600; // 10 minutes

/**
 * POST /api/images/presign
 * Body: { contentType: string, fileName?: string }
 * Returns: { presignedUrl, key, publicUrl }
 *
 * The browser uploads directly to R2 via PUT to presignedUrl.
 * The publicUrl uses the MEDIA_DOMAIN custom domain for permanent serving.
 *
 * Required secrets (set via `wrangler secret put`):
 *   CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 */
export async function presignUpload(c: Context<AppContext>) {
  let contentType = "";
  try {
    const body = await c.req.json<{ contentType?: string }>();
    contentType = body.contentType ?? "";
  } catch {
    // empty body — contentType stays ""
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ValidationError(
      "Invalid content type. Allowed: jpg, png, webp, gif",
      ERROR_CODES.INVALID_FILE_TYPE,
      { contentType, allowedTypes: Array.from(ALLOWED_TYPES) }
    );
  }

  const ext = MIME_TO_EXT[contentType] ?? "jpg";
  const key = `products/${crypto.randomUUID().replace(/-/g, "")}.${ext}`;

  const { CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, MEDIA_DOMAIN } = c.env;

  if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new SystemError(
      "R2 credentials not configured. Set CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY secrets.",
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      { missingCredentials: [
        !CF_ACCOUNT_ID && "CF_ACCOUNT_ID",
        !R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
        !R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY"
      ].filter(Boolean) }
    );
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    // R2 rejects the SDK's default flexible-checksum headers on presigned PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });

  try {
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
    const publicUrl = `https://${MEDIA_DOMAIN}/${key}`;

    return c.json({ success: true, data: { presignedUrl, key, publicUrl } }, 200);
  } catch (error) {
    throw new SystemError(
      "Failed to generate presigned URL",
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      { key, error: error instanceof Error ? error.message : String(error) }
    );
  }
}

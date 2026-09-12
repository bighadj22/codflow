/**
 * Shared minting rules and limits for MCP-agent landing page image uploads.
 *
 * Used by BOTH the upload tool (validates input, mints keys, enqueues the
 * workflow) and the background workflow (re-verifies, stores, records) — one
 * module so the tool can never mint a key or accept a content type the
 * workflow would reject.
 */

/** Decoded-byte cap — matches the browser proxy-upload cap (images endpoint). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Platform image whitelist — identical to images/presign.ts ALLOWED_TYPES. */
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Canonicalize the "image/jpg" alias so it compares equal to "image/jpeg". */
export function canonicalImageContentType(contentType: string): string {
  return contentType === "image/jpg" ? "image/jpeg" : contentType;
}

export function extFromImageContentType(contentType: string): string {
  return MIME_TO_EXT[contentType] ?? "jpg";
}

/** Server-generated key shape: landing/<uuid-no-dashes>.<ext> — traversal-proof by construction. */
export const LANDING_IMAGE_R2_KEY_PATTERN = /^landing\/[a-f0-9]{32}\.(jpg|png|webp|gif)$/;

/**
 * Mint the R2 key and the workflow instance ID from ONE uuid so the job,
 * its storage object, and its audit rows share a traceable identity:
 *   r2Key     = landing/<hex>.<ext>
 *   instanceId = lpimg-<hex>   (matches the Workflows ID charset, ≤ 100 chars)
 */
export function mintLandingImageUploadIds(contentType: string): {
  hex: string;
  r2Key: string;
  instanceId: string;
} {
  const hex = crypto.randomUUID().replace(/-/g, "");
  return {
    hex,
    r2Key: `landing/${hex}.${extFromImageContentType(contentType)}`,
    instanceId: `lpimg-${hex}`,
  };
}

/** Base64 input cap: 8 MB decoded → ~11.18 M base64 chars, plus slack for
 *  padding and tolerated whitespace. Rejects oversized payloads before decode. */
export const BASE64_MAX_INPUT_LENGTH =
  Math.ceil((MAX_IMAGE_BYTES / 3) * 4) + 1024;

/**
 * Decode agent-supplied base64 image bytes. Tolerates a `data:<mime>;base64,`
 * prefix and embedded whitespace — models send both. Throws on invalid base64.
 */
export function decodeBase64Image(input: string): Uint8Array {
  const normalized = input.replace(/^data:[^,]*;base64,/, "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

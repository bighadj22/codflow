/**
 * CodLandingPageImageUploadWorkflow — durable background upload of a landing
 * page image from an MCP agent (ChatGPT, Claude, ...).
 *
 * Two entry shapes share one tail:
 *   kind "url"   — the agent supplies a fetchable http(s) image URL; this
 *                  workflow downloads it (retried, size-capped, magic-byte-
 *                  verified) and writes the object to R2. Image bytes can
 *                  never travel through workflow params (1 MiB payload cap),
 *                  so the URL is fetched here, inside a durable step.
 *   kind "bytes" — the tool already wrote the decoded base64 bytes to R2 via
 *                  the bucket binding; this workflow verifies the object and
 *                  continues.
 *
 * Both kinds then measure intrinsic dimensions (fail-open; client-declared
 * width/height are the fallback), insert the landing_page_images row with
 * source "ai" (idempotent on r2Key), audit the addition, and return the image
 * record as the instance output that getLandingPageImageUploadStatus polls.
 *
 * Instance ID: `lpimg-<32 hex>` — minted by the upload tool, unique per
 * upload attempt (Workflows instance IDs are unique forever).
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { z } from "zod";
import type { Env } from "@/types/env";
import { getDb } from "@/db";
import { parseImageDimensions, sniffImageType } from "@/lib/image-dimensions";
import {
  canonicalImageContentType,
  IMAGE_CONTENT_TYPES,
  LANDING_IMAGE_R2_KEY_PATTERN,
  MAX_IMAGE_BYTES,
} from "@/lib/landing-image-upload";
import {
  addLandingPageImage,
  getLandingPageById,
  getLandingPageImages,
} from "../../../cod-shared/queries/landing-pages";
import { ACTIONS, logActivity } from "@/lib/activity";

const actorSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["admin", "staff"]),
});

const baseShape = {
  landingPageId: z.string().uuid(),
  r2Key: z.string().regex(LANDING_IMAGE_R2_KEY_PATTERN),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
  altText: z.string().max(1000).nullable().optional(),
  position: z.number().int().min(1).optional(),
  /** Client-declared intrinsic size — used only when server-side header
   *  parsing fails (fail-open; the storefront renders without dims either way). */
  width: z.number().int().min(1).max(20000).optional(),
  height: z.number().int().min(1).max(20000).optional(),
  actor: actorSchema,
};

export const CodLandingPageImageUploadParamsSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...baseShape,
    kind: z.literal("url"),
    imageUrl: z.url({ protocol: /^https?$/, message: "imageUrl must be an http(s) URL" }),
  }),
  z.strictObject({
    ...baseShape,
    kind: z.literal("bytes"),
  }),
]);

export type CodLandingPageImageUploadParams = z.infer<
  typeof CodLandingPageImageUploadParamsSchema
>;

export type CodLandingPageImageUploadOutput = {
  imageId: string | null;
  r2Key: string;
  src: string;
  position: number | null;
  width: number | null;
  height: number | null;
  altText: string | null;
};

interface StoredImageMeta {
  size: number;
  width: number | null;
  height: number | null;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
    )
    .join("; ");
}

/**
 * Read a response body up to capBytes, aborting the stream the moment the
 * cap is exceeded — an unbounded arrayBuffer() on a lying/large response
 * would buffer the whole payload in Worker memory before any check runs.
 */
async function readBodyWithCap(response: Response, capBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > capBytes) {
      throw new NonRetryableError(`Image exceeds the 8 MB cap (${buffer.byteLength} bytes).`);
    }
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > capBytes) {
      await reader.cancel().catch(() => {});
      throw new NonRetryableError(
        `Image exceeds the 8 MB cap (${total} bytes read so far).`,
      );
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Download the image URL, validate it, and write the object to R2 — all inside
 * one step because step results are capped at 1 MiB and image bytes must not
 * cross a step boundary. Only small metadata is returned.
 */
async function fetchAndStoreImage(
  env: Env,
  params: Extract<CodLandingPageImageUploadParams, { kind: "url" }>,
): Promise<StoredImageMeta> {
  const response = await fetch(params.imageUrl, { redirect: "follow" });
  if ([401, 403, 404].includes(response.status)) {
    throw new NonRetryableError(
      `Image URL returned HTTP ${response.status} — the link is not publicly fetchable or has expired. ` +
        "Re-generate the image and provide its direct download URL.",
    );
  }
  if (!response.ok) {
    throw new Error(`Image URL fetch failed with HTTP ${response.status}`);
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_IMAGE_BYTES) {
    throw new NonRetryableError(
      `Image exceeds the 8 MB cap (content-length: ${declaredLength} bytes).`,
    );
  }

  const bytes = await readBodyWithCap(response, MAX_IMAGE_BYTES);
  if (bytes.byteLength === 0) {
    throw new NonRetryableError("Image URL returned an empty body.");
  }

  const sniffed = sniffImageType(bytes);
  const claimed = canonicalImageContentType(params.contentType);
  if (!sniffed) {
    throw new NonRetryableError(
      "Fetched bytes are not a recognized image (png, jpeg, webp, or gif).",
    );
  }
  if (sniffed !== claimed) {
    throw new NonRetryableError(
      `Content mismatch: the URL served ${sniffed} but contentType claimed ${params.contentType}.`,
    );
  }

  const dimensions = parseImageDimensions(bytes);
  try {
    await env.IMAGES.put(params.r2Key, bytes, {
      httpMetadata: {
        contentType: claimed,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        source: "ai",
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw new Error(
      `R2 write failed for key ${params.r2Key}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    size: bytes.byteLength,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

/** Verify the tool's direct R2 write landed and measure the stored bytes. */
async function readAndMeasureObject(
  env: Env,
  params: Extract<CodLandingPageImageUploadParams, { kind: "bytes" }>,
): Promise<StoredImageMeta> {
  const object = await env.IMAGES.get(params.r2Key);
  if (!object) {
    throw new NonRetryableError(
      `R2 object ${params.r2Key} is missing — the direct upload did not land. Retry the upload.`,
    );
  }
  const buffer = new Uint8Array(await object.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new NonRetryableError(
      `Stored image exceeds the 8 MB cap (${buffer.byteLength} bytes).`,
    );
  }
  const sniffed = sniffImageType(buffer);
  const claimed = canonicalImageContentType(params.contentType);
  if (!sniffed) {
    throw new NonRetryableError(
      "Stored bytes are not a recognized image (png, jpeg, webp, or gif).",
    );
  }
  if (sniffed !== claimed) {
    throw new NonRetryableError(
      `Content mismatch: stored bytes are ${sniffed} but contentType claimed ${params.contentType}.`,
    );
  }
  const dimensions = parseImageDimensions(buffer);
  return {
    size: buffer.byteLength,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

export class CodLandingPageImageUploadWorkflow extends WorkflowEntrypoint<
  Env,
  CodLandingPageImageUploadParams
> {
  async run(
    event: WorkflowEvent<CodLandingPageImageUploadParams>,
    step: WorkflowStep,
  ): Promise<CodLandingPageImageUploadOutput> {
    // Step 0 — runtime schema validation (params are untrusted input).
    const parsed = CodLandingPageImageUploadParamsSchema.safeParse(event.payload);
    if (!parsed.success) {
      throw new NonRetryableError(
        `Invalid landing page image upload payload: ${formatIssues(parsed.error)}`,
      );
    }
    const params = parsed.data;

    // Step 1 — acquire the bytes (durable, retried).
    // URL path: fetch + validate + R2 put in one step — image bytes must not
    // cross a step boundary (1 MiB non-stream step-result cap).
    const stored: StoredImageMeta =
      params.kind === "url"
        ? await step.do(
            "fetch-and-store-image",
            {
              retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
              timeout: "2 minutes",
            },
            async () => fetchAndStoreImage(this.env, params),
          )
        : await step.do("read-and-measure-object", async () =>
            readAndMeasureObject(this.env, params),
          );

    // Step 2 — insert the landing_page_images row (idempotent on r2Key: an
    // engine restart after a committed insert re-runs this step and finds
    // the row instead of duplicating it).
    const record = await step.do(
      "insert-image-record",
      { retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
      async () => {
        const db = getDb(this.env.DB);

        const landingPage = await getLandingPageById(db, params.landingPageId);
        if (!landingPage) {
          throw new NonRetryableError(
            `Landing page ${params.landingPageId} no longer exists — nothing to attach the image to.`,
          );
        }

        const existing = (await getLandingPageImages(db, params.landingPageId)).find(
          (image) => image.r2Key === params.r2Key,
        );
        if (existing) {
          return {
            imageId: existing.id,
            src: existing.src,
            position: existing.position,
            width: existing.width,
            height: existing.height,
            altText: existing.altText,
            landingPageName: landingPage.name,
          };
        }

        const src = `https://${this.env.MEDIA_DOMAIN}/${params.r2Key}`;
        const images = await addLandingPageImage(db, params.landingPageId, {
          r2Key: params.r2Key,
          src,
          altText: params.altText ?? null,
          ...(params.position !== undefined ? { position: params.position } : {}),
          width: stored.width ?? params.width ?? null,
          height: stored.height ?? params.height ?? null,
          source: "ai",
        });
        const image = images.find((row) => row.r2Key === params.r2Key);
        if (!image) {
          throw new Error(
            `Inserted image row for key ${params.r2Key} not found in the resulting stack.`,
          );
        }
        return {
          imageId: image.id,
          src: image.src,
          position: image.position,
          width: image.width,
          height: image.height,
          altText: image.altText,
          landingPageName: landingPage.name,
        };
      },
    );

    // Step 3 — audit trail (best-effort: logActivity swallows its own errors,
    // so an audit failure can never fail an upload that already landed).
    await step.do("audit-image-added", async () => {
      await logActivity(
        getDb(this.env.DB),
        params.actor,
        ACTIONS.LANDING_PAGE_UPDATED,
        { type: "landing_page", id: params.landingPageId, label: record.landingPageName },
        {
          via: "mcp",
          action: "image_added",
          source: "ai",
          imageId: record.imageId,
          r2Key: params.r2Key,
          uploadKind: params.kind,
          uploadJobId: event.instanceId,
          byteSize: stored.size,
        },
      );
    });

    return {
      imageId: record.imageId,
      r2Key: params.r2Key,
      src: record.src,
      position: record.position,
      width: record.width,
      height: record.height,
      altText: record.altText,
    };
  }
}

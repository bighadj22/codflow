import { tool } from "ai";
import { z } from "zod";
import * as queries from "./queries";
import { createLandingPageSchema, updateLandingPageSchema } from "./validation";
import { getDb } from "@/db";
import type { Env } from "@/types/env";
import { sniffImageType } from "@/lib/image-dimensions";
import {
  BASE64_MAX_INPUT_LENGTH,
  canonicalImageContentType,
  decodeBase64Image,
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  mintLandingImageUploadIds,
} from "@/lib/landing-image-upload";
import { toolOutput } from "@/lib/tool-output-schema";
import {
  buildLandingPagePublicUrl,
  resolveStorefrontBaseUrl,
} from "../../../../cod-shared/queries/landing-pages";

/**
 * Layer-2 validation schemas, hoisted to module level and exported so the MCP
 * layer (src/mcp/schemas.ts) can derive tools/list inputSchema from the exact
 * same definitions — the advertised schema and the executed validation cannot
 * drift apart.
 *
 * Every schema is STRICT: an unknown field is an explicit, recoverable
 * validation error — never a silently stripped key.
 */
export const listLandingPagesSchema = z.strictObject({
  productId: z.string().optional().describe("Filter by product UUID"),
  status: z.enum(["draft", "published", "archived"]).optional().describe("Filter by lifecycle status"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Page size (1-200, default 50). Rows are newest-first; page through with offset when the result hits the limit."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of rows to skip — pair with limit for paging through large catalogs."),
});
export const getLandingPageDetailsSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to retrieve"),
});
export const getLandingPageStatsSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to get stats for"),
});
export const createLandingPageToolSchema = createLandingPageSchema.strict();
export const updateLandingPageToolSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to update"),
  updates: updateLandingPageSchema.strict(),
});
export const publishLandingPageSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to publish"),
});
export const deleteLandingPageSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to delete"),
});

/** ChatGPT file-object input (openai/fileParams contract): the CLIENT fills
 *  this object — download_url + file_id required, mime_type/file_name optional.
 *  The model never touches image bytes. */
const chatgptFileObjectSchema = z.strictObject({
  download_url: z
    .string()
    .min(1)
    .describe("Direct fetchable URL of the image — filled in by the client, not the model"),
  file_id: z
    .string()
    .min(1)
    .describe("Client-side file identifier — filled in by the client, not the model"),
  mime_type: z.string().optional().describe("MIME type of the image, when the client knows it"),
  file_name: z.string().optional().describe("File name, when the client knows it"),
});

export const uploadLandingPageImageSchema = z
  .strictObject({
    landingPageId: z
      .string()
      .uuid()
      .describe("The UUID of the landing page that receives the image"),
    image: chatgptFileObjectSchema
      .optional()
      .describe(
        "PREFERRED from ChatGPT and other chat clients: the conversation image as a file object. " +
          "The client fills download_url automatically — pass the generated image here; do NOT inline image data.",
      ),
    imageUrl: z
      .url({ protocol: /^https?$/, message: "imageUrl must be an http(s) URL" })
      .optional()
      .describe(
        "A directly-fetchable public http(s) URL of the image — e.g. the download URL of an image you generated. " +
          "Login-protected or expired links fail with a 'not publicly fetchable' error; if so, re-generate or re-host the image and retry with a fresh URL.",
      ),
    imageBase64: z
      .string()
      .max(BASE64_MAX_INPUT_LENGTH)
      .optional()
      .describe(
        "Programmatic clients ONLY (API/agent harnesses that construct this call in code). " +
          "NEVER use from a chat client: inline image data is blocked by client safety checks before the call is sent, " +
          "and raw bytes, base64-encoded (max 8 MB decoded), cannot be emitted as tool arguments anyway.",
      ),
    contentType: z
      .enum(IMAGE_CONTENT_TYPES)
      .describe(
        "MIME type of the actual image bytes: image/png, image/jpeg, image/webp, or image/gif. " +
          "ChatGPT image generation outputs PNG. Verified server-side by magic-byte sniffing — a mismatch is rejected.",
      ),
    altText: z.string().max(1000).optional().describe("Alt text for accessibility"),
    position: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Stack position, 1 = top of the page. Omit to append at the end of the stack."),
    width: z
      .number()
      .int()
      .min(1)
      .max(20000)
      .optional()
      .describe(
        "Intrinsic pixel width — only if you know it; the server measures automatically and its measurement wins.",
      ),
    height: z
      .number()
      .int()
      .min(1)
      .max(20000)
      .optional()
      .describe(
        "Intrinsic pixel height — only if you know it; the server measures automatically and its measurement wins.",
      ),
  })
  .refine(
    (data) =>
      [data.image, data.imageUrl, data.imageBase64].filter((v) => v !== undefined).length === 1,
    {
      message:
        "Provide exactly one of image (chat clients — the file object), imageUrl (a public URL), or imageBase64 (programmatic clients only).",
    },
  );

export const getLandingPageImageUploadStatusSchema = z.strictObject({
  uploadJobId: z
    .string()
    .min(6)
    .max(100)
    .describe("The uploadJobId returned by uploadLandingPageImage"),
});

/**
 * ChatGPT tool-descriptor `_meta` extensions for this domain. Merged by
 * src/mcp/schemas.ts into TOOL_META and attached at registration time in
 * server-factory.ts.
 *
 * `openai/fileParams` tells the ChatGPT runtime that the named input is a
 * file object it should construct itself (with a real, fetchable
 * download_url) — the supported way to pass conversation files to a tool,
 * because tool-call arguments are model-generated JSON that can never carry
 * image bytes.
 *
 * `openai/toolInvocation` status text (≤64 chars each) is what ChatGPT shows
 * while the tool runs and after it completes — the async upload is the one
 * flow where that feedback matters most.
 */
export const LANDING_PAGE_TOOL_META: Record<string, Record<string, unknown>> = {
  uploadLandingPageImage: {
    "openai/fileParams": ["image"],
    "openai/toolInvocation/invoking": "Starting background image upload…",
    "openai/toolInvocation/invoked": "Upload job created — poll status until complete",
  },
};

/** One landing_page_images row — the ordered image stack entry. */
const lpImageRowSchema = z.looseObject({
  id: z.string().describe("Image row UUID — used by removeLandingPageImage and reorderLandingPageImages"),
  r2Key: z.string().describe("R2 storage object key (landing/<hex>.<ext>)"),
  src: z.string().describe("Public image URL on the media domain"),
  altText: z.string().nullable().describe("Alt text, or null"),
  position: z.number().int().describe("Stack position — 1 is the top of the page"),
  width: z.number().int().nullable().describe("Intrinsic pixel width, or null when unmeasured"),
  height: z.number().int().nullable().describe("Intrinsic pixel height, or null when unmeasured"),
  source: z.enum(["upload", "ai"]).describe("Provenance: uploaded by a human or generated by an AI agent"),
});

/** A landing page detail aggregate (the shape getLandingPageById returns). */
const lpDetailSchema = z.looseObject({
  id: z.string().describe("Landing page UUID"),
  slug: z.string().describe("Public slug — the page lives at /lp/<slug>"),
  name: z.string(),
  status: z.enum(["draft", "published", "archived"]).describe("Lifecycle status"),
  productId: z.string().describe("The single product this page markets"),
  imageGap: z.number().int().describe("Gap in pixels between stacked images"),
  views: z.number().int().describe("Render count (non-unique; refreshes and bots included)"),
  images: z.array(lpImageRowSchema).describe("The ordered image stack — index 0 renders at the top of the page"),
  product: z
    .looseObject({
      id: z.string(),
      name: z.string(),
      handle: z.string(),
      price: z.number().describe("Catalog price charged on this page (server-authoritative)"),
    })
    .nullable()
    .describe("The linked product, or null when it was deleted"),
  stats: z.looseObject({
    views: z.number().int(),
    orders: z.number().int().describe("Orders placed and attributed to this page (any status)"),
    revenue: z.number().describe("Gross booked value of attributed orders (any status)"),
  }),
});

const lpListItemSchema = z.looseObject({
  id: z.string().describe("Landing page UUID"),
  slug: z.string().describe("Public slug — the page lives at /lp/<slug>"),
  name: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  productId: z.string(),
  productName: z.string().nullable(),
  imageCount: z.number().int().describe("Images in the stack"),
  views: z.number().int(),
  orders: z.number().int().describe("Orders placed and attributed (any status)"),
  revenue: z.number().describe("Gross booked value (any status)"),
  publicPath: z.string().describe("Relative public path /lp/<slug>"),
  publicUrl: z.string().describe("Absolute public URL when a storefront base resolves, else the relative path"),
});

const lpStatsSchema = z.looseObject({
  views: z.number().int().describe("Render count (non-unique)"),
  orders: z.number().int().describe("Orders placed and attributed (any status, cancelled/returned included)"),
  revenue: z.number().describe("Gross booked value of attributed orders (any status)"),
});

export const LANDING_PAGE_TOOL_OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
  listLandingPages: toolOutput({
    count: z.number().int().describe("Rows returned on this page — page with offset when it equals the limit"),
    landingPages: z.array(lpListItemSchema).describe("Landing pages, newest first"),
  }),
  getLandingPageDetails: toolOutput({
    landingPage: lpDetailSchema.describe("Settings, the ordered image stack, the linked product, and stats"),
  }),
  getLandingPageStats: toolOutput({
    stats: lpStatsSchema,
  }),
  createLandingPage: toolOutput({
    landingPage: lpDetailSchema.describe("The created draft — its image stack is EMPTY until images are added"),
    publicPath: z.string(),
    publicUrl: z.string(),
    note: z.string().describe("Next steps: add images, then publish"),
  }),
  updateLandingPage: toolOutput({
    landingPage: lpDetailSchema,
  }),
  publishLandingPage: toolOutput({
    landingPage: lpDetailSchema.describe("The published page"),
    publicPath: z.string(),
    publicUrl: z.string().describe("The live link the merchant pastes into ad sets"),
    warning: z.string().optional().describe("Present when published with an EMPTY image stack — add images before running ads"),
  }),
  deleteLandingPage: toolOutput({
    message: z.string(),
  }),
  uploadLandingPageImage: toolOutput({
    uploadJobId: z.string().describe("Poll getLandingPageImageUploadStatus with this ID until 'complete' or 'failed'"),
    status: z.literal("processing").describe("The upload runs in the background"),
    r2Key: z.string(),
    src: z.string().describe("The public URL the image will be served from once stored"),
    note: z.string(),
  }),
  getLandingPageImageUploadStatus: toolOutput({
    uploadJobId: z.string(),
    status: z
      .enum(["processing", "complete", "failed", "stopped", "unknown"])
      .describe("processing → keep polling; complete → the image is in the stack; failed → see error; unknown → check the stack directly"),
    image: z
      .looseObject({
        imageId: z.string().describe("The inserted image row's UUID — used by removeLandingPageImage and reorderLandingPageImages"),
        r2Key: z.string(),
        src: z.string().describe("Public image URL"),
        position: z.number().int().nullable().describe("Stack position — 1 is the top of the page"),
        width: z.number().int().nullable(),
        height: z.number().int().nullable(),
        altText: z.string().nullable(),
      })
      .nullable()
      .optional()
      .describe("On complete: the inserted image (imageId, src, position)"),
    error: z.string().optional().describe("On failed: what went wrong and how to recover"),
    note: z.string().optional(),
    advice: z.string().optional().describe("Next-step guidance"),
  }),
  removeLandingPageImage: toolOutput({
    images: z.array(lpImageRowSchema).describe("The stack after removal"),
    count: z.number().int(),
  }),
  reorderLandingPageImages: toolOutput({
    images: z.array(lpImageRowSchema).describe("The stack in its new order — index 0 is the top of the page"),
    count: z.number().int(),
  }),
  duplicateLandingPage: toolOutput({
    landingPage: lpDetailSchema.describe("The fresh draft copy — views/orders/revenue start at zero"),
    publicPath: z.string(),
    publicUrl: z.string(),
    note: z.string(),
  }),
  unpublishLandingPage: toolOutput({
    landingPage: lpDetailSchema.describe("The page, now back in draft — its link 404s but history stays"),
    publicPath: z.string(),
    publicUrl: z.string(),
  }),
  archiveLandingPage: toolOutput({
    landingPage: lpDetailSchema.describe("The archived page — history preserved, link retired"),
    message: z.string(),
  }),
};

export const removeLandingPageImageSchema = z.strictObject({
  landingPageId: z
    .string()
    .uuid()
    .describe("The UUID of the landing page that owns the image"),
  imageId: z
    .string()
    .uuid()
    .describe(
      "The UUID of the image row to remove — get the current stack and its IDs from getLandingPageDetails",
    ),
});

export const reorderLandingPageImagesSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page"),
  imageIds: z
    .array(z.string().uuid())
    .min(1)
    .describe(
      "The COMPLETE ordered list of ALL image IDs for this landing page — index 0 becomes position 1 (top of the page). " +
        "No duplicates, no omissions: the set must exactly match the current stack from getLandingPageDetails.",
    ),
});

export const duplicateLandingPageSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to duplicate"),
});

export const unpublishLandingPageSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to unpublish"),
});

export const archiveLandingPageSchema = z.strictObject({
  landingPageId: z.string().uuid().describe("The UUID of the landing page to archive"),
});

/** Workflow InstanceStatus → the shape the status tool reports to the model. */
export interface UploadJobStatusView {
  status: "processing" | "complete" | "failed" | "stopped" | "unknown";
  image?: unknown;
  error?: string;
  note?: string;
  advice?: string;
}

export function mapUploadJobStatus(raw: {
  status: string;
  error?: { message?: string } | null;
  output?: unknown;
}): UploadJobStatusView {
  switch (raw.status) {
    case "queued":
    case "running":
    case "waiting":
    case "waitingForPause":
      return {
        status: "processing",
        note: "The upload is still running — keep polling with the same uploadJobId.",
      };
    case "complete":
      return {
        status: "complete",
        image: raw.output ?? null,
        advice:
          "The image is in the landing page stack. Review it with getLandingPageDetails, arrange the stack with reorderLandingPageImages if needed, " +
          "then publishLandingPage to make the link live.",
      };
    case "errored":
      return {
        status: "failed",
        error: raw.error?.message ?? "The upload failed for an unknown reason.",
      };
    case "paused":
    case "terminated":
      return { status: "stopped", note: `The upload job was ${raw.status}.` };
    default:
      return {
        status: "unknown",
        advice:
          "Check getLandingPageDetails to see whether the image landed before re-uploading.",
      };
  }
}

export const LANDING_PAGE_TOOL_SCHEMAS: Record<string, z.ZodRawShape> = {
  listLandingPages: listLandingPagesSchema.shape,
  getLandingPageDetails: getLandingPageDetailsSchema.shape,
  getLandingPageStats: getLandingPageStatsSchema.shape,
  createLandingPage: createLandingPageToolSchema.shape,
  updateLandingPage: updateLandingPageToolSchema.shape,
  publishLandingPage: publishLandingPageSchema.shape,
  deleteLandingPage: deleteLandingPageSchema.shape,
  uploadLandingPageImage: uploadLandingPageImageSchema.shape,
  getLandingPageImageUploadStatus: getLandingPageImageUploadStatusSchema.shape,
  removeLandingPageImage: removeLandingPageImageSchema.shape,
  reorderLandingPageImages: reorderLandingPageImagesSchema.shape,
  duplicateLandingPage: duplicateLandingPageSchema.shape,
  unpublishLandingPage: unpublishLandingPageSchema.shape,
  archiveLandingPage: archiveLandingPageSchema.shape,
};

/** Env surface the landing-page tools consume: deployment vars, the R2
 *  bucket, and the background upload workflow binding. */
export type LandingPageToolEnv = Pick<
  Env,
  "STOREFRONT_URL" | "IMAGES" | "MEDIA_DOMAIN" | "LP_IMAGE_UPLOAD_WORKFLOW"
>;

/** Verified session identity — structurally satisfied by McpProps. Only the
 *  upload tool needs it (the background workflow audits through this actor). */
export interface LandingPageToolSession {
  userId: string;
  role: "admin" | "staff";
  name?: string;
  email?: string;
}

/** Zod issues → one readable line. Empty paths (e.g. unrecognized keys) do not
 *  get a dangling "path: " prefix. */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
    )
    .join("; ");
}

/**
 * AI Tools for Landing Pages
 *
 * Landing pages are one-product marketing pages: an ordered image stack with
 * the COD order form at the bottom. Merchants create several per product, run
 * ads to each, and compare which converts. The charged price is always the
 * product's catalog price — the price story lives in the images.
 *
 * Two-Layer Validation Pattern:
 * - Layer 1 (LLM-level): Permissive input schema accepts any object to prevent SDK crashes
 * - Layer 2 (App-level): STRICT validation inside execute() with graceful error handling —
 *   unknown fields are rejected with an actionable message so the model can retry
 */
export const getLandingPageTools = (
  db: ReturnType<typeof getDb>,
  env?: LandingPageToolEnv,
  session?: LandingPageToolSession,
) => ({

  listLandingPages: tool({
    description:
      "List landing pages (newest first) with per-page stats: views, attributed orders, and revenue. " +
      "Orders are counted as PLACED regardless of status (cancelled/returned included) — treat revenue as gross booked value, not realized sales. " +
      "Optionally filter by product or lifecycle status (draft | published | archived). " +
      "Returns up to `limit` rows (default 50) — page with offset when the result fills the page. " +
      "Each row includes the public slug — the link the merchant pastes into ad sets is /lp/<slug>.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const validationSchema = listLandingPagesSchema;
        const parsed = validationSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error:
              `Invalid filter arguments: ${formatIssues(parsed.error)}. ` +
              "Expected: productId (UUID, optional), status (draft|published|archived, optional), limit (1-200, default 50), offset (≥ 0). Unknown fields are rejected.",
          };
        }

        const pages = await queries.listLandingPages(
          db,
          {
            ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
            ...(parsed.data.status ? { status: parsed.data.status } : {}),
          },
          { limit: parsed.data.limit, offset: parsed.data.offset },
        );
        const baseUrl = await resolveStorefrontBaseUrl(db, env?.STOREFRONT_URL);
        return {
          success: true,
          count: pages.length,
          landingPages: pages.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            status: p.status,
            productId: p.productId,
            productName: p.productName,
            imageCount: p.imageCount,
            views: p.views,
            orders: p.orders,
            revenue: p.revenue,
            publicPath: `/lp/${p.slug}`,
            publicUrl: buildLandingPagePublicUrl(baseUrl, p.slug),
          })),
        };
      } catch (error) {
        return { success: false, error: `Failed to list landing pages: ${(error as Error).message}` };
      }
    },
  }),

  getLandingPageDetails: tool({
    description:
      "Get full landing page details by ID: settings, the ordered image stack, the linked product, and stats. " +
      "Use this to inspect a page's creatives and spacing before editing.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = getLandingPageDetailsSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID). Unknown fields are rejected.`,
          };
        }

        const lp = await queries.getLandingPageById(db, parsed.data.landingPageId);
        if (!lp) {
          return { success: false, error: `Landing page ${parsed.data.landingPageId} not found` };
        }
        return { success: true, landingPage: lp };
      } catch (error) {
        return { success: false, error: `Failed to get landing page: ${(error as Error).message}` };
      }
    },
  }),

  getLandingPageStats: tool({
    description:
      "Get a landing page's performance stats: views, attributed orders, and revenue. " +
      "Orders are counted as PLACED regardless of status (cancelled/returned included) — treat revenue as gross booked value, not realized sales. " +
      "Conversion rate = orders / views (compute it yourself; zero views means the rate is undefined).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = getLandingPageStatsSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID). Unknown fields are rejected.`,
          };
        }

        const stats = await queries.getLandingPageStats(db, parsed.data.landingPageId);
        if (!stats) {
          return { success: false, error: `Landing page ${parsed.data.landingPageId} not found` };
        }
        return { success: true, stats };
      } catch (error) {
        return { success: false, error: `Failed to get stats: ${(error as Error).message}` };
      }
    },
  }),

  createLandingPage: tool({
    description:
      "Create a draft landing page for a product. The slug defaults to lp-<8 chars> and is editable later via updateLandingPage. " +
      "A new page starts with an EMPTY image stack — add images with uploadLandingPageImage before publishing. " +
      "The page charges the product's catalog price — there is no price override; the price story lives in the images.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = createLandingPageToolSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error:
              `Invalid arguments: ${formatIssues(parsed.error)}. ` +
              "Expected: name (2-200 chars), productId (UUID), optional slug ([a-z0-9-]{3,60}), optional imageGap (0-200 px). Unknown fields are rejected — images cannot be set at creation.",
          };
        }

        const { id, slug } = await queries.createLandingPage(db, parsed.data);
        const lp = await queries.getLandingPageById(db, id);
        const baseUrl = await resolveStorefrontBaseUrl(db, env?.STOREFRONT_URL);
        return {
          success: true,
          landingPage: lp,
          publicPath: `/lp/${slug}`,
          publicUrl: buildLandingPagePublicUrl(baseUrl, slug),
          note: "Draft created with an empty image stack. Add images via uploadLandingPageImage, then publishLandingPage to make the link live.",
        };
      } catch (error) {
        return { success: false, error: `Failed to create landing page: ${(error as Error).message}` };
      }
    },
  }),

  updateLandingPage: tool({
    description:
      "Partially update a landing page's settings: name, slug, image gap (imageGap, pixels 0-200), or SEO meta (metaTitle, metaDescription). " +
      "A taken slug is rejected. The image stack is NOT managed by this tool — use uploadLandingPageImage, removeLandingPageImage, and reorderLandingPageImages instead.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = updateLandingPageToolSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error:
              `Invalid arguments: ${formatIssues(parsed.error)}. ` +
              "Expected: landingPageId (UUID) and updates { name?, slug?, imageGap?, metaTitle?, metaDescription? }. Unknown fields are rejected — the image stack is not updatable here.",
          };
        }

        await queries.updateLandingPage(db, parsed.data.landingPageId, parsed.data.updates);
        const lp = await queries.getLandingPageById(db, parsed.data.landingPageId);
        return { success: true, landingPage: lp };
      } catch (error) {
        return { success: false, error: `Failed to update landing page: ${(error as Error).message}` };
      }
    },
  }),

  publishLandingPage: tool({
    description:
      "Publish a landing page — its link /lp/<slug> goes live and starts counting views. " +
      "The result carries a warning when the page's image stack is empty (the public page would render only the order form). " +
      "unpublishLandingPage returns it to draft later (the link stops resolving but history stays).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = publishLandingPageSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID). Unknown fields are rejected.`,
          };
        }

        const existing = await queries.getLandingPageById(db, parsed.data.landingPageId);
        if (!existing) {
          return { success: false, error: `Landing page ${parsed.data.landingPageId} not found` };
        }

        await queries.publishLandingPage(db, parsed.data.landingPageId);
        const lp = await queries.getLandingPageById(db, parsed.data.landingPageId);
        const slug = lp?.slug ?? existing.slug;
        const imageCount = lp?.images?.length ?? existing.images?.length ?? 0;
        const baseUrl = await resolveStorefrontBaseUrl(db, env?.STOREFRONT_URL);
        return {
          success: true,
          landingPage: lp,
          publicPath: `/lp/${slug}`,
          publicUrl: buildLandingPagePublicUrl(baseUrl, slug),
          ...(imageCount === 0
            ? {
                warning:
                  "Published with an EMPTY image stack — the public page will render only the order form with no images. " +
                  "Add images via uploadLandingPageImage before pointing ads at this link.",
              }
            : {}),
        };
      } catch (error) {
        return { success: false, error: `Failed to publish: ${(error as Error).message}` };
      }
    },
  }),

  deleteLandingPage: tool({
    description:
      "Permanently delete a landing page with NO attributed orders. " +
      "Refused (LANDING_PAGE_HAS_ORDERS) when any order references the page — archive it instead via archiveLandingPage so attribution history stays intact. " +
      "This action is immediate and irreversible.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = deleteLandingPageSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID). Unknown fields are rejected.`,
          };
        }

        const stats = await queries.getLandingPageStats(db, parsed.data.landingPageId);
        if (!stats) {
          return { success: false, error: `Landing page ${parsed.data.landingPageId} not found` };
        }
        if (stats.orders > 0) {
          return {
            success: false,
            error: `Landing page has ${stats.orders} attributed order(s) — delete is refused. Archive it instead via archiveLandingPage.`,
          };
        }

        await queries.deleteLandingPageWithGuard(db, parsed.data.landingPageId);
        return { success: true, message: "Landing page deleted" };
      } catch (error) {
        return { success: false, error: `Failed to delete landing page: ${(error as Error).message}` };
      }
    },
  }),

  uploadLandingPageImage: tool({
    description:
      "Upload an image into a landing page's image stack (the marketing story — price framing, urgency, benefits — lives in the images). " +
      "ASYNCHRONOUS: this returns an uploadJobId immediately; the actual download/store runs in the background. " +
      "Afterwards, poll getLandingPageImageUploadStatus with that uploadJobId until it reports 'complete' or 'failed'.\n" +
      "Pass the image in EXACTLY ONE of three ways:\n" +
      "• image (file object) — the way ChatGPT and chat clients pass a conversation image: the client fills download_url itself. " +
      "Generate the image first, then pass it here.\n" +
      "• imageUrl — any directly-fetchable public http(s) URL (e.g. a re-hosted image). Login-protected or expired links fail with 'not publicly fetchable' — re-host and retry.\n" +
      "• imageBase64 — programmatic clients only. NEVER from a chat client: inline image data is blocked by client safety checks before the call is sent.\n" +
      "contentType must match the actual bytes (ChatGPT image generation outputs image/png) — verified server-side by magic-byte sniffing. " +
      "New images append to the end of the stack; set position to place one (1 = top of the page), or reorder the whole stack later with reorderLandingPageImages. " +
      "A failed job is safe to retry: every attempt gets a fresh uploadJobId.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = uploadLandingPageImageSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error:
              `Invalid arguments: ${formatIssues(parsed.error)}. ` +
              "Expected: landingPageId (UUID), contentType (image/png|jpeg|webp|gif), and exactly one of image (chat clients — file object), imageUrl (http(s) URL), or imageBase64 (programmatic clients only); " +
              "optional: altText, position, width, height. Unknown fields are rejected.",
          };
        }
        const data = parsed.data;

        if (!env?.LP_IMAGE_UPLOAD_WORKFLOW || !env.MEDIA_DOMAIN) {
          return {
            success: false,
            error:
              "Image upload is not available on this deployment — the background upload workflow is not provisioned.",
          };
        }
        if (!session) {
          return {
            success: false,
            error: "Upload requires a verified session identity — none is attached to this connection.",
          };
        }

        const existing = await queries.getLandingPageById(db, data.landingPageId);
        if (!existing) {
          return { success: false, error: `Landing page ${data.landingPageId} not found` };
        }

        const { r2Key, instanceId } = mintLandingImageUploadIds(data.contentType);

        // Resolve the three input shapes to the workflow's two entry kinds.
        let kind: "url" | "bytes";
        let imageUrl: string | undefined;
        if (data.image !== undefined) {
          const { download_url: downloadUrl } = data.image;
          if (!/^https?:\/\//.test(downloadUrl)) {
            return {
              success: false,
              error: "The image file's download_url must be an http(s) URL — cannot fetch it server-side.",
            };
          }
          kind = "url";
          imageUrl = downloadUrl;
        } else if (data.imageUrl !== undefined) {
          kind = "url";
          imageUrl = data.imageUrl;
        } else {
          const imageBase64 = data.imageBase64;
          if (imageBase64 === undefined) {
            return {
              success: false,
              error:
                "Provide exactly one of image (chat clients — file object), imageUrl (http(s) URL), or imageBase64 (programmatic clients only).",
            };
          }
          kind = "bytes";

          if (!env.IMAGES) {
            return { success: false, error: "Image upload is not available — R2 storage is not bound." };
          }
          let bytes: Uint8Array;
          try {
            bytes = decodeBase64Image(imageBase64);
          } catch {
            return { success: false, error: "imageBase64 is not valid base64." };
          }
          if (bytes.byteLength === 0) {
            return { success: false, error: "imageBase64 decodes to zero bytes." };
          }
          if (bytes.byteLength > MAX_IMAGE_BYTES) {
            return {
              success: false,
              error: `Image exceeds the 8 MB cap (${bytes.byteLength} bytes decoded).`,
            };
          }
          const sniffed = sniffImageType(bytes);
          const claimed = canonicalImageContentType(data.contentType);
          if (!sniffed) {
            return {
              success: false,
              error: "imageBase64 is not a recognized image (png, jpeg, webp, or gif).",
            };
          }
          if (sniffed !== claimed) {
            return {
              success: false,
              error: `Content mismatch: imageBase64 contains ${sniffed} but contentType claims ${data.contentType}.`,
            };
          }
          try {
            await env.IMAGES.put(r2Key, bytes, {
              httpMetadata: {
                contentType: claimed,
                cacheControl: "public, max-age=31536000, immutable",
              },
              customMetadata: { source: "ai", uploadedAt: new Date().toISOString() },
            });
          } catch (err) {
            return {
              success: false,
              error: `Failed to store image bytes: ${(err as Error).message}`,
            };
          }
        }

        let instance: { id: string };
        try {
          instance = await env.LP_IMAGE_UPLOAD_WORKFLOW.create({
            id: instanceId,
            params: {
              kind,
              landingPageId: data.landingPageId,
              r2Key,
              contentType: data.contentType,
              ...(imageUrl !== undefined ? { imageUrl } : {}),
              ...(data.altText !== undefined ? { altText: data.altText } : {}),
              ...(data.position !== undefined ? { position: data.position } : {}),
              ...(data.width !== undefined ? { width: data.width } : {}),
              ...(data.height !== undefined ? { height: data.height } : {}),
              actor: {
                id: session.userId,
                name: session.name || session.email || session.userId,
                role: session.role,
              },
            },
          });
        } catch (err) {
          return {
            success: false,
            error: `Failed to start the background upload: ${(err as Error).message}`,
          };
        }

        return {
          success: true,
          uploadJobId: instance.id,
          status: "processing",
          r2Key,
          src: `https://${env.MEDIA_DOMAIN}/${r2Key}`,
          note: "The upload runs in the background. Call getLandingPageImageUploadStatus with uploadJobId until status is 'complete' or 'failed'.",
        };
      } catch (error) {
        return { success: false, error: `Failed to upload image: ${(error as Error).message}` };
      }
    },
  }),

  getLandingPageImageUploadStatus: tool({
    description:
      "Check the progress of a background uploadLandingPageImage job — pass the uploadJobId that tool returned. " +
      "Returns status: 'processing' (still running — keep polling), 'complete' (the image is in the stack; includes imageId, src, and position), " +
      "'failed' (includes a recoverable error — e.g. re-generate the image and retry with a fresh URL), 'stopped', or " +
      "'unknown' (job state no longer retained — check getLandingPageDetails to see whether the image landed before re-uploading).",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = getLandingPageImageUploadStatusSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: uploadJobId (the ID returned by uploadLandingPageImage). Unknown fields are rejected.`,
          };
        }

        if (!env?.LP_IMAGE_UPLOAD_WORKFLOW) {
          return {
            success: false,
            error:
              "Upload status is not available on this deployment — the background upload workflow is not provisioned.",
          };
        }

        let instance: { status(): Promise<{ status: string; error?: { message?: string } | null; output?: unknown }> };
        try {
          instance = await env.LP_IMAGE_UPLOAD_WORKFLOW.get(parsed.data.uploadJobId);
        } catch {
          return {
            success: true,
            uploadJobId: parsed.data.uploadJobId,
            status: "unknown",
            advice:
              "This job's state is no longer retained (or the ID is not a known job). " +
              "Check getLandingPageDetails to see whether the image landed before re-uploading.",
          };
        }

        const raw = await instance.status();
        return {
          success: true,
          uploadJobId: parsed.data.uploadJobId,
          ...mapUploadJobStatus(raw),
        };
      } catch (error) {
        return { success: false, error: `Failed to check upload status: ${(error as Error).message}` };
      }
    },
  }),

  removeLandingPageImage: tool({
    description:
      "Remove an image from a landing page's stack — get the current image IDs from getLandingPageDetails. " +
      "Storage note: duplicated pages can share the same underlying image object; the storage object itself is deleted only when this was its LAST referencing image. " +
      "Returns the updated stack. Removing is final for this page — restoring means re-uploading via uploadLandingPageImage.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = removeLandingPageImageSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID) and imageId (UUID). Unknown fields are rejected.`,
          };
        }
        const { landingPageId, imageId } = parsed.data;

        const image = await queries.getLandingPageImage(db, landingPageId, imageId);
        if (!image) {
          return {
            success: false,
            error: `Image ${imageId} not found on landing page ${landingPageId}`,
          };
        }

        // Same contract as the dashboard path: R2 delete FIRST — a storage
        // failure aborts so the DB record never points at a missing object;
        // shared objects (duplicates) survive until their last reference goes.
        if (image.r2Key) {
          const otherRefs = await queries.countOtherLandingPageImageReferences(
            db,
            image.r2Key,
            imageId,
          );
          if (otherRefs === 0) {
            if (!env?.IMAGES) {
              return {
                success: false,
                error: "Image removal is not available — R2 storage is not bound on this deployment.",
              };
            }
            try {
              await env.IMAGES.delete(image.r2Key);
            } catch (err) {
              return {
                success: false,
                error: `Failed to delete image from storage: ${(err as Error).message}`,
              };
            }
          }
        }

        await queries.deleteLandingPageImage(db, landingPageId, imageId);
        const images = await queries.getLandingPageImages(db, landingPageId);
        return { success: true, images, count: images.length };
      } catch (error) {
        return { success: false, error: `Failed to remove image: ${(error as Error).message}` };
      }
    },
  }),

  reorderLandingPageImages: tool({
    description:
      "Set the order of a landing page's image stack. Index 1 is the TOP of the page — the first thing shoppers see, so put the strongest creative there. " +
      "Send the COMPLETE ordered array of ALL image IDs (from getLandingPageDetails): every current image exactly once — no duplicates, no omissions. " +
      "Partial or mismatched lists are rejected. Returns the stack in its new order.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = reorderLandingPageImagesSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID) and imageIds (the complete ordered array of all image UUIDs, index 1 = top of the page). Unknown fields are rejected.`,
          };
        }

        const images = await queries.reorderLandingPageImagesChecked(
          db,
          parsed.data.landingPageId,
          parsed.data.imageIds,
        );
        return { success: true, images, count: images.length };
      } catch (error) {
        return { success: false, error: `Failed to reorder images: ${(error as Error).message}` };
      }
    },
  }),

  duplicateLandingPage: tool({
    description:
      "Duplicate a landing page: a fresh DRAFT with a new slug, the same product, spacing, SEO meta, and image stack (copies share the original storage objects). " +
      "Views, orders, revenue, and published state are NEVER copied — a duplicate is a fresh creative test, not a stats clone. " +
      "Returns the new draft with its new slug and public link.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = duplicateLandingPageSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID). Unknown fields are rejected.`,
          };
        }

        const newId = await queries.duplicateLandingPage(db, parsed.data.landingPageId);
        if (!newId) {
          return { success: false, error: `Landing page ${parsed.data.landingPageId} not found` };
        }

        const lp = await queries.getLandingPageById(db, newId);
        if (!lp) {
          return { success: false, error: "Failed to load the duplicated landing page" };
        }
        const baseUrl = await resolveStorefrontBaseUrl(db, env?.STOREFRONT_URL);
        return {
          success: true,
          landingPage: lp,
          publicPath: `/lp/${lp.slug}`,
          publicUrl: buildLandingPagePublicUrl(baseUrl, lp.slug),
          note: "Fresh draft created — views, orders, and revenue start at zero. Edit it, then publishLandingPage when ready.",
        };
      } catch (error) {
        return { success: false, error: `Failed to duplicate landing page: ${(error as Error).message}` };
      }
    },
  }),

  unpublishLandingPage: tool({
    description:
      "Return a published landing page to draft — its /lp/<slug> link stops resolving (404) but views and order attribution history stay intact. " +
      "Publish again anytime with publishLandingPage.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = unpublishLandingPageSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID). Unknown fields are rejected.`,
          };
        }

        const existing = await queries.getLandingPageById(db, parsed.data.landingPageId);
        if (!existing) {
          return { success: false, error: `Landing page ${parsed.data.landingPageId} not found` };
        }

        await queries.unpublishLandingPage(db, parsed.data.landingPageId);
        const lp = await queries.getLandingPageById(db, parsed.data.landingPageId);
        const baseUrl = await resolveStorefrontBaseUrl(db, env?.STOREFRONT_URL);
        return {
          success: true,
          landingPage: lp,
          publicPath: `/lp/${lp?.slug ?? existing.slug}`,
          publicUrl: buildLandingPagePublicUrl(baseUrl, lp?.slug ?? existing.slug),
        };
      } catch (error) {
        return { success: false, error: `Failed to unpublish: ${(error as Error).message}` };
      }
    },
  }),

  archiveLandingPage: tool({
    description:
      "Retire a landing page: the link stops resolving and the page leaves the active lists, but its order attribution history stays intact. " +
      "This is the REQUIRED exit for a page with attributed orders — deleteLandingPage refuses those and tells you to archive instead. " +
      "The page stays inspectable: its stats and attribution history remain queryable via getLandingPageDetails and getLandingPageStats.",
    inputSchema: z.object({}).passthrough(), // Layer 1: Permissive input
    execute: async (args) => {
      try {
        const parsed = archiveLandingPageSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            success: false,
            error: `Invalid arguments: ${formatIssues(parsed.error)}. Expected: landingPageId (UUID). Unknown fields are rejected.`,
          };
        }

        const existing = await queries.getLandingPageById(db, parsed.data.landingPageId);
        if (!existing) {
          return { success: false, error: `Landing page ${parsed.data.landingPageId} not found` };
        }

        await queries.archiveLandingPage(db, parsed.data.landingPageId);
        const lp = await queries.getLandingPageById(db, parsed.data.landingPageId);
        return {
          success: true,
          landingPage: lp,
          message: "Landing page archived — its order attribution history is preserved.",
        };
      } catch (error) {
        return { success: false, error: `Failed to archive landing page: ${(error as Error).message}` };
      }
    },
  }),
});

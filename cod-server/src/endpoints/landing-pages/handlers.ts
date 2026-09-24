import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import {
  createLandingPageSchema,
  updateLandingPageSchema,
  saveLandingPageImageSchema,
  reorderLandingPageImagesSchema,
  landingPageTrackingSchema,
} from "./validation";
import { maskApiKey } from "@/lib/mask";
import {
  getLandingPageTracking,
  upsertLandingPageTracking,
  deleteLandingPageTracking,
  lastCapiEventForLandingPage,
} from "../../../../cod-shared/queries/landing-page-tracking";
import { NotFoundError, SystemError, ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { logActivity, ACTIONS } from "@/lib/activity";
import {
  buildLandingPagePublicUrl,
  resolveStorefrontBaseUrl,
} from "../../../../cod-shared/queries/landing-pages";

/**
 * Resolve the storefront base URL for this request and return a decorator
 * that attaches `publicUrl` to landing page payloads. The store's own domain
 * (set by the merchant in Store Settings) wins; the optional STOREFRONT_URL
 * var is the fallback; null leaves the caller a relative path.
 */
async function publicUrlDecorator(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const baseUrl = await resolveStorefrontBaseUrl(db, c.env.STOREFRONT_URL);
  return <T extends { slug: string }>(lp: T): T & { publicUrl: string } => ({
    ...lp,
    publicUrl: buildLandingPagePublicUrl(baseUrl, lp.slug),
  });
}

export async function listLandingPages(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const withPublicUrl = await publicUrlDecorator(c);
  const productId = c.req.query("productId");
  const status = c.req.query("status");
  // Route-validated query (coerced numbers); manual fallback parses the raw
  // strings the same way the JSON-body pattern in this file does.
  const valid = (c.req as any).valid?.("query") as
    | { limit?: number; offset?: number }
    | undefined;
  const limit =
    valid?.limit ?? (c.req.query("limit") !== undefined
      ? Number(c.req.query("limit"))
      : undefined);
  const offset =
    valid?.offset ?? (c.req.query("offset") !== undefined
      ? Number(c.req.query("offset"))
      : undefined);
  const data = await queries.listLandingPages(
    db,
    {
      ...(productId ? { productId } : {}),
      ...(status === "draft" || status === "published" || status === "archived"
        ? { status }
        : {}),
    },
    { ...(limit !== undefined ? { limit } : {}), ...(offset !== undefined ? { offset } : {}) },
  );
  return c.json({ success: true, data: data.map(withPublicUrl), count: data.length }, 200);
}

export async function getLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const withPublicUrl = await publicUrlDecorator(c);
  const id = c.req.param("id")!;
  const data = await queries.getLandingPageById(db, id);
  if (!data) throw new NotFoundError("Landing Page", id);
  return c.json({ success: true, data: withPublicUrl(data) }, 200);
}

// ─── Tracking override ────────────────────────────────────────────────────────

/**
 * Safe projection. The access token goes in and never comes back out: it is a
 * credential with spend attached, so the merchant gets only enough to
 * recognise which one is stored.
 */
function trackingResponse(
  row: NonNullable<Awaited<ReturnType<typeof getLandingPageTracking>>>,
) {
  return {
    id: row.id,
    landingPageId: row.landingPageId,
    pixelId: row.pixelId,
    adAccountName: row.adAccountName,
    accessTokenMasked: maskApiKey(row.accessToken),
    testEventCode: row.testEventCode,
    conversionEvent: row.conversionEvent,
    testMode: row.testMode,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The landing page must exist before anything is said about its tracking. */
async function requireLandingPage(c: Context<AppContext>, db: ReturnType<typeof getDb>) {
  const id = c.req.param("id")!;
  const exists = await queries.getLandingPageById(db, id);
  if (!exists) throw new NotFoundError("Landing Page", id);
  return { id, landingPage: exists };
}

/**
 * This page's tracking: what is configured, and proof of what it has done.
 *
 * Both in one response because they are one question. A merchant who has just
 * pointed a campaign at a new pixel wants to know it is working, and a config
 * panel that only echoes what they typed cannot tell them.
 */
export async function getLandingPageTrackingConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { id } = await requireLandingPage(c, db);
  const [row, lastEvent] = await Promise.all([
    getLandingPageTracking(db, id),
    lastCapiEventForLandingPage(db, id),
  ]);
  return c.json(
    {
      success: true,
      data: {
        config: row ? trackingResponse(row) : null,
        lastEvent: lastEvent ?? null,
      },
    },
    200,
  );
}

export async function saveLandingPageTrackingConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { id, landingPage } = await requireLandingPage(c, db);
  const body: any = (c.req as any).valid?.("json");
  const data = body ?? landingPageTrackingSchema.parse(await c.req.json());

  // A pixel with no token would leave the browser firing at this page's pixel
  // with no server mirror behind it — measurably worse than the store pixel it
  // replaced. The schema cannot express "unless one is already stored", so the
  // rule lives here, where that is known.
  const existing = await getLandingPageTracking(db, id);
  if (!existing && !data.accessToken?.trim()) {
    throw new ValidationError(
      "A Conversions API access token is required when giving a landing page its own pixel",
      ERROR_CODES.VALIDATION_FAILED,
      { field: "accessToken" },
    );
  }

  const row = await upsertLandingPageTracking(db, id, data);
  if (!row) throw new SystemError("Failed to save landing page tracking");

  const actor = c.get("user");
  await logActivity(
    db,
    actor,
    ACTIONS.LANDING_PAGE_UPDATED,
    { type: "landing_page", id, label: landingPage.name },
    // The pixel id is public by definition; the token is never logged.
    { tracking: "override", pixelId: row.pixelId, conversionEvent: row.conversionEvent },
  );

  return c.json({ success: true, data: trackingResponse(row) }, 200);
}

export async function deleteLandingPageTrackingConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const { id, landingPage } = await requireLandingPage(c, db);
  await deleteLandingPageTracking(db, id);

  const actor = c.get("user");
  await logActivity(
    db,
    actor,
    ACTIONS.LANDING_PAGE_UPDATED,
    { type: "landing_page", id, label: landingPage.name },
    { tracking: "store" },
  );

  return c.json({ success: true }, 200);
}

export async function createLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const withPublicUrl = await publicUrlDecorator(c);
  const body: any = (c.req as any).valid?.("json");
  const data = body ?? createLandingPageSchema.parse(await c.req.json());
  const { id } = await queries.createLandingPage(db, data);
  const result = await queries.getLandingPageById(db, id);
  if (!result) throw new SystemError("Failed to load created landing page");

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_CREATED, {
    type: "landing_page", id, label: result.name,
  }, { productId: data.productId, slug: result.slug });

  return c.json({ success: true, data: withPublicUrl(result) }, 201);
}

export async function updateLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const withPublicUrl = await publicUrlDecorator(c);
  const id = c.req.param("id")!;

  const existing = await queries.getLandingPageById(db, id);
  if (!existing) throw new NotFoundError("Landing Page", id);

  const body: any = (c.req as any).valid?.("json");
  const data = body ?? updateLandingPageSchema.parse(await c.req.json());
  await queries.updateLandingPage(db, id, data);
  const result = await queries.getLandingPageById(db, id);
  if (!result) throw new SystemError("Failed to load updated landing page");

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_UPDATED, {
    type: "landing_page", id, label: result.name,
  }, { fields: Object.keys(data) });

  return c.json({ success: true, data: withPublicUrl(result) }, 200);
}

export async function deleteLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  await queries.deleteLandingPageWithGuard(db, id);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_DELETED, {
    type: "landing_page", id,
  });

  return c.json({ success: true }, 200);
}

export async function duplicateLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const newId = await queries.duplicateLandingPage(db, id);
  if (!newId) throw new NotFoundError("Landing Page", id);

  const result = await queries.getLandingPageById(db, newId);
  if (!result) throw new SystemError("Failed to load duplicated landing page");

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_CREATED, {
    type: "landing_page", id: newId, label: result.name,
  }, { duplicatedFrom: id, slug: result.slug });

  const withPublicUrl = await (await publicUrlDecorator(c))(result);
  return c.json({ success: true, data: withPublicUrl }, 201);
}

export async function publishLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const withPublicUrl = await publicUrlDecorator(c);
  const id = c.req.param("id")!;

  const existing = await queries.getLandingPageById(db, id);
  if (!existing) throw new NotFoundError("Landing Page", id);

  await queries.publishLandingPage(db, id);
  const result = await queries.getLandingPageById(db, id);
  if (!result) throw new SystemError("Failed to load landing page");

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_PUBLISHED, {
    type: "landing_page", id, label: result.name,
  }, { slug: result.slug });

  return c.json({ success: true, data: withPublicUrl(result) }, 200);
}

export async function unpublishLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const withPublicUrl = await publicUrlDecorator(c);
  const id = c.req.param("id")!;

  const existing = await queries.getLandingPageById(db, id);
  if (!existing) throw new NotFoundError("Landing Page", id);

  await queries.unpublishLandingPage(db, id);
  const result = await queries.getLandingPageById(db, id);
  if (!result) throw new SystemError("Failed to load landing page");

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_UNPUBLISHED, {
    type: "landing_page", id, label: result.name,
  });

  return c.json({ success: true, data: withPublicUrl(result) }, 200);
}

export async function archiveLandingPage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getLandingPageById(db, id);
  if (!existing) throw new NotFoundError("Landing Page", id);

  await queries.archiveLandingPage(db, id);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_ARCHIVED, {
    type: "landing_page", id, label: existing.name,
  });

  return c.json({ success: true }, 200);
}

export async function compareLandingPages(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const withPublicUrl = await publicUrlDecorator(c);
  const productId = c.req.query("productId");
  if (!productId) {
    throw new ValidationError(
      "productId query parameter is required",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
    );
  }
  const data = await queries.compareLandingPages(db, productId);
  return c.json({ success: true, data: data.map(withPublicUrl), count: data.length }, 200);
}

export async function listLandingPageImages(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const data = await queries.getLandingPageImages(db, id);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function saveLandingPageImage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getLandingPageById(db, id);
  if (!existing) throw new NotFoundError("Landing Page", id);

  const body: any = (c.req as any).valid?.("json");
  const data = body ?? saveLandingPageImageSchema.parse(await c.req.json());
  // The API contract names the field `key` (mirrors the product image API);
  // the shared query stores it as `r2Key`.
  const images = await queries.addLandingPageImage(db, id, {
    r2Key: data.key,
    src: data.src,
    altText: data.altText ?? null,
    position: data.position,
    width: data.width ?? null,
    height: data.height ?? null,
  });

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_UPDATED, {
    type: "landing_page", id, label: existing.name,
  }, { action: "image_added", r2Key: data.key });

  return c.json({ success: true, data: images }, 201);
}

export async function reorderLandingPageImages(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getLandingPageById(db, id);
  if (!existing) throw new NotFoundError("Landing Page", id);

  const body: any = (c.req as any).valid?.("json");
  const data = body ?? reorderLandingPageImagesSchema.parse(await c.req.json());
  const images = await queries.reorderLandingPageImagesChecked(db, id, data.imageIds);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.LANDING_PAGE_UPDATED, {
    type: "landing_page", id, label: existing.name,
  }, { action: "images_reordered", order: data.imageIds });

  return c.json({ success: true, data: images }, 200);
}

export async function deleteLandingPageImage(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const imageId = c.req.param("imageId")!;
  const bucket = c.env.IMAGES;

  const image = await queries.getLandingPageImage(db, id, imageId);
  if (!image) throw new NotFoundError("Image", imageId);

  // R2 delete first — a storage failure aborts so the DB record never
  // points at a missing object (same contract as product images).
  // Shared-object guard: duplicates reference the SAME immutable R2 key;
  // only remove the object when this is its last landing-page reference.
  if (image.r2Key) {
    const otherRefs = await queries.countOtherLandingPageImageReferences(
      db,
      image.r2Key,
      imageId,
    );
    if (otherRefs === 0) {
      try {
        await bucket.delete(image.r2Key);
      } catch (error) {
        console.error(`R2 delete failed for key: ${image.r2Key}`, error);
        throw new SystemError(
          "Failed to delete image from storage",
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          { imageId, r2Key: image.r2Key, error: error instanceof Error ? error.message : String(error) },
        );
      }
    }
  }

  await queries.deleteLandingPageImage(db, id, imageId);
  return c.json({ success: true }, 200);
}

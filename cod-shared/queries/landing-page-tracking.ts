/**
 * A landing page's own Meta Pixel + Conversions API configuration.
 *
 * Reads and writes only. Which configuration actually applies to a page view
 * or an order is decided in `tracking-config.ts` — nothing here knows about
 * precedence, the master switch, or the store's row.
 *
 * The token is write-only by the same contract the store's config uses: the
 * dashboard receives a masked hint and never the value, so "unchanged" reaches
 * this module as an empty string and must keep what is stored. Blanking it
 * would leave the browser firing at the page's pixel with no server mirror
 * behind it — a measurement failure caused by a merchant editing a label.
 */
import type { AppDb } from "../db/client";
import { landingPagePixelConfig, capiEventLog, orders } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import type { ConversionEvent } from "./pixel-config";

export async function getLandingPageTracking(db: AppDb, landingPageId: string) {
  return db
    .select()
    .from(landingPagePixelConfig)
    .where(eq(landingPagePixelConfig.landingPageId, landingPageId))
    .get();
}

export interface UpsertLandingPageTrackingData {
  pixelId: string;
  /** Empty or absent keeps the stored token. */
  accessToken?: string;
  /** Absent keeps the stored value; empty clears it. */
  adAccountName?: string | null;
  /** Absent keeps the stored value; empty clears it. */
  testEventCode?: string | null;
  conversionEvent?: ConversionEvent;
  testMode?: boolean;
  enabled?: boolean;
}

export async function upsertLandingPageTracking(
  db: AppDb,
  landingPageId: string,
  data: UpsertLandingPageTrackingData,
) {
  const now = new Date().toISOString();
  const existing = await getLandingPageTracking(db, landingPageId);

  const accessToken = data.accessToken?.trim() || existing?.accessToken || "";
  const adAccountName =
    data.adAccountName === undefined
      ? existing?.adAccountName ?? null
      : data.adAccountName?.trim() || null;
  const testEventCode =
    data.testEventCode === undefined
      ? existing?.testEventCode ?? null
      : data.testEventCode?.trim() || null;

  if (existing) {
    return db
      .update(landingPagePixelConfig)
      .set({
        pixelId: data.pixelId,
        adAccountName,
        accessToken,
        testEventCode,
        conversionEvent: data.conversionEvent ?? existing.conversionEvent,
        testMode: data.testMode ?? existing.testMode,
        enabled: data.enabled ?? existing.enabled,
        updatedAt: now,
      })
      .where(eq(landingPagePixelConfig.landingPageId, landingPageId))
      .returning()
      .get();
  }

  const row = {
    id: crypto.randomUUID(),
    landingPageId,
    pixelId: data.pixelId,
    adAccountName,
    accessToken,
    testEventCode,
    conversionEvent: data.conversionEvent ?? ("Purchase" as const),
    testMode: data.testMode ?? false,
    enabled: data.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(landingPagePixelConfig).values(row);
  return row;
}

/** Return the page to the store pixel. */
export async function deleteLandingPageTracking(db: AppDb, landingPageId: string) {
  await db
    .delete(landingPagePixelConfig)
    .where(eq(landingPagePixelConfig.landingPageId, landingPageId));
}

/**
 * The most recent Conversions API attempt for any order this page produced.
 *
 * Answers the one question a merchant has after pointing a campaign at a new
 * pixel — "is it working?" — without making them open Events Manager. A
 * failure is reported with Meta's own message, because a silent "nothing yet"
 * when the token was rejected leaves them waiting instead of fixing it.
 *
 * Reported for pages with no override too: such a page still sells, and an
 * empty box there would read as broken rather than as inherited.
 *
 * `orders.landing_page_id` is indexed (migration 0019), so this is a keyed
 * lookup rather than a scan.
 */
export async function lastCapiEventForLandingPage(db: AppDb, landingPageId: string) {
  return db
    .select({
      eventName: capiEventLog.eventName,
      stage: capiEventLog.stage,
      status: capiEventLog.status,
      pixelId: capiEventLog.pixelId,
      error: capiEventLog.error,
      sentAt: capiEventLog.sentAt,
    })
    .from(capiEventLog)
    .innerJoin(orders, eq(capiEventLog.orderId, orders.id))
    .where(eq(orders.landingPageId, landingPageId))
    .orderBy(desc(capiEventLog.sentAt))
    .limit(1)
    .get();
}

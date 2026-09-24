/**
 * The effective Meta tracking configuration for a page view or an order.
 *
 * WHY THIS EXISTS
 *
 * CodFlow reports every sale twice on purpose: once from the shopper's browser
 * (the Pixel) and once from our server (the Conversions API). Meta merges the
 * two into one conversion only when both were sent to the *same pixel id* —
 * `capi-deduplication.md`:
 *
 *   > If we find the same server key combination (event_id and event_name) and
 *   > browser key combination (eventID and event) sent to the same Pixel ID
 *   > within 48 hours, we discard the subsequent events.
 *
 * So a browser and a server that disagree about the destination do not produce
 * one conversion. They produce two wrong ones, in two ad accounts. Every sender
 * therefore reads the answer from here instead of working it out: browser and
 * server cannot diverge when neither of them decides.
 *
 * TWO ACCESSORS, ONE RULE
 *
 *   resolveTrackingConfig  — server-side senders. Carries the access token.
 *   resolvePublicTracking  — anything that reaches a browser. Never does.
 *
 * The split is structural rather than a matter of discipline: the token has no
 * route into a client-facing payload because the function those callers use
 * does not return it.
 */
import type { AppDb } from "../db/client";
import { storePixelConfig, landingPagePixelConfig } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ConversionEvent } from "./pixel-config";

export type { ConversionEvent };

/** What a page view or an order belongs to. */
export interface TrackingContext {
  storeId: string;
  /**
   * The landing page this page view or order belongs to, when it has one.
   * Everything else — product pages, the catalogue, the cart — passes nothing
   * and keeps reporting to the store pixel.
   */
  landingPageId?: string | null;
}

/**
 * Everything a server-side sender needs to talk to Meta about this context.
 *
 * `enabled` is reported, not applied: the CAPI gate (`resolveCapiDispatch`)
 * turns a switched-off configuration into a specific skip reason in the event
 * log, which it cannot do if this returns null instead.
 */
export interface EffectiveTrackingConfig {
  pixelId: string;
  accessToken: string;
  conversionEvent: ConversionEvent;
  testMode: boolean;
  testEventCode: string | null;
  enabled: boolean;
}

/**
 * The same decision, reduced to what may be rendered into a public page.
 *
 * `pixelId` is null whenever no pixel should load — unconfigured, or switched
 * off. `conversionEvent` is always a valid mode so callers never branch on
 * null; it is inert while `pixelId` is null.
 */
export interface PublicTracking {
  pixelId: string | null;
  conversionEvent: ConversionEvent;
}

const NO_TRACKING: PublicTracking = { pixelId: null, conversionEvent: "Purchase" };

/** The two config tables are deliberate mirrors, so one mapper serves both. */
type ConfigRow = Pick<
  typeof storePixelConfig.$inferSelect,
  "pixelId" | "accessToken" | "conversionEvent" | "testMode" | "testEventCode" | "enabled"
>;

/** A store's row, as read from D1 or assembled by a caller that batched it. */
export type StoreConfigRow = ConfigRow & StoreTrackingSwitches;
/** A landing page's row, same shape minus the store-level switches. */
export type PageConfigRow = ConfigRow;

function toEffective(row: ConfigRow): EffectiveTrackingConfig {
  return {
    pixelId: row.pixelId,
    accessToken: row.accessToken,
    conversionEvent: row.conversionEvent,
    testMode: row.testMode,
    testEventCode: row.testEventCode,
    enabled: row.enabled,
  };
}

/** What the store's switches say, from either the row or an API payload. */
export interface StoreTrackingSwitches {
  enabled: boolean;
  perPageTrackingEnabled: boolean;
}

/** What a page's override says, from either the row or an API payload. */
export interface PageTrackingSwitches {
  enabled: boolean;
  pixelId: string;
}

/**
 * Whether a landing page's own pixel actually applies.
 *
 * Exported because the dashboard has to tell the merchant whether the pixel
 * they configured is being used, and a second implementation of this rule over
 * there would eventually disagree with this one — leaving a badge that says
 * "own pixel" over conversions landing in the store's ad account. One rule,
 * both callers.
 */
export function overrideApplies(
  store: StoreTrackingSwitches | null | undefined,
  page: PageTrackingSwitches | null | undefined,
): boolean {
  if (!store?.enabled || !store.perPageTrackingEnabled) return false;
  return Boolean(page?.enabled && page.pixelId);
}

/**
 * Precedence, in the one place it is allowed to live:
 *
 *   store has no tracking row      → null              (nothing to send with)
 *   store tracking switched off    → the store row     (off means off, on every page)
 *   master switch off              → the store row     (the feature's rollback)
 *   no landing page                → the store row     (product pages, catalogue, cart)
 *   no override, or a switched-off
 *     or blank one                 → the store row
 *   otherwise                      → the landing page's own configuration
 *
 * Every branch that is not the last one lands on exactly today's behaviour, so
 * there is no state in which this feature produces nothing.
 *
 * Pure, so a caller that already has both rows — the landing page endpoint
 * batches them with the page itself — spends no extra round trip to ask.
 */
export function effectiveTrackingFrom(
  storeRow: StoreConfigRow | null | undefined,
  pageRow: PageConfigRow | null | undefined,
): EffectiveTrackingConfig | null {
  if (!storeRow) return null;
  if (overrideApplies(storeRow, pageRow)) return toEffective(pageRow!);
  return toEffective(storeRow);
}

/** The same decision, reduced to what may be rendered into a public page. */
export function publicTrackingFrom(
  storeRow: StoreConfigRow | null | undefined,
  pageRow: PageConfigRow | null | undefined,
): PublicTracking {
  const config = effectiveTrackingFrom(storeRow, pageRow);
  if (!config?.enabled || !config.pixelId) return NO_TRACKING;

  return { pixelId: config.pixelId, conversionEvent: config.conversionEvent };
}

export async function resolveTrackingConfig(
  db: AppDb,
  ctx: TrackingContext,
): Promise<EffectiveTrackingConfig | null> {
  const storeRow = await db
    .select()
    .from(storePixelConfig)
    .where(eq(storePixelConfig.storeId, ctx.storeId))
    .get();

  if (!storeRow) return null;

  // A second read only happens for a landing page on a store that asked for
  // per-page tracking — the storefront's hot paths still cost one query.
  const pageRow =
    ctx.landingPageId && storeRow.enabled && storeRow.perPageTrackingEnabled
      ? await db
          .select()
          .from(landingPagePixelConfig)
          .where(eq(landingPagePixelConfig.landingPageId, ctx.landingPageId))
          .get()
      : undefined;

  return effectiveTrackingFrom(storeRow, pageRow);
}

export async function resolvePublicTracking(
  db: AppDb,
  ctx: TrackingContext,
): Promise<PublicTracking> {
  const config = await resolveTrackingConfig(db, ctx);
  if (!config?.enabled || !config.pixelId) return NO_TRACKING;

  return { pixelId: config.pixelId, conversionEvent: config.conversionEvent };
}

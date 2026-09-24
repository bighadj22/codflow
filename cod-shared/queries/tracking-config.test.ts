/**
 * The effective tracking configuration — resolved on a real D1.
 *
 * This module decides which Meta pixel an event belongs to. Meta deduplicates
 * a browser event against its server mirror only when both were sent to the
 * SAME pixel id (capi-deduplication.md); a browser and a server that disagree
 * do not produce one conversion, they produce two wrong ones in two ad
 * accounts. So the answer is resolved here, once, and every sender is told it.
 *
 * Two sources: the store, and a landing page that has been given a pixel of
 * its own. Most of the precedence matrix below asserts the FALLBACK — every
 * branch that is not "the page has its own enabled pixel" must land on exactly
 * the behaviour that existed before this feature, because a merchant who never
 * opens the panel must see no change at all.
 *
 * Real D1, not the mock db: the mock maps a full-table select positionally by
 * schema column order and would happily agree with a resolver that read the
 * wrong row.
 */
/// <reference types="vitest/globals" />

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import {
  resolveTrackingConfig,
  resolvePublicTracking,
  overrideApplies,
} from "./tracking-config";

let harness: TestD1;
const NOW = () => new Date().toISOString();
let seq = 0;

beforeAll(async () => {
  harness = await createTestD1();
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

/** A store with no tracking row at all — the day-one state of every store. */
async function seedStore(): Promise<string> {
  const id = `store-tc-${++seq}`;
  await harness.db.insert(schema.stores).values({
    id,
    name: `Store ${seq}`,
    createdAt: NOW(),
    updatedAt: NOW(),
  });
  return id;
}

async function seedStorePixel(
  storeId: string,
  overrides: Partial<typeof schema.storePixelConfig.$inferInsert> = {},
) {
  await harness.db.insert(schema.storePixelConfig).values({
    id: `spc-${storeId}`,
    storeId,
    pixelId: "1111111111",
    accessToken: "EAAG-store-token",
    conversionEvent: "Purchase",
    testMode: false,
    enabled: true,
    createdAt: NOW(),
    updatedAt: NOW(),
    ...overrides,
  });
}

/** A published landing page, optionally with a tracking override of its own. */
async function seedLandingPage(
  override?: Partial<typeof schema.landingPagePixelConfig.$inferInsert>,
): Promise<string> {
  const n = ++seq;
  const productId = `prod-tc-${n}`;
  const landingPageId = `lp-tc-${n}`;

  await harness.db.insert(schema.products).values({
    id: productId,
    name: `Product ${n}`,
    handle: `product-tc-${n}`,
    price: 5000,
    hasVariants: false,
    inventory: 10,
    trackInventory: true,
    lowStockThreshold: 2,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    storeFeatured: false,
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  await harness.db.insert(schema.landingPages).values({
    id: landingPageId,
    slug: `lp-tc-${n}`,
    name: `Landing page ${n}`,
    productId,
    status: "published",
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  if (override) {
    await harness.db.insert(schema.landingPagePixelConfig).values({
      id: `lppc-${n}`,
      landingPageId,
      pixelId: "8888888888",
      accessToken: "EAAG-page-token",
      conversionEvent: "Purchase",
      testMode: false,
      enabled: true,
      createdAt: NOW(),
      updatedAt: NOW(),
      ...override,
    });
  }

  return landingPageId;
}

describe("overrideApplies — the rule the dashboard shows and the server obeys", () => {
  // The dashboard has to tell a merchant whether the pixel they configured is
  // actually being used. If it worked that out for itself, the badge and the
  // server could drift and the merchant would be told a lie about where their
  // conversions are going. Both call this.
  const on = { enabled: true, perPageTrackingEnabled: true };
  const page = { enabled: true, pixelId: "8888888888" };

  it("applies when the store asked for it and the page has an enabled pixel", () => {
    expect(overrideApplies(on, page)).toBe(true);
  });

  it("does not apply while the master switch is off", () => {
    expect(overrideApplies({ enabled: true, perPageTrackingEnabled: false }, page)).toBe(false);
  });

  it("does not apply while store-level tracking is off", () => {
    expect(overrideApplies({ enabled: false, perPageTrackingEnabled: true }, page)).toBe(false);
  });

  it("does not apply when the page has no override", () => {
    expect(overrideApplies(on, null)).toBe(false);
    expect(overrideApplies(on, undefined)).toBe(false);
  });

  it("does not apply when the page's override is switched off", () => {
    expect(overrideApplies(on, { enabled: false, pixelId: "8888888888" })).toBe(false);
  });

  it("does not apply when the page's pixel is blank", () => {
    expect(overrideApplies(on, { enabled: true, pixelId: "" })).toBe(false);
  });

  it("does not apply when the store has no tracking row at all", () => {
    expect(overrideApplies(null, page)).toBe(false);
    expect(overrideApplies(undefined, page)).toBe(false);
  });
});

describe("resolveTrackingConfig — what a server-side sender reads", () => {
  it("returns null when the store has never configured tracking", async () => {
    const storeId = await seedStore();

    expect(await resolveTrackingConfig(harness.db, { storeId })).toBeNull();
  });

  it("returns the stored configuration, access token included", async () => {
    // The CAPI client takes the token as an argument (lib/capi.ts). This is
    // the one shape allowed to carry it, and it never reaches a browser.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { pixelId: "2222222222", conversionEvent: "Lead" });

    const config = await resolveTrackingConfig(harness.db, { storeId });

    expect(config).toMatchObject({
      pixelId: "2222222222",
      accessToken: "EAAG-store-token",
      conversionEvent: "Lead",
      enabled: true,
    });
  });

  it("returns a switched-off configuration rather than null", async () => {
    // `enabled` is gated by the callers (resolveCapiDispatch, the public
    // projection below), not by this function. Returning null here would
    // change which skip reason the CAPI log records.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { enabled: false });

    const config = await resolveTrackingConfig(harness.db, { storeId });

    expect(config).not.toBeNull();
    expect(config?.enabled).toBe(false);
  });

  it("reads the configuration of the store it was asked about", async () => {
    const a = await seedStore();
    const b = await seedStore();
    await seedStorePixel(a, { pixelId: "AAAAAAAAAA" });
    await seedStorePixel(b, { pixelId: "BBBBBBBBBB" });

    expect((await resolveTrackingConfig(harness.db, { storeId: a }))?.pixelId).toBe("AAAAAAAAAA");
    expect((await resolveTrackingConfig(harness.db, { storeId: b }))?.pixelId).toBe("BBBBBBBBBB");
  });
});

describe("resolvePublicTracking — what a browser is allowed to know", () => {
  it("reports no pixel when the store has never configured tracking", async () => {
    const storeId = await seedStore();

    expect(await resolvePublicTracking(harness.db, { storeId })).toEqual({
      pixelId: null,
      conversionEvent: "Purchase",
    });
  });

  it("reports no pixel when tracking is switched off", async () => {
    // A merchant who switches tracking off expects their storefront to stop
    // loading the pixel — not to keep firing at it with the events disabled.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { enabled: false, conversionEvent: "Lead" });

    expect(await resolvePublicTracking(harness.db, { storeId })).toEqual({
      pixelId: null,
      conversionEvent: "Purchase",
    });
  });

  it("reports the pixel and the merchant's conversion event when tracking is on", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { pixelId: "3333333333", conversionEvent: "Purchase_Delivered" });

    expect(await resolvePublicTracking(harness.db, { storeId })).toEqual({
      pixelId: "3333333333",
      conversionEvent: "Purchase_Delivered",
    });
  });

  it("treats a blank pixel id as no pixel", async () => {
    // The column is NOT NULL but an empty string satisfies it. Rendering
    // fbq('init', '') would install a pixel that belongs to nobody; every
    // consumer already treats "" as falsy, so this only makes the payload say
    // what the storefront was going to do anyway.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { pixelId: "" });

    expect(await resolvePublicTracking(harness.db, { storeId })).toEqual({
      pixelId: null,
      conversionEvent: "Purchase",
    });
  });

  it("never carries the access token", async () => {
    // Structural, not a field check: a careless `...row` spread must fail
    // here. This payload is rendered into storefront HTML.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { accessToken: "EAAG-must-never-ship" });

    const publicTracking = await resolvePublicTracking(harness.db, { storeId });

    expect(JSON.stringify(publicTracking)).not.toContain("EAAG-must-never-ship");
    expect(Object.keys(publicTracking).sort()).toEqual(["conversionEvent", "pixelId"]);
  });
});

describe("precedence — when a landing page's own pixel wins", () => {
  it("uses the store pixel when the page has no override", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });
    const landingPageId = await seedLandingPage();

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config?.pixelId).toBe("1111111111");
  });

  it("uses the store pixel while the master switch is off, override or not", async () => {
    // The single rollback: one flip, and every override row is ignored without
    // being lost. Honoured here and nowhere else, so the browser and the
    // Conversions API cannot disagree about whether the feature is on.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: false, pixelId: "1111111111" });
    const landingPageId = await seedLandingPage({ pixelId: "8888888888" });

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config?.pixelId).toBe("1111111111");
  });

  it("uses the page's own pixel and token once the master switch is on", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });
    const landingPageId = await seedLandingPage({
      pixelId: "8888888888",
      accessToken: "EAAG-page-token",
    });

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config).toMatchObject({
      pixelId: "8888888888",
      accessToken: "EAAG-page-token",
    });
  });

  it("replaces the store pixel rather than adding to it", async () => {
    // The whole point: a merchant testing eight products does not want the
    // store pixel learning from all eight at once. One destination, never two.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });
    const landingPageId = await seedLandingPage({ pixelId: "8888888888" });

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config?.pixelId).not.toBe("1111111111");
  });

  it("carries the page's own conversion event, test mode and test code", async () => {
    // A product confirming at 40% may deserve a different optimisation event
    // from one at 80% — the override is the whole configuration, not a pixel id.
    const storeId = await seedStore();
    await seedStorePixel(storeId, {
      perPageTrackingEnabled: true,
      conversionEvent: "Purchase",
      testMode: false,
      testEventCode: null,
    });
    const landingPageId = await seedLandingPage({
      conversionEvent: "Purchase_Delivered",
      testMode: true,
      testEventCode: "TEST9999",
    });

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config).toMatchObject({
      conversionEvent: "Purchase_Delivered",
      testMode: true,
      testEventCode: "TEST9999",
    });
  });

  it("falls back to the store pixel when the override is switched off", async () => {
    // Switching an override off must not lose what was configured.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });
    const landingPageId = await seedLandingPage({ pixelId: "8888888888", enabled: false });

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config?.pixelId).toBe("1111111111");
  });

  it("falls back to the store pixel when the override has a blank pixel id", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });
    const landingPageId = await seedLandingPage({ pixelId: "" });

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config?.pixelId).toBe("1111111111");
  });

  it("uses the store pixel for a page view that belongs to no landing page", async () => {
    // Product pages, the catalogue, the cart — everything outside a landing
    // page keeps reporting to the store pixel.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });
    await seedLandingPage({ pixelId: "8888888888" });

    expect((await resolveTrackingConfig(harness.db, { storeId }))?.pixelId).toBe("1111111111");
    expect(
      (await resolveTrackingConfig(harness.db, { storeId, landingPageId: null }))?.pixelId,
    ).toBe("1111111111");
  });

  it("keeps tracking off everywhere when the store has switched it off", async () => {
    // `enabled` is the merchant saying "stop sending to Meta". An override
    // must not survive it — off means off, on every page.
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, enabled: false });
    const landingPageId = await seedLandingPage({ pixelId: "8888888888", enabled: true });

    const config = await resolveTrackingConfig(harness.db, { storeId, landingPageId });

    expect(config?.enabled).toBe(false);
    expect(config?.pixelId).not.toBe("8888888888");
  });

  it("gives each landing page its own pixel", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true });
    const first = await seedLandingPage({ pixelId: "AAAA000000" });
    const second = await seedLandingPage({ pixelId: "BBBB000000" });

    expect(
      (await resolveTrackingConfig(harness.db, { storeId, landingPageId: first }))?.pixelId,
    ).toBe("AAAA000000");
    expect(
      (await resolveTrackingConfig(harness.db, { storeId, landingPageId: second }))?.pixelId,
    ).toBe("BBBB000000");
  });

  it("ignores an override for a landing page id that does not exist", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });

    const config = await resolveTrackingConfig(harness.db, {
      storeId,
      landingPageId: "lp-that-never-existed",
    });

    expect(config?.pixelId).toBe("1111111111");
  });
});

describe("the public projection under an override", () => {
  it("reports the page's pixel to the browser", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true, pixelId: "1111111111" });
    const landingPageId = await seedLandingPage({
      pixelId: "8888888888",
      conversionEvent: "Lead",
    });

    expect(await resolvePublicTracking(harness.db, { storeId, landingPageId })).toEqual({
      pixelId: "8888888888",
      conversionEvent: "Lead",
    });
  });

  it("never carries the page's access token either", async () => {
    const storeId = await seedStore();
    await seedStorePixel(storeId, { perPageTrackingEnabled: true });
    const landingPageId = await seedLandingPage({
      accessToken: "EAAG-page-must-never-ship",
    });

    const publicTracking = await resolvePublicTracking(harness.db, { storeId, landingPageId });

    expect(JSON.stringify(publicTracking)).not.toContain("EAAG-page-must-never-ship");
    expect(Object.keys(publicTracking).sort()).toEqual(["conversionEvent", "pixelId"]);
  });
})
;

/**
 * Reading and writing a landing page's own tracking configuration.
 *
 * The write-only token contract matters more here than it does for the store:
 * the dashboard never receives the stored token back (only a masked hint), so
 * an update that leaves the field untouched must keep what is stored rather
 * than blank it. A blanked token means the browser keeps firing at the page's
 * pixel while the Conversions API cannot mirror it — measurable damage, from a
 * merchant doing nothing but renaming their ad account.
 *
 * Real D1: this is a two-table feature with a cascade, and the mock db cannot
 * model either.
 */
/// <reference types="vitest/globals" />

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getLandingPageTracking,
  upsertLandingPageTracking,
  deleteLandingPageTracking,
} from "./landing-page-tracking";
import { duplicateLandingPage } from "./landing-pages";

let harness: TestD1;
const NOW = () => new Date().toISOString();
let seq = 0;

beforeAll(async () => {
  harness = await createTestD1();
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

async function seedLandingPage(): Promise<string> {
  const n = ++seq;
  const productId = `prod-lpt-${n}`;
  const landingPageId = `lp-lpt-${n}`;

  await harness.db.insert(schema.products).values({
    id: productId,
    name: `Product ${n}`,
    handle: `product-lpt-${n}`,
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
    slug: `lp-lpt-${n}`,
    name: `Landing page ${n}`,
    productId,
    status: "published",
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  return landingPageId;
}

describe("getLandingPageTracking", () => {
  it("returns undefined for a page that inherits the store pixel", async () => {
    const landingPageId = await seedLandingPage();

    expect(await getLandingPageTracking(harness.db, landingPageId)).toBeUndefined();
  });

  it("returns the page's own row once one exists", async () => {
    const landingPageId = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "EAAG-page",
      conversionEvent: "Lead",
    });

    expect(await getLandingPageTracking(harness.db, landingPageId)).toMatchObject({
      landingPageId,
      pixelId: "4444444444",
      conversionEvent: "Lead",
      enabled: true,
    });
  });
});

describe("upsertLandingPageTracking", () => {
  it("creates a row with the merchant's choices and safe defaults", async () => {
    const landingPageId = await seedLandingPage();

    const row = await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "EAAG-page",
      conversionEvent: "Purchase_Delivered",
    });

    expect(row).toMatchObject({
      landingPageId,
      pixelId: "4444444444",
      accessToken: "EAAG-page",
      conversionEvent: "Purchase_Delivered",
      testMode: false,
      enabled: true,
    });
  });

  it("keeps the stored token when the field comes back empty", async () => {
    // The dashboard only ever sees a masked hint, so "unchanged" arrives as an
    // empty string. Blanking the token here would silently stop the server
    // mirror while the browser kept firing.
    const landingPageId = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "EAAG-original",
      conversionEvent: "Purchase",
    });

    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "5555555555",
      accessToken: "",
      conversionEvent: "Purchase",
    });

    const row = await getLandingPageTracking(harness.db, landingPageId);
    expect(row?.accessToken).toBe("EAAG-original");
    expect(row?.pixelId).toBe("5555555555");
  });

  it("replaces the token when a new one is typed", async () => {
    const landingPageId = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "EAAG-original",
      conversionEvent: "Purchase",
    });

    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "  EAAG-rotated  ",
      conversionEvent: "Purchase",
    });

    expect((await getLandingPageTracking(harness.db, landingPageId))?.accessToken).toBe(
      "EAAG-rotated",
    );
  });

  it("keeps the ad account label and test code when omitted, clears them when blanked", async () => {
    const landingPageId = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "EAAG-page",
      adAccountName: "  Zinc Ads  ",
      testEventCode: "  TEST42  ",
      conversionEvent: "Purchase",
      testMode: true,
    });

    let row = await getLandingPageTracking(harness.db, landingPageId);
    expect(row?.adAccountName).toBe("Zinc Ads");
    expect(row?.testEventCode).toBe("TEST42");

    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      conversionEvent: "Purchase",
    });
    row = await getLandingPageTracking(harness.db, landingPageId);
    expect(row?.adAccountName).toBe("Zinc Ads");
    expect(row?.testEventCode).toBe("TEST42");
    expect(row?.testMode).toBe(true);

    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      adAccountName: "",
      testEventCode: "",
      conversionEvent: "Purchase",
      testMode: false,
    });
    row = await getLandingPageTracking(harness.db, landingPageId);
    expect(row?.adAccountName).toBeNull();
    expect(row?.testEventCode).toBeNull();
    expect(row?.testMode).toBe(false);
  });

  it("updates the page in hand and leaves every other page alone", async () => {
    const first = await seedLandingPage();
    const second = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, first, {
      pixelId: "AAAA111111",
      accessToken: "EAAG-a",
      conversionEvent: "Purchase",
    });
    await upsertLandingPageTracking(harness.db, second, {
      pixelId: "BBBB222222",
      accessToken: "EAAG-b",
      conversionEvent: "Purchase",
    });

    await upsertLandingPageTracking(harness.db, first, {
      pixelId: "CCCC333333",
      conversionEvent: "Purchase",
    });

    expect((await getLandingPageTracking(harness.db, first))?.pixelId).toBe("CCCC333333");
    expect((await getLandingPageTracking(harness.db, second))?.pixelId).toBe("BBBB222222");
  });
});

describe("deleteLandingPageTracking", () => {
  it("returns the page to the store pixel", async () => {
    const landingPageId = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "EAAG-page",
      conversionEvent: "Purchase",
    });

    await deleteLandingPageTracking(harness.db, landingPageId);

    expect(await getLandingPageTracking(harness.db, landingPageId)).toBeUndefined();
  });

  it("is safe on a page that never had an override", async () => {
    const landingPageId = await seedLandingPage();

    await expect(deleteLandingPageTracking(harness.db, landingPageId)).resolves.not.toThrow();
  });
});

describe("the row's lifetime", () => {
  it("goes away with the landing page it belongs to", async () => {
    // Deleting a landing page is already refused once it has orders, so this
    // cascade only ever fires for a page that never sold anything — its
    // tracking configuration has no reason to outlive it.
    const landingPageId = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, landingPageId, {
      pixelId: "4444444444",
      accessToken: "EAAG-page",
      conversionEvent: "Purchase",
    });

    await harness.raw.prepare("PRAGMA foreign_keys = ON").run();
    await harness.db.delete(schema.landingPages).where(eq(schema.landingPages.id, landingPageId));

    expect(await getLandingPageTracking(harness.db, landingPageId)).toBeUndefined();
  });
});

describe("duplicating a landing page", () => {
  it("copies the tracking override with it", async () => {
    // A duplicate is a fresh creative test of the same product for the same
    // campaign, so the same pixel is the unsurprising answer — and every other
    // setting is already copied. The Studio shows it plainly, so changing it
    // is one click.
    const source = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, source, {
      pixelId: "9090909090",
      accessToken: "EAAG-source",
      adAccountName: "Zinc Ads",
      conversionEvent: "Purchase_Delivered",
    });

    const copyId = await duplicateLandingPage(harness.db, source);

    expect(copyId).toBeTruthy();
    expect(await getLandingPageTracking(harness.db, copyId!)).toMatchObject({
      landingPageId: copyId,
      pixelId: "9090909090",
      accessToken: "EAAG-source",
      adAccountName: "Zinc Ads",
      conversionEvent: "Purchase_Delivered",
    });
  });

  it("leaves the copy on the store pixel when the source had no override", async () => {
    const source = await seedLandingPage();

    const copyId = await duplicateLandingPage(harness.db, source);

    expect(await getLandingPageTracking(harness.db, copyId!)).toBeUndefined();
  });

  it("gives the copy its own row, so editing one does not change the other", async () => {
    const source = await seedLandingPage();
    await upsertLandingPageTracking(harness.db, source, {
      pixelId: "1010101010",
      accessToken: "EAAG-source",
      conversionEvent: "Purchase",
    });

    const copyId = await duplicateLandingPage(harness.db, source);
    await upsertLandingPageTracking(harness.db, copyId!, {
      pixelId: "2020202020",
      conversionEvent: "Purchase",
    });

    expect((await getLandingPageTracking(harness.db, source))?.pixelId).toBe("1010101010");
    expect((await getLandingPageTracking(harness.db, copyId!))?.pixelId).toBe("2020202020");
  });
});

/**
 * What the Studio and the list say about a landing page's tracking.
 *
 * The state that matters most is the third one: a merchant who configured a
 * page pixel but never turned on per-page tracking in Settings. Telling them
 * "own pixel" there would be a lie — their conversions are still landing in the
 * store's ad account — and it is exactly the kind of silent mismatch this whole
 * feature exists to prevent.
 *
 * The rule itself lives in cod-shared and is the same one the server obeys;
 * these tests pin how it is PRESENTED.
 */
import { describe, expect, it } from "vitest";
import { trackingView } from "./model";
import type { LandingPageTracking } from "./types";

const override = (
  overrides: Partial<LandingPageTracking> = {},
): LandingPageTracking => ({
  id: "lppc_1",
  landingPageId: "lp_1",
  pixelId: "8888888888",
  adAccountName: null,
  accessTokenMasked: "••••x9Kq",
  testEventCode: null,
  conversionEvent: "Purchase",
  testMode: false,
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const storeOn = { enabled: true, perPageTrackingEnabled: true };

describe("trackingView", () => {
  it("says the page uses the store pixel when it has no override", () => {
    expect(trackingView(storeOn, null)).toEqual({ kind: "store" });
  });

  it("says the page uses the store pixel even before the master switch is on", () => {
    // Nothing is configured, so there is nothing to warn about.
    expect(trackingView({ enabled: true, perPageTrackingEnabled: false }, null)).toEqual({
      kind: "store",
    });
  });

  it("reports the page's own pixel and event once it is live", () => {
    expect(trackingView(storeOn, override({ pixelId: "1234567890" }))).toEqual({
      kind: "own",
      pixelId: "1234567890",
      conversionEvent: "Purchase",
      testMode: false,
    });
  });

  it("warns when a pixel is configured but per-page tracking is off in Settings", () => {
    // The merchant's conversions are going to the store pixel. Saying "own
    // pixel" here would be the lie.
    expect(
      trackingView({ enabled: true, perPageTrackingEnabled: false }, override()),
    ).toEqual({ kind: "inactive", reason: "master_switch", pixelId: "8888888888" });
  });

  it("warns when the merchant switched this page's override off", () => {
    expect(trackingView(storeOn, override({ enabled: false }))).toEqual({
      kind: "inactive",
      reason: "switched_off",
      pixelId: "8888888888",
    });
  });

  it("warns when store-level tracking is off entirely", () => {
    // Off means off, on every page — the server does the same.
    expect(
      trackingView({ enabled: false, perPageTrackingEnabled: true }, override()),
    ).toEqual({ kind: "inactive", reason: "tracking_off", pixelId: "8888888888" });
  });

  it("treats a store with no tracking row as tracking off", () => {
    expect(trackingView(null, override())).toEqual({
      kind: "inactive",
      reason: "tracking_off",
      pixelId: "8888888888",
    });
    expect(trackingView(null, null)).toEqual({ kind: "store" });
  });

  it("carries test mode through, so a page left in test mode is visible", () => {
    // A page stuck in test mode reports nothing to production measurement.
    expect(trackingView(storeOn, override({ testMode: true }))).toMatchObject({
      kind: "own",
      testMode: true,
    });
  });
});

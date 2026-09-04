import { describe, it, expect } from "vitest";
import { shouldTriggerCapiPurchase, resolveCapiDispatch, type CapiDispatchConfig } from "./capi-helpers";

function config(overrides: Partial<CapiDispatchConfig> = {}): CapiDispatchConfig {
  return {
    enabled: true,
    accessToken: "EAAG-token",
    conversionEvent: "Purchase",
    testMode: false,
    testEventCode: null,
    ...overrides,
  };
}

describe("shouldTriggerCapiPurchase", () => {
  it("triggers on delivered", () => {
    expect(shouldTriggerCapiPurchase("delivered", 16)).toBe(true);
  });

  it("triggers early (out_for_delivery) only for long-haul southern wilayas", () => {
    expect(shouldTriggerCapiPurchase("out_for_delivery", 1)).toBe(true);
    expect(shouldTriggerCapiPurchase("out_for_delivery", 37)).toBe(true);
    expect(shouldTriggerCapiPurchase("out_for_delivery", 16)).toBe(false);
    expect(shouldTriggerCapiPurchase("out_for_delivery", null)).toBe(false);
  });

  it("never triggers on other statuses", () => {
    expect(shouldTriggerCapiPurchase("dispatched", 1)).toBe(false);
    expect(shouldTriggerCapiPurchase("returned", 16)).toBe(false);
  });
});

describe("resolveCapiDispatch", () => {
  it("sends when tracking is enabled, token present, and event matches the merchant's choice", () => {
    expect(resolveCapiDispatch(config(), "Purchase")).toEqual({ send: true, testEventCode: null });
  });

  it("skips when tracking is disabled or no row exists", () => {
    expect(resolveCapiDispatch(config({ enabled: false }), "Purchase")).toMatchObject({
      send: false,
      reason: "tracking-disabled",
    });
    expect(resolveCapiDispatch(undefined, "Purchase")).toMatchObject({ send: false, reason: "tracking-disabled" });
  });

  it("skips with an actionable reason when the token is missing", () => {
    expect(resolveCapiDispatch(config({ accessToken: "" }), "Purchase")).toEqual({
      send: false,
      reason: "no-access-token",
      message: "No CAPI access token — configure it in Settings → Tracking",
    });
  });

  it("skips when the merchant chose a different conversion event", () => {
    expect(resolveCapiDispatch(config({ conversionEvent: "Lead" }), "Purchase")).toEqual({
      send: false,
      reason: "conversion-event-mismatch",
      message: "Conversion event is set to Lead — Purchase not sent",
    });
    expect(resolveCapiDispatch(config({ conversionEvent: "Purchase" }), "Lead")).toMatchObject({
      send: false,
      reason: "conversion-event-mismatch",
    });
  });

  it("attaches test_event_code only when test mode is on", () => {
    expect(resolveCapiDispatch(config({ testMode: true, testEventCode: "TEST123" }), "Purchase")).toEqual({
      send: true,
      testEventCode: "TEST123",
    });
    expect(resolveCapiDispatch(config({ testMode: false, testEventCode: "TEST123" }), "Purchase")).toEqual({
      send: true,
      testEventCode: null,
    });
    expect(resolveCapiDispatch(config({ testMode: true, testEventCode: null }), "Purchase")).toEqual({
      send: true,
      testEventCode: null,
    });
  });
});

/**
 * Carrier error helpers — regression tests for empty carrier error messages.
 *
 * Carriers answer failures with `{"message": ""}` (an empty string is NOT
 * nullish), which used to produce a blank error toast in the dashboard.
 */

import { describe, it, expect } from "vitest";
import { CarrierHttpError, bodySnippet, flattenErrorBag, nonBlank } from "./utils";

describe("nonBlank", () => {
  it("returns the first non-empty trimmed string", () => {
    expect(nonBlank("", "  ", "oops")).toBe("oops");
    expect(nonBlank(" padded ", null, undefined)).toBe("padded");
  });

  it("returns undefined when every candidate is blank", () => {
    expect(nonBlank("", "   ", null, undefined)).toBeUndefined();
    expect(nonBlank(0, false, {})).toBeUndefined();
    expect(nonBlank()).toBeUndefined();
  });
});

describe("flattenErrorBag", () => {
  it("keeps populated bags", () => {
    expect(flattenErrorBag({ phone: ["invalid"] })).toBe("phone: invalid");
    expect(flattenErrorBag([{ description: "bad wilaya" }])).toBe("bad wilaya");
  });

  it("returns null for blank bags instead of an empty string", () => {
    expect(flattenErrorBag({})).toBeNull();
    expect(flattenErrorBag([])).toBeNull();
    expect(flattenErrorBag({ phone: ["   "] })).toBeNull();
    expect(flattenErrorBag([{ description: "" }])).toBeNull();
  });
});

describe("bodySnippet", () => {
  it("collapses whitespace and bounds the length", () => {
    expect(bodySnippet("  line\n\n break  ")).toBe("line break");
    expect(bodySnippet("x".repeat(300)).length).toBeLessThanOrEqual(183);
    expect(bodySnippet("x".repeat(300)).endsWith("...")).toBe(true);
  });
});

describe("CarrierHttpError", () => {
  it("carries the HTTP status for failure logs", () => {
    const err = new CarrierHttpError("Invalid API Key", 401);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Invalid API Key");
  });
});

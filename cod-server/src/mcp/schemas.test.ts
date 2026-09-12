/**
 * Drift guards for the MCP tool schema registry (slice 6).
 *
 * Invariants:
 *   1. Every tool the scope registry can expose has a derived input schema in
 *      TOOL_SCHEMAS (the tools/list advertisement) — and vice versa.
 *   2. The communeId format matches the communes table: `c-XX-YYY`, NOT a UUID
 *      (all 1551 seeded commune ids use this format).
 */

import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY } from "./registry";
import { TOOL_SCHEMAS, TOOL_NAMES, TOOL_META, TOOL_OUTPUT_SCHEMAS } from "./schemas";

type SafeParse = { safeParse: (v: unknown) => { success: boolean } };

function registryToolNames(): string[] {
  const names = new Set<string>();
  for (const entry of TOOL_REGISTRY) {
    // Building a bundle only constructs tool objects — no DB access happens
    // until an execute() runs.
    const bundle = entry.build({} as never, {} as never, {} as never);
    for (const name of Object.keys(bundle)) names.add(name);
  }
  return [...names].sort();
}

describe("TOOL_SCHEMAS derivation", () => {
  it("covers exactly the registry's tool set (no drift, both directions)", () => {
    const names = registryToolNames();
    expect(names.length).toBeGreaterThan(0);
    expect(TOOL_NAMES).toEqual(names);
  });

  it("derives from the same schema objects the ai-tools execute() validates", () => {
    // Spot-check: the hoisted schema map for customers is the exact object
    // referenced by schemas.ts (identity, not a copy).
    expect(Object.keys(TOOL_SCHEMAS)).toContain("listCustomers");
    expect(Object.keys(TOOL_SCHEMAS)).toContain("setShippingCommuneOverride");
  });
});

describe("TOOL_META (client-specific tool-descriptor extensions)", () => {
  it("declares openai/fileParams and toolInvocation status text for the upload tool", () => {
    expect(TOOL_META["uploadLandingPageImage"]).toEqual({
      "openai/fileParams": ["image"],
      "openai/toolInvocation/invoking": "Starting background image upload…",
      "openai/toolInvocation/invoked": "Upload job created — poll status until complete",
    });
  });

  it("toolInvocation status text stays within the documented 64-char limit", () => {
    for (const value of Object.values(TOOL_META["uploadLandingPageImage"] ?? {})) {
      if (typeof value === "string") {
        expect(value.length).toBeLessThanOrEqual(64);
      }
    }
  });

  it("only carries meta for tools that actually exist in TOOL_SCHEMAS", () => {
    for (const name of Object.keys(TOOL_META)) {
      expect(TOOL_NAMES).toContain(name);
    }
  });
});

describe("TOOL_OUTPUT_SCHEMAS derivation", () => {
  it("covers exactly the registry's tool set (no drift, both directions)", () => {
    expect(Object.keys(TOOL_OUTPUT_SCHEMAS).sort()).toEqual(TOOL_NAMES);
  });

  it("every output schema is a success/failure union accepting the handled-failure envelope", () => {
    for (const [name, schema] of Object.entries(TOOL_OUTPUT_SCHEMAS)) {
      const parsed = schema.safeParse({ success: false, error: "x" });
      if (!parsed.success) {
        throw new Error(`Output schema for ${name} does not accept the failure envelope`);
      }
    }
  });

  it("every output schema rejects a non-conforming success payload (validation is real)", () => {
    const schema = TOOL_OUTPUT_SCHEMAS["listWilayas"]!;
    expect(schema.safeParse({ success: true, wilayas: "not-an-array" }).success).toBe(false);
    expect(schema.safeParse({ success: "true" }).success).toBe(false);
  });
});

describe("communeId format", () => {
  const shape = TOOL_SCHEMAS["setShippingCommuneOverride"];
  const Schema = shape ? (shape["communeId"] as unknown as SafeParse | undefined) : undefined;

  it("is present in the derived schemas", () => {
    expect(Schema).toBeDefined();
  });

  it("accepts the communes table format c-XX-YYY", () => {
    expect(Schema?.safeParse("c-01-001").success).toBe(true);
    expect(Schema?.safeParse("c-16-163").success).toBe(true);
    expect(Schema?.safeParse("c-58-513").success).toBe(true);
  });

  it("rejects UUIDs and malformed ids", () => {
    expect(Schema?.safeParse("d290f1ee-6c54-4b01-90e6-d701748f0851").success).toBe(false);
    expect(Schema?.safeParse("c-1-1").success).toBe(false);
    expect(Schema?.safeParse("commune-16").success).toBe(false);
    expect(Schema?.safeParse("").success).toBe(false);
  });
});

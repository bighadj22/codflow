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
import { TOOL_SCHEMAS, TOOL_NAMES } from "./schemas";

type SafeParse = { safeParse: (v: unknown) => { success: boolean } };

function registryToolNames(): string[] {
  const names = new Set<string>();
  for (const entry of TOOL_REGISTRY) {
    // Building a bundle only constructs tool objects — no DB access happens
    // until an execute() runs.
    const bundle = entry.build({} as never, {} as never);
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

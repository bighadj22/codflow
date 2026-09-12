/**
 * TOOL_ANNOTATIONS consistency — the machine-checked proof that advertised
 * behavior hints match the platform's actual classifications.
 *
 * Invariants (each maps to an OpenAI review rule):
 *   1. Full coverage: every registered tool has annotations, no extras.
 *   2. Dangerous ⇄ destructive: the HITL set and destructiveHint agree in
 *      BOTH directions — mislabeling is a documented plugin rejection reason.
 *   3. Read-scope gating ⇒ readOnlyHint: a tool registered only under
 *      `*:read` scopes claims read-only.
 *   4. readOnlyHint claims are justified: only read-scoped tools or the
 *      explicit allowlist may claim it.
 *   5. openWorldHint is true only for the tools that fetch public URLs.
 *   6. Reads and documented-idempotent writes claim idempotentHint.
 */

import { describe, it, expect } from "vitest";
import {
  TOOL_ANNOTATIONS,
  READ_ONLY_OVERRIDES,
  OPEN_WORLD_TOOLS,
  IDEMPOTENT_WRITE_TOOLS,
} from "./annotations";
import { TOOL_NAMES } from "./schemas";
import { DANGEROUS_TOOLS } from "./elicit";
import { TOOL_REGISTRY } from "./registry";
import { TOOL_TITLES } from "./tool-titles";

function readScopeToolNames(): Set<string> {
  const out = new Set<string>();
  for (const entry of TOOL_REGISTRY) {
    if (entry.requires.every((s) => s.endsWith(":read"))) {
      for (const name of Object.keys(entry.build({} as never, {} as never, {} as never))) {
        out.add(name);
      }
    }
  }
  return out;
}

describe("TOOL_ANNOTATIONS", () => {
  it("covers exactly the registered tool set (no drift, both directions)", () => {
    expect(Object.keys(TOOL_ANNOTATIONS).sort()).toEqual(TOOL_NAMES);
  });

  it("every confirmation-gated (dangerous) tool claims destructiveHint: true", () => {
    for (const name of DANGEROUS_TOOLS) {
      expect(TOOL_ANNOTATIONS[name]?.destructiveHint, `${name} is dangerous`).toBe(true);
    }
  });

  it("no non-dangerous tool claims destructiveHint: true", () => {
    for (const name of TOOL_NAMES) {
      if (!DANGEROUS_TOOLS.has(name)) {
        expect(TOOL_ANNOTATIONS[name]?.destructiveHint, `${name} is not dangerous`).toBe(false);
      }
    }
  });

  it("tools gated only by read scopes claim readOnlyHint: true", () => {
    const reads = readScopeToolNames();
    expect(reads.size).toBeGreaterThan(0);
    for (const name of reads) {
      expect(TOOL_ANNOTATIONS[name]?.readOnlyHint, `${name} is read-scoped`).toBe(true);
    }
  });

  it("readOnlyHint claims come only from read-scoped tools or the explicit allowlist", () => {
    const reads = readScopeToolNames();
    for (const name of TOOL_NAMES) {
      if (TOOL_ANNOTATIONS[name]?.readOnlyHint === true) {
        const justified = reads.has(name) || READ_ONLY_OVERRIDES.has(name);
        expect(justified, `${name} claims readOnly without justification`).toBe(true);
      }
    }
  });

  it("write tools claim readOnlyHint: false", () => {
    expect(TOOL_ANNOTATIONS["createLandingPage"]?.readOnlyHint).toBe(false);
    expect(TOOL_ANNOTATIONS["uploadLandingPageImage"]?.readOnlyHint).toBe(false);
    expect(TOOL_ANNOTATIONS["updateOrderStatus"]?.readOnlyHint).toBe(false);
  });

  it("the upload tool is the only open-world tool (it fetches public image URLs)", () => {
    expect(TOOL_ANNOTATIONS["uploadLandingPageImage"]?.openWorldHint).toBe(true);
    for (const name of TOOL_NAMES) {
      if (!OPEN_WORLD_TOOLS.has(name)) {
        expect(TOOL_ANNOTATIONS[name]?.openWorldHint, `${name} is not open-world`).toBe(false);
      }
    }
  });

  it("read tools are idempotent; writes are not unless documented as such", () => {
    expect(TOOL_ANNOTATIONS["listCustomers"]?.idempotentHint).toBe(true);
    expect(TOOL_ANNOTATIONS["getLandingPageImageUploadStatus"]?.idempotentHint).toBe(true);
    expect(TOOL_ANNOTATIONS["createOrder"]?.idempotentHint).toBe(false);
    expect(TOOL_ANNOTATIONS["deleteLandingPage"]?.idempotentHint).toBe(false);

    // The membership tools are documented idempotent (onConflictDoNothing).
    for (const name of IDEMPOTENT_WRITE_TOOLS) {
      expect(TOOL_ANNOTATIONS[name]?.idempotentHint, `${name} is documented idempotent`).toBe(true);
      expect(TOOL_ANNOTATIONS[name]?.readOnlyHint).toBe(false);
    }
  });

  it("the manage-gated status poll is overridden to read-only", () => {
    expect(TOOL_ANNOTATIONS["getLandingPageImageUploadStatus"]?.readOnlyHint).toBe(true);
    expect(TOOL_ANNOTATIONS["getLandingPageImageUploadStatus"]?.destructiveHint).toBe(false);
  });
});

describe("TOOL_TITLES", () => {
  it("covers exactly the registered tool set", () => {
    expect(Object.keys(TOOL_TITLES).sort()).toEqual(TOOL_NAMES);
  });

  it("titles are short, human-readable, and capitalized", () => {
    for (const [name, title] of Object.entries(TOOL_TITLES)) {
      expect(title.length, `${name}`).toBeGreaterThan(3);
      expect(title.length, `${name}`).toBeLessThanOrEqual(40);
      expect(title[0], `${name}`).toMatch(/[A-Z]/);
    }
  });
});

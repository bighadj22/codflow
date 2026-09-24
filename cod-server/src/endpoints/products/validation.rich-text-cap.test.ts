/**
 * The description cap has three expressions that must never disagree: the
 * shared constant, the products schema's limit, and the number written into the
 * merchant-facing error message. This is the mechanical check for all three.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RICH_TEXT_MAX_CHARS } from "../../../../cod-shared/lib/rich-text";

const SOURCE = readFileSync(join(__dirname, "validation.ts"), "utf8");

describe("rich-text description cap", () => {
  it("is the rich-text contract value (changing it is a contract change)", () => {
    expect(RICH_TEXT_MAX_CHARS).toBe(100_000);
  });

  it("is taken from the shared constant rather than re-declared here", () => {
    expect(SOURCE).toContain("const DESCRIPTION_MAX_CHARS = RICH_TEXT_MAX_CHARS");
    // No local numeric literal may shadow the contract.
    expect(SOURCE).not.toMatch(/DESCRIPTION_MAX_CHARS\s*=\s*[0-9_]/);
  });

  it("keeps the merchant-facing message in step with the constant", () => {
    const message = /Description must be at most ([\d,]+) characters/.exec(SOURCE);
    expect(message, "the cap message is gone or reworded — update this guard").toBeTruthy();
    expect(Number(message![1].replace(/,/g, ""))).toBe(RICH_TEXT_MAX_CHARS);
  });
});

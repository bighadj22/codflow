import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(import.meta.dirname, "../..");
const SOURCE_EXTENSIONS = new Set([".astro", ".js", ".jsx", ".ts", ".tsx"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (
      !SOURCE_EXTENSIONS.has(extname(entry.name)) ||
      entry.name.includes(".test.")
    )
      return [];
    return [path];
  });
}

describe("browser-native dialogs", () => {
  it("keeps application feedback inside the CodFlow UI", () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return /window\.(?:alert|confirm|prompt)\s*\(/.test(source)
        ? [relative(SOURCE_ROOT, path)]
        : [];
    });

    expect(violations).toEqual([]);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(import.meta.dirname, "../..");
const ALLOWED = [join(SOURCE_ROOT, "components/ui/select.tsx")];
const SOURCE_EXTENSIONS = new Set([".astro", ".js", ".jsx", ".ts", ".tsx"]);

function sourceFiles(directory: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, acc);
    else if (
      SOURCE_EXTENSIONS.has(extname(entry.name)) &&
      !entry.name.includes(".test.")
    )
      acc.push(path);
  }
  return acc;
}

describe("native <select>", () => {
  it("keeps native selects inside the Select component", () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      if (ALLOWED.includes(path)) return [];
      const source = readFileSync(path, "utf8");
      return /<select[\s>]/.test(source) ? [relative(SOURCE_ROOT, path)] : [];
    });

    expect(violations).toEqual([]);
  });
});

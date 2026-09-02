import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(import.meta.dirname, "..");
const SOURCE_EXTENSIONS = new Set([".astro", ".js", ".jsx", ".ts", ".tsx"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!SOURCE_EXTENSIONS.has(extname(entry.name)) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

describe("toast feedback", () => {
  it("keeps react-hot-toast behind the shared host and adapter", () => {
    const imports = sourceFiles(SOURCE_ROOT)
      .filter((path) => /from\s+["']react-hot-toast["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE_ROOT, path))
      .sort();

    expect(imports).toEqual(["components/ui/ToastHost.tsx", "lib/notify.ts"]);
  });

  it("mounts one global toast host for every page", () => {
    const layout = readFileSync(join(SOURCE_ROOT, "layouts/BaseLayout.astro"), "utf8");
    expect(layout.match(/<ToastHost\b/g)).toHaveLength(1);
  });
});

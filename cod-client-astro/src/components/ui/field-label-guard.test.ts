import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(import.meta.dirname, "../..");
const SOURCE_EXTENSIONS = new Set([".astro", ".js", ".jsx", ".ts", ".tsx"]);

/**
 * Widgets that render several controls rather than one labelable input. A
 * `<label>` forwards every click inside it to its first labelable descendant,
 * so wrapping one of these in the default `Field` turns a click anywhere in the
 * widget into a click on its first button.
 */
const COMPOSITE_WIDGETS = [
  "RichTextDescriptionEditor",
  "PageBodyEditor",
  "CategoryImageUploader",
  "PRESET_COLORS.map",
];

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

/** The `<Field` opening tag enclosing `index`, or null when there is none. */
function enclosingFieldTag(source: string, index: number): string | null {
  const open = source.lastIndexOf("<Field", index);
  if (open === -1) return null;
  const close = source.indexOf(">", open);
  if (close === -1 || close > index) return null;
  if (source.slice(close, index).includes("</Field>")) return null;
  return source.slice(open, close + 1);
}

describe("Field label forwarding", () => {
  it('wraps composite widgets in as="div", never a <label>', () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return COMPOSITE_WIDGETS.flatMap((widget) => {
        const found: string[] = [];
        for (
          let at = source.indexOf(widget);
          at !== -1;
          at = source.indexOf(widget, at + 1)
        ) {
          const tag = enclosingFieldTag(source, at);
          if (tag && !tag.includes('as="div"'))
            found.push(`${relative(SOURCE_ROOT, path)}: ${widget}`);
        }
        return found;
      });
    });

    expect(violations).toEqual([]);
  });
});

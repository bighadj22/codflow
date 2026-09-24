import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const clientDir = join(root, "dist/client");
const astroDir = join(clientDir, "_astro");

function chunkFiles(): string[] {
  try {
    statSync(astroDir);
  } catch {
    return [];
  }
  return readdirSync(astroDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(astroDir, name));
}

/** Marker substrings that only exist inside the description editor's
 *  dependency tree (TipTap + ProseMirror). */
const EDITOR_MARKERS = ["prosemirror", "ProseMirror"];
const EDITOR_CHUNK_RE = /^RichTextDescriptionEditor\./;

function scriptSrcsFromHtml(): string[] {
  const srcs = new Set<string>();
  const pages = readdirSync(clientDir, { recursive: true })
    .filter((p) => String(p).endsWith(".html"))
    .map((p) => join(clientDir, String(p)));
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    for (const match of html.matchAll(/<script[^>]+src="(\/_astro\/[^"]+)"/g)) {
      srcs.add(match[1].split("/").pop() as string);
    }
  }
  return [...srcs];
}

describe("description editor lazy-mount (ADR 0002, locked decision #1)", () => {
  it("keeps TipTap/ProseMirror out of every statically-loaded chunk", () => {
    let chunks = chunkFiles();
    const hasEditorChunk = chunks.some((c) => EDITOR_CHUNK_RE.test(c.split("/").pop() as string));
    if (!hasEditorChunk) {
      execSync("npm run build", { cwd: root, stdio: "inherit", timeout: 15 * 60_000 });
      chunks = chunkFiles();
    }
    expect(chunks.length, "client build produced no chunks").toBeGreaterThan(0);

    const sync = scriptSrcsFromHtml();
    expect(sync.length, "built pages reference no scripts").toBeGreaterThan(0);
    for (const name of sync) {
      const content = readFileSync(join(astroDir, name), "utf8");
      for (const marker of EDITOR_MARKERS) {
        expect(content.includes(marker), `${name} statically loads editor code (${marker})`).toBe(false);
      }
    }
  }, 15 * 60_000);

  it("ships the editor as an async chunk (loaded only on demand)", () => {
    // Two components now lazy-load the same SimpleEditor (RichTextDescriptionEditor
    // for products, PageBodyEditor for store pages) — Rollup correctly factors
    // their shared TipTap/ProseMirror dependency into its own chunk rather than
    // duplicating it into each wrapper, so the marker lives one import away from
    // the RichTextDescriptionEditor.* file itself, not inside it directly.
    const importedChunkNames = (source: string): string[] =>
      [...source.matchAll(/from"\.\/([^"]+\.js)"/g)].map((m) => m[1]);

    const editorChunks = chunkFiles().filter((c) => {
      const name = c.split("/").pop() as string;
      if (!EDITOR_CHUNK_RE.test(name)) return false;
      const content = readFileSync(c, "utf8");
      if (EDITOR_MARKERS.some((m) => content.includes(m))) return true;
      return importedChunkNames(content).some((imported) => {
        try {
          const importedContent = readFileSync(join(astroDir, imported), "utf8");
          return EDITOR_MARKERS.some((m) => importedContent.includes(m));
        } catch {
          return false;
        }
      });
    });
    expect(editorChunks.length, "no async chunk carries (or imports) the editor").toBeGreaterThan(0);
  });
});

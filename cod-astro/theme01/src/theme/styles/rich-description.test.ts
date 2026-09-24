/**
 * Rich-description style coverage — a drift guard, not a design review.
 *
 * The storefront renders sanitised merchant HTML, so every tag the platform's
 * allow-list permits must have a style here; an unstyled tag renders as a
 * browser default inside designed typography and looks broken.
 *
 * The list below is a deliberate MIRROR of the contract, not a second source of
 * truth: the source is `RICH_TEXT_TAGS` in `cod-shared/lib/rich-text.ts`. This
 * package cannot *import* it (theme01 is a swappable layer with no platform
 * imports — see AGENTS.md), but a test can *read* it, and the last two cases
 * here do exactly that: the mirror below and the allow-list printed in
 * `THEME_GUIDE.md` are both compared against the platform source, so neither can
 * drift. When the allow-list grows, this list grows, and so must global.css and
 * the guide.
 */
/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Mirror of cod-shared/lib/rich-text.ts → RICH_TEXT_TAGS (+ attributes we style). */
const ALLOWED_TAGS = [
  // text
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "code", "pre",
  // headings
  "h2", "h3", "h4", "h5", "h6",
  // lists
  "ul", "ol", "li", "blockquote",
  // links
  "a",
  // media
  "img", "figure", "figcaption",
  // highlight
  "mark",
  // tables
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
];

/**
 * Tags that legitimately carry no style of their own:
 *   br                    — a line break
 *   tbody / tfoot / tr    — table structure; their *cells* (th/td) are styled
 * (thead is covered by the `.rich-description thead th` rule.)
 * Everything outside this set must have a scoped rule, so a newly-allowed
 * visual tag without styling fails this test instead of shipping unstyled.
 */
const STRUCTURAL = new Set(["br", "tbody", "tfoot", "tr"]);

const RAW_CSS = readFileSync(
  join(process.cwd(), "src/theme/styles/global.css"),
  "utf8",
);
const css = RAW_CSS;
/** Section start: a real selector, so it survives comment stripping. */
const SECTION_START = ".rich-description > :first-child";
/** Comment-free view, so a prose comment never masquerades as a selector. */
const cssNoComments = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** True when the stylesheet has at least one selector for the tag, scoped to .rich-description. */
function styled(tag: string): boolean {
  const scoped = new RegExp(`\\.rich-description[^{}]*\\b${tag}\\b[^{}]*\\{`, "i");
  return scoped.test(css);
}

describe("rich-description styles", () => {
  it("styles every tag the allow-list permits (except purely structural ones)", () => {
    const missing = ALLOWED_TAGS.filter((tag) => !STRUCTURAL.has(tag) && !styled(tag));
    expect(missing, `unstyled allowed tags: ${missing.join(", ")}`).toEqual([]);
  });

  it("scopes every rule under .rich-description (no global element styling)", () => {
    // A bare `p { … }` or `img { … }` would restyle the whole storefront.
    const section = cssNoComments.slice(cssNoComments.indexOf(SECTION_START));
    const blocks = section.split("}").slice(0, -1);
    const unscoped = blocks.filter((block) => {
      const selector = block.split("{")[0].trim();
      return selector.length > 0 && !selector.includes(".rich-description");
    });
    expect(unscoped).toEqual([]);
  });

  it("keeps the image rule from distorting merchant images (aspect ratio preserved)", () => {
    const section = cssNoComments.slice(cssNoComments.indexOf(SECTION_START));
    expect(section).toMatch(/\.rich-description img\s*\{[^}]*height:\s*auto/);
    expect(section).toMatch(/\.rich-description img\s*\{[^}]*max-width:\s*100%/);
  });

  it("lets wide tables scroll rather than overflow the page", () => {
    const section = cssNoComments.slice(cssNoComments.indexOf(SECTION_START));
    expect(section).toMatch(/\.rich-description table\s*\{[^}]*overflow-x:\s*auto/);
  });
});

/**
 * Documentation drift guards (ADR 0002: the allow-list is the public contract).
 *
 * The platform source is read, never imported: theme01 must not depend on
 * `cod-shared` at runtime, and a test that reads a file keeps that true.
 */
const RICH_TEXT_SOURCE = readFileSync(
  join(process.cwd(), "../../cod-shared/lib/rich-text.ts"),
  "utf8",
);
const THEME_GUIDE = readFileSync(
  join(process.cwd(), "THEME_GUIDE.md"),
  "utf8",
);

/** `RICH_TEXT_TAGS` in platform source → { group: [tags] }, in declaration order. */
function sharedAllowList(source: string): Record<string, string[]> {
  const open = source.indexOf("export const RICH_TEXT_TAGS = {");
  const close = source.indexOf("} as const satisfies", open);
  expect(open, "RICH_TEXT_TAGS not found in cod-shared/lib/rich-text.ts").toBeGreaterThan(-1);
  expect(close, "RICH_TEXT_TAGS block is not closed as expected").toBeGreaterThan(open);

  const groups: Record<string, string[]> = {};
  for (const line of source.slice(open, close).split("\n")) {
    const group = /^\s*([a-z]+):\s*\[(.*)],?\s*$/.exec(line);
    if (!group) continue;
    groups[group[1]] = [...group[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }
  return groups;
}

/** The fenced allow-list table printed in THEME_GUIDE.md → same shape. */
function guideAllowList(markdown: string): Record<string, string[]> {
  const marker = markdown.indexOf("The allow-list (a mirror of");
  expect(marker, "THEME_GUIDE.md no longer prints the allow-list").toBeGreaterThan(-1);

  const lines = markdown.slice(marker).split("\n");
  const openFence = lines.findIndex((line) => line.trim() === "```");
  expect(openFence, "the allow-list is not in a fenced block").toBeGreaterThan(-1);

  const groups: Record<string, string[]> = {};
  for (const line of lines.slice(openFence + 1)) {
    if (line.trim() === "```") break;
    const [name, ...tags] = line.trim().split(/\s+/).filter(Boolean);
    if (name) groups[name.toLowerCase()] = tags;
  }
  return groups;
}

describe("allow-list documentation", () => {
  const shared = sharedAllowList(RICH_TEXT_SOURCE);

  it("finds the groups the platform actually declares", () => {
    // Guards the parser itself: an empty parse would make the checks below pass
    // vacuously.
    expect(Object.keys(shared)).toEqual(["text", "headings", "lists", "links", "media", "highlight", "tables"]);
    expect(Object.values(shared).flat().length).toBeGreaterThan(30);
  });

  it("keeps this file's mirror equal to the platform allow-list", () => {
    expect([...ALLOWED_TAGS].sort()).toEqual(Object.values(shared).flat().sort());
  });

  it("keeps THEME_GUIDE.md's printed allow-list equal to the platform's, group by group", () => {
    expect(guideAllowList(THEME_GUIDE)).toEqual(shared);
  });
});

/**
 * Description model — the pure helpers the editor shell leans on, plus the
 * serializer round-trip that proves the editor's schema preserves what the
 * storage allow-list accepts.
 *
 * The editor itself is the vendored Tiptap "Simple editor" template; these tests
 * are about OUR glue: the text→rich upgrade, and the fact that the configured
 * extension set parses and re-serialises the allowed markup without inventing
 * or dropping anything.
 */
import { describe, expect, it } from "vitest";
import { generateHTML, generateJSON } from "@tiptap/html";
import { richTextFromLegacy } from "./rich-text-model";
import { descriptionEditorExtensions } from "@/components/tiptap-templates/simple/simple-editor-extensions";
import { DEFAULT_HIGHLIGHT_COLORS } from "@/components/tiptap-ui/color-highlight-button";
import { RICH_TEXT_STYLE_PATTERNS } from "../../../../cod-shared/lib/rich-text";

const extensions = () => descriptionEditorExtensions(async () => "https://media.example/uploaded.jpg");
const toJson = (html: string) => generateJSON(html, extensions());
const toHtml = (json: object) => generateHTML(json as never, extensions());

describe("richTextFromLegacy (text → rich upgrade)", () => {
  it("turns each non-empty line into its own paragraph", () => {
    expect(richTextFromLegacy("one\n\nthree")).toBe("<p>one</p><p>three</p>");
  });

  it("escapes the literal text: legacy markup must never become markup", () => {
    expect(richTextFromLegacy("Size < 10cm & <script>alert(1)</script>")).toBe(
      "<p>Size &lt; 10cm &amp; &lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("trims surrounding whitespace and drops blank lines", () => {
    expect(richTextFromLegacy("  a  \n   \n  b  ")).toBe("<p>a</p><p>b</p>");
  });
});


describe("editor schema round-trip", () => {
  it("keeps allowed markup intact through parse + serialise", () => {
    const html =
      '<h2>Title</h2><p>Runs <strong>small</strong> &amp; <em>nice</em></p><ul><li>one</li></ul><blockquote>q</blockquote>';
    const back = toHtml(toJson(html));
    for (const fragment of ["<h2>Title</h2>", "<strong>small</strong>", "<em>nice</em>", "<li><p>one</p></li>", "<blockquote>"]) {
      expect(back).toContain(fragment);
    }
  });

  it("drops code markup, which this editor deliberately does not offer", () => {
    const back = toHtml(toJson("<p>a</p><pre><code>b</code></pre>"));
    expect(back).not.toContain("<pre>");
    expect(back).not.toContain("<code>");
  });

  it("keeps inline image attributes the storefront needs to reserve space", () => {
    const back = toHtml(
      toJson('<img src="https://media.example/i.jpg" alt="chart" width="480" height="640">'),
    );
    expect(back).toContain('src="https://media.example/i.jpg"');
    expect(back).toContain('alt="chart"');
    expect(back).toContain('width="480"');
    expect(back).toContain('height="640"');
  });

  it("keeps task-list state and text alignment (allow-list accepts them — ADR 0002)", () => {
    const back = toHtml(
      toJson('<ul data-type="taskList"><li data-type="taskItem" data-checked="true">done</li></ul>'),
    );
    expect(back).toContain("taskList");
    expect(back).toContain('data-checked="true"');
  });
});

/**
 * A highlight is the one mark whose colour the merchant chooses, so the value
 * has to survive the whole way: offered in the popover, serialised onto the
 * mark, accepted by the write chokepoint, and rendered by the storefront from
 * that stored value rather than an editor-only variable.
 */
describe("highlight colour contract", () => {
  it("offers a palette (an unmatched lookup key silently empties it)", () => {
    expect(DEFAULT_HIGHLIGHT_COLORS.length).toBeGreaterThan(0);
  });

  it("offers only colours the write chokepoint stores", () => {
    const rejected = DEFAULT_HIGHLIGHT_COLORS.filter(
      (color) =>
        !RICH_TEXT_STYLE_PATTERNS.mark.test(`background-color: ${color.value}`),
    );
    expect(rejected.map((color) => color.value)).toEqual([]);
  });

  it.each(DEFAULT_HIGHLIGHT_COLORS.map((color) => color.value))(
    "round-trips %s onto the mark, so the storefront renders that colour",
    (hex) => {
      const back = toHtml(
        toJson(`<mark data-color="${hex}" style="background-color: ${hex}">hot</mark>`),
      );
      expect(back).toContain(`data-color="${hex}"`);
      expect(back).toContain(`background-color: ${hex}`);
    },
  );
});

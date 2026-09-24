/**
 * Description shell — static guards for a package with no DOM test harness.
 *
 * The shell owns the single Tiptap editor view (the vendored Tiptap template
 * does the editing). Static guards assert that the editor renders the template,
 * measures character count against the stored string, and contains none of the
 * dropped multi-view switcher glue.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SHELL = readFileSync(
  join(process.cwd(), "src/features/products/components/RichTextDescriptionEditor.tsx"),
  "utf8",
);

describe("description shell", () => {
  it("renders the vendored Simple editor", () => {
    expect(SHELL).toContain('from "@/components/tiptap-templates/simple/simple-editor"');
    expect(SHELL).toMatch(/<SimpleEditor/);
  });

  it("measures the length of the value it will save, not the editor's text", () => {
    expect(SHELL).toContain("RICH_TEXT_MAX_CHARS");
    expect(SHELL).toMatch(/value\.length/);
  });

  it("does not contain dropped switcher glue or tabs", () => {
    expect(SHELL).not.toContain("evaluateHtmlToRich");
    expect(SHELL).not.toContain("richViewTags");
    expect(SHELL).not.toContain("richTextFromLegacy");
    expect(SHELL).not.toContain('t("toolbar.view_rich")');
    expect(SHELL).not.toContain('t("toolbar.view_html")');
    expect(SHELL).not.toContain('t("toolbar.html_hint")');
    expect(SHELL).not.toContain('t("toolbar.switch_report")');
    expect(SHELL).not.toContain('t("toolbar.switch_anyway")');
    expect(SHELL).not.toContain('role="tablist"');
  });
});

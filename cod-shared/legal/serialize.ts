/**
 * LegalDocument → HTML.
 *
 * The only place template prose becomes markup. It emits exactly five tags —
 * `h2`, `p`, `strong`, `ul`, `li` — carries **no attributes whatsoever**, and
 * escapes every text node. All five are in `RICH_TEXT_TAGS`, so the output
 * survives `sanitizeRichText` byte-for-byte; `legal/templates.sanitize.test.ts`
 * proves that against a real HTMLRewriter rather than asserting it here.
 *
 * Headings start at `h2` because the page renders its title as the `h1`.
 */

import type { LegalBlock, LegalDocument } from "./types";

/**
 * Escapes the five characters that can change markup meaning.
 *
 * `&` goes first — reversing the order would double-escape the entities the
 * other four produce.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBlock(block: LegalBlock): string {
  if (block.type === "ul") {
    return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }
  const body = escapeHtml(block.text);
  return block.lead === undefined
    ? `<p>${body}</p>`
    : `<p><strong>${escapeHtml(block.lead)}</strong> ${body}</p>`;
}

export function serializeLegalDocument(document: LegalDocument): string {
  return document.sections
    .map(
      (s) => `<h2>${escapeHtml(s.heading)}</h2>${s.blocks.map(renderBlock).join("")}`,
    )
    .join("");
}


function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Legacy text → Rich upgrade: the existing literal text becomes one
 *  paragraph per non-empty line, escaped. The old rendering must never be
 *  reinterpreted as markup ("5 < 10" stays "5 < 10"). */
export function richTextFromLegacy(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

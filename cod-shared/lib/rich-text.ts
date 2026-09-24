export type RichTextRemovalKind = "element" | "attribute" | "comment";

export interface RichTextRemoval {
  kind: RichTextRemovalKind;
  name: string;
  tag?: string;
  value?: string;
}

export interface SanitizeRichTextResult {
  html: string;
  removed: RichTextRemoval[];
}

/**
 * The hard cap on a stored description, in characters.
 *
 * Part of the rich-text contract, so it lives with the allow-list rather than
 * in any one consumer: the products API rejects anything longer, and the
 * dashboard editor counts against the same number so a merchant is stopped
 * before the request rather than after it.
 */
export const RICH_TEXT_MAX_CHARS = 100_000;

export const RICH_TEXT_TAGS = {
  text: ["p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "code", "pre"],
  headings: ["h2", "h3", "h4", "h5", "h6"],
  lists: ["ul", "ol", "li", "blockquote"],
  links: ["a"],
  media: ["img", "figure", "figcaption"],
  highlight: ["mark"],
  tables: ["table", "thead", "tbody", "tfoot", "tr", "th", "td"],
} as const satisfies Record<string, readonly string[]>;

export const RICH_TEXT_ATTRS: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "title"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan", "scope", "headers"],
  th: ["colspan", "rowspan", "scope", "headers"],
  ul: ["data-type"],
  li: ["data-type", "data-checked"],
};

/**
 * The only inline `style` a stored description may keep.
 *
 * Both entries exist because the editor template emits them and the storefront
 * renders them: text alignment (TextAlign) and the highlight colour (Highlight).
 * Each is a fixed pattern matched against the WHOLE value, so `style` never
 * becomes a general escape hatch back into the markup: a highlight carries one
 * background colour and nothing else, and the storefront theme sets the text
 * colour on top of it.
 *
 * A highlight arrives as `rgb()` as often as a hex, and both have to be kept.
 * ProseMirror's DOM serializer assigns the style through `dom.style.cssText`
 * rather than `setAttribute`, so a browser re-serialises the declaration from
 * its CSSOM and `#dcfce7` comes back out as `rgb(220, 252, 231)`. Accepting
 * only the hex dropped every highlight saved from the dashboard, which left a
 * bare `<mark>` rendering as the browser's default yellow. The colour functions
 * take digits and separators only — no identifier can appear inside the
 * parentheses, so `url(`, `var(` and `expression(` still cannot get through.
 */
const CSS_COLOR = /(?:#[0-9a-f]{3,8}|rgba?\([0-9.,%\s/]+\))/.source;

export const RICH_TEXT_STYLE_PATTERNS: Readonly<Record<string, RegExp>> = {
  p: /^text-align:\s*(left|center|right|justify)\s*;?$/i,
  h2: /^text-align:\s*(left|center|right|justify)\s*;?$/i,
  h3: /^text-align:\s*(left|center|right|justify)\s*;?$/i,
  h4: /^text-align:\s*(left|center|right|justify)\s*;?$/i,
  h5: /^text-align:\s*(left|center|right|justify)\s*;?$/i,
  h6: /^text-align:\s*(left|center|right|justify)\s*;?$/i,
  mark: new RegExp(`^background-color:\\s*${CSS_COLOR}\\s*;?$`, "i"),
};

/** Fixed value sets for the `data-*` attributes the editor template writes. */
export const RICH_TEXT_DATA_VALUES: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  ul: { "data-type": ["taskList"] },
  li: { "data-type": ["taskItem"], "data-checked": ["true", "false"] },
};

export const RICH_TEXT_SCHEMES = ["https", "http", "mailto", "tel"] as const;

export const RICH_TEXT_DANGEROUS_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "form",
] as const;

const ALLOWED_TAGS: ReadonlySet<string> = new Set(
  Object.values(RICH_TEXT_TAGS).flat()
);
const DANGEROUS_TAGS: ReadonlySet<string> = new Set(RICH_TEXT_DANGEROUS_TAGS);
const INTEGER_ATTRS: ReadonlySet<string> = new Set([
  "width",
  "height",
  "colspan",
  "rowspan",
]);
const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const SCOPE_VALUES: ReadonlySet<string> = new Set([
  "row",
  "col",
  "rowgroup",
  "colgroup",
]);
const FORBIDDEN_ATTRS: ReadonlySet<string> = new Set(["style", "class", "id"]);
const FORCED_ATTRS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  a: { rel: "noopener noreferrer nofollow", target: "_blank" },
  img: { loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" },
};
const REMOVAL_VALUE_CAP = 200;

interface RichTextElement {
  readonly tagName: string;
  readonly removed: boolean;
  readonly attributes: Iterable<[string, string]>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): RichTextElement;
  removeAttribute(name: string): RichTextElement;
  remove(): void;
  removeAndKeepContent(): void;
  onEndTag(handler: (end: { name: string }) => void): RichTextElement;
}

interface RichTextComment {
  remove(): void;
}

interface RichTextText {
  readonly text: string;
  readonly lastInTextNode: boolean;
}

interface RichTextContentHandlers {
  element?(element: RichTextElement): void;
  text?(text: RichTextText): void;
}

interface RichTextRewriter {
  on(selector: string, handlers: RichTextContentHandlers): RichTextRewriter;
  onDocument(handlers: { comments?(comment: RichTextComment): void }): RichTextRewriter;
  transform(response: Response): Response;
}

declare const HTMLRewriter: { new (): RichTextRewriter };

function isForbiddenAttrName(name: string): boolean {
  return (
    name.startsWith("on") ||
    name.startsWith("data-") ||
    FORBIDDEN_ATTRS.has(name)
  );
}

/**
 * Whether one attribute on one tag survives.
 *
 * `style` and `data-*` are not generally allowed — each is decided per tag
 * against a fixed pattern or a fixed value set, which is what keeps the widened
 * allow-list (text alignment, highlight colour, task lists) from becoming a way
 * back into arbitrary markup.
 */
function isAllowedAttribute(tag: string, attr: string, value: string): boolean {
  if (attr === "style") {
    const pattern = RICH_TEXT_STYLE_PATTERNS[tag];
    return pattern !== undefined && pattern.test(decodeEntities(value).trim());
  }
  if (attr === "data-color") {
    // A highlight stores the colour it will render with; a theme variable here
    // would render nowhere in the storefront, so only a hex is accepted.
    return tag === "mark" && HEX_COLOR_RE.test(value.trim());
  }
  if (attr.startsWith("data-")) {
    const values = RICH_TEXT_DATA_VALUES[tag]?.[attr];
    // Exact match: attribute values are case-sensitive, and the editor writes
    // these two exactly ("taskList" / "taskItem").
    return values !== undefined && values.includes(value);
  }
  if (isForbiddenAttrName(attr)) return false;
  const allowed = RICH_TEXT_ATTRS[tag];
  if (allowed === undefined || !allowed.includes(attr)) return false;
  return isValidAttrValue(attr, decodeEntities(value));
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
  colon: ":",
  semi: ";",
  plus: "+",
  period: ".",
  hyphen: "-",
  dash: "-",
  minus: "-",
  Tab: "\t",
  NewLine: "\n",
};

function decodeEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);?/g,
    (raw, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return raw;
        try {
          return String.fromCodePoint(code);
        } catch {
          return raw;
        }
      }
      return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? raw;
    }
  );
}

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/;

function urlScheme(value: string): string | null {
  const cleaned = value
    .replace(/^[\u0000-\u0020\u007F]+/, "")
    .replace(/[\u0000-\u0020\u007F]+$/, "")
    .replace(/[\t\n\r]/g, "");
  const match = SCHEME_RE.exec(cleaned);
  return match ? match[1].toLowerCase() : null;
}

function isAllowedHref(value: string): boolean {
  const scheme = urlScheme(value);
  if (scheme === null) return true;
  return (RICH_TEXT_SCHEMES as readonly string[]).includes(scheme.toLowerCase());
}

function isHttpsSrc(value: string): boolean {
  return urlScheme(value) === "https";
}

function isValidAttrValue(attr: string, value: string): boolean {
  if (INTEGER_ATTRS.has(attr)) return /^[1-9][0-9]*$/.test(value);
  if (attr === "scope") return SCOPE_VALUES.has(value.toLowerCase());
  if (attr === "headers") {
    const tokens = value.split(/\s+/).filter(Boolean);
    return (
      tokens.length > 0 &&
      tokens.every((t) => /^[A-Za-z][A-Za-z0-9_.:\-]*$/.test(t))
    );
  }
  if (attr === "href") return isAllowedHref(value);
  if (attr === "src") return isHttpsSrc(value);
  return true;
}

class AllowListHandler {
  readonly removals: RichTextRemoval[] = [];

  element(el: RichTextElement): void {
    if (el.removed) return;
    const tag = el.tagName.toLowerCase();
    if (DANGEROUS_TAGS.has(tag)) {
      this.removals.push({ kind: "element", name: tag });
      el.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      this.removals.push({ kind: "element", name: tag });
      el.removeAndKeepContent();
      return;
    }
    const allowed = RICH_TEXT_ATTRS[tag];
    const forced = FORCED_ATTRS[tag] ?? {};
    for (const [name, value] of Array.from(el.attributes)) {
      const attr = name.toLowerCase();
      if (attr in forced) continue;
      const rejected = !isAllowedAttribute(tag, attr, value);
      if (rejected) {
        el.removeAttribute(name);
        this.removals.push({
          kind: "attribute",
          name: attr,
          tag,
          value: value.slice(0, REMOVAL_VALUE_CAP),
        });
      }
    }
    for (const [name, value] of Object.entries(forced)) {
      el.setAttribute(name, value);
    }
  }

  comment(c: RichTextComment): void {
    this.removals.push({ kind: "comment", name: "comment" });
    c.remove();
  }
}

async function runAllowList(
  html: string
): Promise<{ html: string; removed: RichTextRemoval[] }> {
  const handler = new AllowListHandler();
  const output = new HTMLRewriter()
    .on("*", { element: (el) => handler.element(el) })
    .onDocument({ comments: (c) => handler.comment(c) })
    .transform(new Response(html));
  return { html: await output.text(), removed: handler.removals };
}

function truncateUnterminatedTail(html: string): string {
  const last = html.lastIndexOf("<");
  if (last === -1) return html;
  const tail = html.slice(last);
  if (tail.includes(">")) return html;
  if (/^<\/?[a-zA-Z]/.test(tail) || tail.startsWith("<!") || tail.startsWith("<?")) {
    return html.slice(0, last);
  }
  return html;
}

export async function sanitizeRichText(
  html: string
): Promise<SanitizeRichTextResult> {
  const { html: sanitized, removed } = await runAllowList(html);
  return { html: truncateUnterminatedTail(sanitized), removed };
}

export async function unsupportedElements(
  html: string
): Promise<RichTextRemoval[]> {
  return (await runAllowList(html)).removed;
}

const BLOCK_TAGS: ReadonlySet<string> = new Set([
  "p",
  "br",
  "hr",
  "li",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "figcaption",
  "tr",
  "pre",
  "figure",
]);

// Void blocks never emit an end tag — registering onEndTag on them makes the
// parser throw "No end tag".
const VOID_BLOCK_TAGS: ReadonlySet<string> = new Set(["br", "hr"]);

export async function toPlainText(html: string): Promise<string> {
  let text = "";
  const output = new HTMLRewriter()
    .on("*", {
      element(el) {
        if (BLOCK_TAGS.has(el.tagName.toLowerCase())) {
          // Blocks separate content on BOTH sides: a start-tag space covers
          // the block's own first text; an end-tag space separates inline
          // content that follows the block. Void blocks (br/hr) only have a
          // start tag.
          text += " ";
          if (!VOID_BLOCK_TAGS.has(el.tagName.toLowerCase())) {
            el.onEndTag(() => {
              text += " ";
            });
          }
        }
      },
      text(chunk) {
        text += decodeEntities(chunk.text);
      },
    })
    .transform(new Response(html));
  await output.text();
  return text.replace(/\s+/g, " ").trim();
}

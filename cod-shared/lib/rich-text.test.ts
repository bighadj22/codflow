import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { transform } from "esbuild";
import { Miniflare } from "miniflare";
import { RICH_TEXT_ATTRS, RICH_TEXT_DANGEROUS_TAGS, RICH_TEXT_SCHEMES, RICH_TEXT_TAGS, RICH_TEXT_STYLE_PATTERNS, RICH_TEXT_DATA_VALUES } from "./rich-text";
import type { RichTextRemoval, SanitizeRichTextResult } from "./rich-text";

// HTMLRewriter does not exist in the Node vitest pool (proven: typeof is
// "undefined" there), so every sanitize/plain/unsupported call runs inside a
// real workerd via a programmatic Miniflare instance — the same devDependency
// and pattern the repo's e2e tests already use. The module source is
// esbuild-transformed (loader: "ts") and registered as a workerd module; no
// fake or polyfilled parser is involved anywhere.
const here = dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(join(here, "rich-text.ts"), "utf8");

const WORKER = `
import { sanitizeRichText, toPlainText, unsupportedElements } from "./rich-text.mjs";
export default {
  async fetch(request) {
    const { fn, args } = await request.json();
    try {
      let result;
      if (fn === "sanitizeRichText") result = await sanitizeRichText(args[0]);
      else if (fn === "toPlainText") result = await toPlainText(args[0]);
      else if (fn === "unsupportedElements") result = await unsupportedElements(args[0]);
      else return Response.json({ ok: false, error: "unknown fn: " + fn }, { status: 400 });
      return Response.json({ ok: true, result });
    } catch (e) {
      return Response.json({ ok: false, error: String((e && e.stack) || e) }, { status: 500 });
    }
  },
};
`;

let mf: Miniflare | undefined;

beforeAll(async () => {
  const lib = await transform(moduleSource, { loader: "ts", format: "esm" });
  mf = new Miniflare({
    modules: [
      { type: "ESModule", path: "index.mjs", contents: WORKER },
      { type: "ESModule", path: "rich-text.mjs", contents: lib.code },
    ],
  });
});

afterAll(async () => {
  await mf?.dispose();
});

async function runInWorkerd<T>(fn: string, ...args: unknown[]): Promise<T> {
  const worker = await mf!.getWorker();
  const res = await worker.fetch("http://rich-text.test/", {
    method: "POST",
    body: JSON.stringify({ fn, args }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    result?: T;
    error?: string;
  };
  if (!data.ok) throw new Error(`workerd run failed for ${fn}: ${data.error}`);
  return data.result as T;
}

const sanitize = (html: string) =>
  runInWorkerd<SanitizeRichTextResult>("sanitizeRichText", html);
const plain = (html: string) => runInWorkerd<string>("toPlainText", html);
const unsupported = (html: string) =>
  runInWorkerd<RichTextRemoval[]>("unsupportedElements", html);

const names = (removals: RichTextRemoval[]) =>
  removals.map((r) => `${r.kind}:${r.name}`).sort();

const CORPUS: { name: string; input: string }[] = [
  {
    name: "script with content",
    input: "<p>Hi</p><script>alert(1)</script><p>Bye</p>",
  },
  {
    name: "event handlers on allowed tags",
    input:
      '<img src="https://m.example/i.jpg" alt="p" onerror="alert(1)"><p onclick="x()">t</p>',
  },
  { name: "javascript: href", input: '<a href="javascript:alert(1)">x</a>' },
  {
    name: "javascript: href mixed case",
    input: '<a href="JaVaScRiPt:alert(1)">x</a>',
  },
  {
    name: "javascript: href smuggled via tab",
    input: '<a href="java\tscript:alert(1)">x</a>',
  },
  {
    name: "javascript: href smuggled via entity newline",
    input: '<a href="jav&#x0A;ascript:alert(1)">x</a>',
  },
  {
    name: "data: img src",
    input: '<img src="data:image/png;base64,AAAA" alt="d">',
  },
  {
    name: "svg with nested element and handler",
    input: '<svg onload="alert(1)"><circle r="1"></circle></svg><p>ok</p>',
  },
  { name: "iframe with src", input: '<iframe src="https://evil.example"></iframe><p>t</p>' },
  { name: "style with css", input: "<style>p{color:red}</style><p>t</p>" },
  {
    name: "form with inputs removed with content",
    input: '<form action="/x"><input name="a"><button>go</button></form><p>k</p>',
  },
  {
    name: "unknown tags unwrapped, text survives",
    input: '<div class="c"><span style="color:red">hello</span> world</div>',
  },
  { name: "unclosed formatting tag", input: "<b>bold" },
  {
    name: "unclosed img with handler",
    input: '<img src="https://m.example/i.jpg" onerror=alert(1)',
  },
  { name: "comment dropped", input: "a<!-- hi -->b" },
  {
    name: "nested unknown wrappers",
    input: "<div><div><p>deep</p></div></div>",
  },
  {
    name: "class and id forbidden",
    input: '<p class="x" id="y">t</p>',
  },
  {
    name: "allowed tag with unknown attribute",
    input: '<p align="center">x</p>',
  },
  {
    name: "allowed markup with bad link and image attrs",
    input:
      '<h2>Specs</h2><a href="vbscript:msgbox(1)">l</a><img src="http://m.example/i.jpg" alt="i" width="480.5">',
  },
];

const CANONICAL_ALLOWED =
  '<h2>Title</h2><p>Size <strong>10cm</strong> &amp; up, <em>nice</em>, <u>underline</u>, <s>old</s>, H<sub>2</sub>O, x<sup>2</sup></p>' +
  "<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><blockquote>quote</blockquote>" +
  '<pre><code>npm i</code></pre><hr><figure><figcaption>cap</figcaption></figure>' +
  '<table><thead><tr><th scope="col" colspan="2" headers="h1 h2">H</th></tr></thead><tbody><tr><td rowspan="2">a</td><td>b</td></tr></tbody></table>';

describe("allow-list constants (single source of truth)", () => {
  it("matches the plan's §6 tag groups exactly", () => {
    expect(Object.keys(RICH_TEXT_TAGS)).toEqual([
      "text",
      "headings",
      "lists",
      "links",
      "media",
      "highlight",
      "tables",
    ]);
    expect(RICH_TEXT_TAGS.text).toEqual([
      "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "code", "pre",
    ]);
    expect(RICH_TEXT_TAGS.headings).toEqual(["h2", "h3", "h4", "h5", "h6"]);
    expect(RICH_TEXT_TAGS.lists).toEqual(["ul", "ol", "li", "blockquote"]);
    expect(RICH_TEXT_TAGS.links).toEqual(["a"]);
    expect(RICH_TEXT_TAGS.media).toEqual(["img", "figure", "figcaption"]);
    expect(RICH_TEXT_TAGS.tables).toEqual([
      "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    ]);
  });

  it("declares per-tag attributes and the scheme set", () => {
    expect(RICH_TEXT_ATTRS).toEqual({
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan", "scope", "headers"],
      th: ["colspan", "rowspan", "scope", "headers"],
      ul: ["data-type"],
      li: ["data-type", "data-checked"],
    });
    // The editor template's three attribute-borne features, each pinned to a
    // pattern or a value set so the widening cannot be abused.
    expect(RICH_TEXT_TAGS.highlight).toEqual(["mark"]);
    expect(RICH_TEXT_STYLE_PATTERNS.mark).toBeDefined();
    expect(RICH_TEXT_DATA_VALUES.li?.["data-checked"]).toEqual(["true", "false"]);
    expect(RICH_TEXT_SCHEMES).toEqual(["https", "http", "mailto", "tel"]);
    expect(RICH_TEXT_DANGEROUS_TAGS).toEqual([
      "script", "style", "iframe", "object", "embed", "svg", "math", "form",
    ]);
  });
});

describe("sanitizeRichText — XSS corpus", () => {
  it("removes script with its content", async () => {
    const { html, removed } = await sanitize(CORPUS[0].input);
    expect(html).toBe("<p>Hi</p><p>Bye</p>");
    expect(removed).toContainEqual({ kind: "element", name: "script" });
  });

  it("strips on* handlers from allowed tags but keeps safe attrs", async () => {
    const { html, removed } = await sanitize(CORPUS[1].input);
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("onclick");
    expect(html).toContain('<img src="https://m.example/i.jpg" alt="p"');
    expect(html).toContain('<p>t</p>');
    expect(names(removed)).toEqual(
      expect.arrayContaining(["attribute:onerror", "attribute:onclick"])
  );
  });

  it.each([
    ["plain", '<a href="javascript:alert(1)">x</a>'],
    ["mixed case", '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ["tab smuggled", '<a href="java\tscript:alert(1)">x</a>'],
    ["entity newline smuggled", '<a href="jav&#x0A;ascript:alert(1)">x</a>'],
    ["entity Tab smuggled", '<a href="java&Tab;script:alert(1)">x</a>'],
    ["entity colon smuggled", '<a href="javascript&colon;alert(1)">x</a>'],
    ["numeric colon smuggled", '<a href="javascript&#58;alert(1)">x</a>'],
  ])("drops %s href and forces rel/target", async (_label, input) => {
    const { html, removed } = await sanitize(input);
    expect(html).not.toContain("javascript");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain(">x</a>");
    expect(names(removed)).toContain("attribute:href");
  });

  it("drops data: img src but keeps https: src with forced attrs", async () => {
    const bad = await sanitize(CORPUS[6].input);
    expect(bad.html).not.toContain("data:");
    expect(bad.html).toContain('alt="d"');
    expect(names(bad.removed)).toContain("attribute:src");

    const good = await sanitize('<img src="https://m.example/i.jpg" alt="g">');
    expect(good.html).toContain('src="https://m.example/i.jpg"');
    expect(good.html).toContain('loading="lazy"');
    expect(good.html).toContain('decoding="async"');
    expect(good.html).toContain('referrerpolicy="no-referrer"');
    expect(good.removed).toEqual([]);
  });

  it("removes svg with its subtree and records no inner elements", async () => {
    const { html, removed } = await sanitize(CORPUS[7].input);
    expect(html).toBe("<p>ok</p>");
    expect(names(removed)).toEqual(["element:svg"]);
    expect(html).not.toContain("circle");
    expect(html).not.toContain("onload");
  });

  it("removes iframe and style with their content", async () => {
    const { html, removed } = await sanitize(
      '<iframe src="https://evil.example"></iframe><style>p{color:red}</style><p>t</p>'
    );
    expect(html).toBe("<p>t</p>");
    expect(names(removed).sort()).toEqual(["element:iframe", "element:style"]);
  });

  it("removes form with its inputs and buttons", async () => {
    const { html, removed } = await sanitize(CORPUS[10].input);
    expect(html).toBe("<p>k</p>");
    expect(names(removed)).toEqual(["element:form"]);
  });

  it("unwraps unknown tags keeping their text", async () => {
    const { html, removed } = await sanitize(CORPUS[11].input);
    expect(html).toBe("hello world");
    expect(names(removed)).toEqual(["element:div", "element:span"]);
  });

  it("leaves unclosed formatting tags to pass through verbatim", async () => {
    const { html } = await sanitize("<b>bold");
    expect(html).toBe("<b>bold");
  });

  it("truncates an unterminated tag at EOF (inert alone, hazard mid-page)", async () => {
    const { html } = await sanitize(
      '<p>ok</p><img src="https://m.example/i.jpg" onerror=alert(1)'
    );
    expect(html).toBe("<p>ok</p>");
  });

  it("keeps a text '<' at EOF and unclosed elements verbatim", async () => {
    expect((await sanitize("<p>5 < 10</p>")).html).toBe("<p>5 < 10</p>");
    expect((await sanitize("<b>bold")).html).toBe("<b>bold");
    expect((await sanitize("<p>done</p><")).html).toBe("<p>done</p><");
  });

  it("drops comments", async () => {
    const { html, removed } = await sanitize("a<!-- hi -->b");
    expect(html).toBe("ab");
    expect(removed).toEqual([{ kind: "comment", name: "comment" }]);
  });

  it("unwraps nested unknown wrappers keeping the allowed child", async () => {
    const { html } = await sanitize("<div><div><p>deep</p></div></div>");
    expect(html).toBe("<p>deep</p>");
  });

  it("drops class and id everywhere", async () => {
    const { html, removed } = await sanitize('<p class="x" id="y">t</p>');
    expect(html).toBe("<p>t</p>");
    expect(names(removed).sort()).toEqual([
      "attribute:class",
      "attribute:id",
    ]);
  });

  it("keeps allowed markup byte-for-byte when nothing needs forcing", async () => {
    const { html, removed } = await sanitize(CANONICAL_ALLOWED);
    expect(html).toBe(CANONICAL_ALLOWED);
    expect(removed).toEqual([]);
  });

  it("forces rel/target on external links and keeps mailto/tel/relative hrefs", async () => {
    const cases = [
      '<a href="https://example.com/x">a</a>',
      '<a href="http://example.com/x">a</a>',
      '<a href="mailto:someone@example.com">a</a>',
      '<a href="tel:+213661000000">a</a>',
      '<a href="/products/x">a</a>',
      '<a href="#specs">a</a>',
    ];
    for (const input of cases) {
      const { html } = await sanitize(input);
      const href = input.match(/href="([^"]+)"/)![1];
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain('rel="noopener noreferrer nofollow"');
      expect(html).toContain('target="_blank"');
    }
  });

  it("rejects non-allow-listed and malformed-but-executable hrefs", async () => {
    for (const href of [
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "DATA:text/html,<script>alert(1)</script>",
    ]) {
      const { html, removed } = await sanitize(`<a href="${href}">x</a>`);
      expect(html).not.toContain(href);
      expect(names(removed)).toContain("attribute:href");
    }
  });

  it("validates table cell attributes", async () => {
    const good = await sanitize(
      '<table><tr><td colspan="2" rowspan="3" scope="col" headers="h1 h2">x</td></tr></table>'
    );
    expect(good.removed).toEqual([]);
    expect(good.html).toContain('scope="col"');

    const bad = await sanitize(
      '<table><tr><td colspan="abc" rowspan="0" scope="nope" headers="a b(c)">x</td></tr></table>'
    );
    expect(bad.html).toContain("<td>x</td>");
    expect(names(bad.removed).sort()).toEqual([
      "attribute:colspan",
      "attribute:headers",
      "attribute:rowspan",
      "attribute:scope",
    ]);
  });

  it("requires positive integer img dimensions", async () => {
    const { html, removed } = await sanitize(
      '<img src="https://m.example/i.jpg" alt="i" width="480.5" height="0">'
    );
    expect(html).not.toContain("480.5");
    expect(html).not.toContain('height="0"');
    expect(names(removed).sort()).toEqual([
      "attribute:height",
      "attribute:width",
    ]);

    const ok = await sanitize(
      '<img src="https://m.example/i.jpg" alt="i" width="480" height="640">'
    );
    expect(ok.removed).toEqual([]);
    expect(ok.html).toContain('width="480"');
    expect(ok.html).toContain('height="640"');
  });

  it("passes text entities through untouched", async () => {
    const input = "<p>5 &lt; 10 &amp; more</p>";
    const { html, removed } = await sanitize(input);
    expect(html).toBe(input);
    expect(removed).toEqual([]);
  });

  it("is idempotent over the whole corpus", async () => {
    for (const entry of CORPUS) {
      const first = await sanitize(entry.input);
      const second = await sanitize(first.html);
      expect(second.html, `html unstable for: ${entry.name}`).toBe(first.html);
      expect(second.removed, `removals not empty for: ${entry.name}`).toEqual(
        []
      );
    }
  });
});

describe("editor-template attributes (text-align, highlight, task lists)", () => {
  it("keeps text alignment, which the template writes as an inline style", async () => {
    const { html } = await sanitize('<p style="text-align: center;">centred</p>');
    expect(html).toBe('<p style="text-align: center;">centred</p>');
  });

  it("keeps a hex highlight background on mark", async () => {
    const kept = await sanitize('<p><mark data-color="#fef9c3" style="background-color: #fef9c3">hi</mark></p>');
    expect(kept.html).toContain("<mark");
    expect(kept.html).toContain("background-color: #fef9c3");
    expect(kept.html).toContain('data-color="#fef9c3"');
  });

  // Every swatch the dashboard offers, not just the yellow one: a colour the
  // allow-list drops leaves a bare <mark>, which renders as the browser's
  // default yellow and reads as "the picker only ever applies yellow".
  it.each(["#dcfce7", "#e0f2fe", "#ffe4e6", "#f3e8ff", "#fef9c3"])(
    "keeps the %s the highlight picker offers",
    async (hex) => {
      const kept = await sanitize(
        `<p><mark data-color="${hex}" style="background-color: ${hex};">hi</mark></p>`,
      );
      expect(kept.html).toContain(`background-color: ${hex}`);
      expect(kept.html).toContain(`data-color="${hex}"`);
    },
  );

  // What a browser actually posts: ProseMirror assigns the style through
  // `style.cssText`, so the colour is re-serialised from the CSSOM and the hex
  // the editor wrote arrives as rgb().
  it("keeps the rgb() a browser re-serialises the highlight into", async () => {
    const kept = await sanitize(
      '<p><mark data-color="#dcfce7" style="background-color: rgb(220, 252, 231);">hi</mark></p>',
    );
    expect(kept.html).toContain("background-color: rgb(220, 252, 231)");
    expect(kept.html).toContain('data-color="#dcfce7"');
  });

  it("keeps an rgba() highlight", async () => {
    const kept = await sanitize(
      '<p><mark style="background-color: rgba(220, 252, 231, 0.5);">hi</mark></p>',
    );
    expect(kept.html).toContain("rgba(220, 252, 231, 0.5)");
  });

  it.each([
    "background-color: var(--tt-color-highlight-green)",
    "background-color: url(javascript:alert(1))",
    "background-color: rgb(0,0,0); behavior: url(x)",
    "background-color: expression(alert(1))",
  ])("still drops %s", async (style) => {
    const dropped = await sanitize(`<p><mark style="${style}">hi</mark></p>`);
    expect(dropped.html).not.toContain("style=");
    expect(dropped.html).toContain("<mark");
  });

  it("drops a highlight that is not a plain hex — a theme variable renders nowhere", async () => {
    const variable = await sanitize('<p><mark data-color="var(--tt-color-highlight-yellow)" style="background-color: var(--tt-color-highlight-yellow); color: inherit">hi</mark></p>');
    expect(variable.html).not.toContain("var(--tt");
    expect(variable.html).not.toContain("style=");
    expect(variable.html).toContain("<mark");
  });

  it("drops a non-hex or scripted highlight style entirely", async () => {
    const dropped = await sanitize('<p><mark style="background: url(javascript:alert(1))">hi</mark></p>');
    expect(dropped.html).not.toContain("javascript");
    expect(dropped.html).not.toContain("style=");
  });

  it("drops a highlight style that adds any second declaration", async () => {
    const { html } = await sanitize('<p><mark style="background-color: #fef9c3; color: inherit">hi</mark></p>');
    expect(html).not.toContain("style=");
  });

  it("drops a style that carries anything beyond the one allowed declaration", async () => {
    const { html } = await sanitize('<p style="text-align: center; color: red">x</p>');
    expect(html).not.toContain("style=");
  });

  it("refuses text alignment on tags it was not granted to", async () => {
    const { html } = await sanitize('<div style="text-align: center"><p>x</p></div>');
    expect(html).toBe("<p>x</p>");
  });

  it("keeps task-list state and only the fixed data values", async () => {
    const kept = await sanitize('<ul data-type="taskList"><li data-type="taskItem" data-checked="true">done</li></ul>');
    expect(kept.html).toContain('data-type="taskList"');
    expect(kept.html).toContain('data-checked="true"');

    const junk = await sanitize('<ul data-type="evil"><li data-type="taskItem" data-checked="maybe">x</li></ul>');
    expect(junk.html).not.toContain("evil");
    expect(junk.html).not.toContain("maybe");
  });

  it("strips the checkbox input and wrappers the task item renders", async () => {
    const { html } = await sanitize(
      '<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li></ul>'
    );
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<label");
    expect(html).not.toContain("<div");
    expect(html).toContain("todo");
    expect(html).toContain('data-checked="false"');
  });

  it("stays idempotent over the new shapes too", async () => {
    for (const input of [
      '<p style="text-align: justify;">j</p>',
      '<p><mark data-color="#fef9c3" style="background-color: #fef9c3">h</mark></p>',
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false">t</li></ul>',
    ]) {
      const once = (await sanitize(input)).html;
      expect((await sanitize(once)).html).toBe(once);
    }
  });
});

describe("toPlainText", () => {
  it("drops tags and images, decodes entities, collapses whitespace", async () => {
    const out = await plain(
      '<h2>Size &amp; fit</h2><p>Runs <strong>small</strong> — see <img src="https://m.example/i.jpg" alt="chart"> chart.</p><ul><li>one</li><li>two</li></ul>'
    );
    expect(out).toBe("Size & fit Runs small — see chart. one two");
  });

  it("decodes named and numeric character references", async () => {
    const out = await plain("<p>&lt;b&gt; &amp; &quot;q&quot; &#39;a&#39;</p>");
    expect(out).toBe('<b> & "q" \'a\'');
  });

  it("returns an empty string for empty or tag-only input", async () => {
    expect(await plain("")).toBe("");
    expect(await plain("<div><br></div>")).toBe("");
  });
});

describe("unsupportedElements", () => {
  it("agrees with sanitizeRichText.removed across the whole corpus", async () => {
    for (const entry of CORPUS) {
      const pre = await unsupported(entry.input);
      const { removed } = await sanitize(entry.input);
      expect(pre, `disagreement for: ${entry.name}`).toEqual(removed);
    }
  });

  it("reports unknown, dangerous and attribute removals for a mixed payload", async () => {
    const removals = await unsupported(
      '<div class="c"><script>alert(1)</script><p onclick="x()">t</p></div>'
    );
    expect(names(removals)).toEqual([
      "attribute:onclick",
      "element:div",
      "element:script",
    ]);
  });
});

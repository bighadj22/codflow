/**
 * Legal template pack — structure, parity, and the guarantees the storefront
 * depends on.
 *
 * Pure functions only, so this runs in the fast Node pool. The one thing it
 * cannot prove here is that the markup survives a real HTMLRewriter — that is
 * `templates.sanitize.test.ts`, which runs in workerd, because HTMLRewriter
 * does not exist in this pool.
 */

import { describe, expect, it } from "vitest";
import {
  LEGAL_PAGE_KINDS,
  LEGAL_PAGE_DEFAULTS,
  PAGE_LOCALES,
  TEMPLATE_VERSION,
  isLegalPageKind,
  isPageLocale,
  isValidPageSlug,
} from "./kinds";
import type { LegalPageKind, PageLocale } from "./kinds";
import { TEMPLATES, legalFactsFrom, renderLegalTemplate } from "./render";
import { escapeHtml, serializeLegalDocument } from "./serialize";
import { doc, p, section, ul } from "./types";
import type { StoreLegalFacts } from "./types";

/** A store that has filled in nothing beyond its name. */
const BARE: StoreLegalFacts = {
  storeName: "متجر تجريبي",
  legalName: null,
  rcNumber: null,
  nif: null,
  address: null,
  contactEmail: null,
  contactPhone: null,
  returnWindowDays: 0,
  deliveryMinDays: 2,
  deliveryMaxDays: 7,
};

/** A store that has filled in everything. */
const FULL: StoreLegalFacts = {
  storeName: "Boutique Test",
  legalName: "SARL Test Commerce",
  rcNumber: "16/00-1234567B25",
  nif: "000116001234567",
  address: "12 rue des Frères Bouadou, Bir Mourad Raïs, Alger",
  contactEmail: "contact@example.dz",
  contactPhone: "+213 555 00 00 00",
  returnWindowDays: 7,
  deliveryMinDays: 1,
  deliveryMaxDays: 5,
};

const CASES: ReadonlyArray<[PageLocale, LegalPageKind]> = PAGE_LOCALES.flatMap(
  (locale) => LEGAL_PAGE_KINDS.map((kind) => [locale, kind] as [PageLocale, LegalPageKind]),
);

/** Exactly the tags `serialize.ts` is allowed to emit. */
const EMITTED_TAGS = new Set(["h2", "p", "strong", "ul", "li"]);

function tagsIn(html: string): string[] {
  return [...html.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>/g)].map((m) => m[1].toLowerCase());
}

function attributesIn(html: string): string[] {
  return [...html.matchAll(/<[a-zA-Z0-9]+([^>]*)>/g)]
    .map((m) => m[1].trim())
    .filter((a) => a.length > 0);
}

describe("every kind × locale renders a complete document", () => {
  it.each(CASES)("%s / %s", (locale, kind) => {
    for (const facts of [BARE, FULL]) {
      const page = renderLegalTemplate(kind, locale, facts);
      expect(page.title.trim().length, "title").toBeGreaterThan(0);
      expect(page.metaDescription.trim().length, "metaDescription").toBeGreaterThan(0);
      // Short enough to be usable as a <meta name="description">.
      expect(page.metaDescription.length).toBeLessThanOrEqual(200);
      expect(page.bodyHtml).toContain("<h2>");
      expect(page.bodyHtml.length).toBeGreaterThan(800);
      expect(page.templateVersion).toBe(TEMPLATE_VERSION);
    }
  });
});

describe("the serializer emits nothing the rich-text allow-list would strip", () => {
  it.each(CASES)("%s / %s uses only h2/p/strong/ul/li and no attributes", (locale, kind) => {
    for (const facts of [BARE, FULL]) {
      const { bodyHtml } = renderLegalTemplate(kind, locale, facts);
      for (const tag of tagsIn(bodyHtml)) {
        expect(EMITTED_TAGS, `unexpected <${tag}>`).toContain(tag);
      }
      // No attributes at all means no href/src/style/class for the allow-list
      // to inspect, reject, or force — the output is inert by construction.
      expect(attributesIn(bodyHtml)).toEqual([]);
    }
  });
});

describe("no placeholder ever reaches a seeded page (plan D4)", () => {
  // The whole point of guarding clauses instead of substituting tokens: a store
  // that filled in nothing must still produce publishable prose. A page reading
  // "Contact us at [YOUR EMAIL]" is worse for Meta review than no page at all.
  const FORBIDDEN = ["{{", "}}", "[YOUR", "[your", "undefined", "null", "NaN", "TODO"];

  it.each(CASES)("%s / %s with no merchant facts", (locale, kind) => {
    const { title, metaDescription, bodyHtml } = renderLegalTemplate(kind, locale, BARE);
    const all = `${title}\n${metaDescription}\n${bodyHtml}`;
    for (const token of FORBIDDEN) {
      expect(all, `leaked "${token}"`).not.toContain(token);
    }
    // An empty element would be the visible shape of a dropped clause that was
    // not dropped cleanly.
    expect(bodyHtml).not.toMatch(/<(p|li|h2)>\s*<\/\1>/);
    expect(bodyHtml).not.toContain("<ul></ul>");
  });
});

describe("clauses appear only when the merchant fact behind them exists", () => {
  it("omits RC, NIF, address and contact lines for a bare store", () => {
    const { bodyHtml } = renderLegalTemplate("terms", "en", BARE);
    expect(bodyHtml).not.toContain("Commercial register");
    expect(bodyHtml).not.toContain("Tax identification");
    expect(bodyHtml).not.toContain("Address:");
    expect(bodyHtml).not.toContain("Email:");
    // …and says something useful instead of nothing.
    expect(bodyHtml).toContain("contact details shown on the store");
  });

  it("includes them, with the merchant's values, once filled in", () => {
    const { bodyHtml } = renderLegalTemplate("terms", "en", FULL);
    expect(bodyHtml).toContain("16/00-1234567B25");
    expect(bodyHtml).toContain("000116001234567");
    expect(bodyHtml).toContain("contact@example.dz");
    expect(bodyHtml).toContain("+213 555 00 00 00");
    expect(bodyHtml).toContain("SARL Test Commerce");
  });

  it("swaps the refund clause on returnWindowDays rather than printing a zero", () => {
    const none = renderLegalTemplate("refund", "en", BARE).bodyHtml;
    const some = renderLegalTemplate("refund", "en", FULL).bodyHtml;
    expect(none).toContain("we do not accept returns once the parcel has been accepted");
    expect(none).not.toContain("within 0 days");
    expect(some).toContain("within 7 days");
  });

  it("renders the delivery window from the profile in every locale", () => {
    for (const locale of PAGE_LOCALES) {
      const html = renderLegalTemplate("shipping", locale, FULL).bodyHtml;
      expect(html, locale).toContain("1");
      expect(html, locale).toContain("5");
    }
  });
});

describe("the three locales stay one policy in three languages", () => {
  // Guards the drift that actually happens: a clause added to the French pack
  // during a support conversation and never mirrored, so two shoppers of the
  // same store are told different things.
  it.each(LEGAL_PAGE_KINDS)("%s has the same structure in ar, en and fr", (kind) => {
    for (const facts of [BARE, FULL]) {
      const shapes = PAGE_LOCALES.map((locale) =>
        TEMPLATES[locale][kind](facts).sections.map((s) => s.blocks.map((b) => b.type).join(",")),
      );
      expect(shapes[1], "en vs ar").toEqual(shapes[0]);
      expect(shapes[2], "fr vs ar").toEqual(shapes[0]);
    }
  });

  it.each(LEGAL_PAGE_KINDS)("%s has a distinct title per locale", (kind) => {
    const titles = PAGE_LOCALES.map((l) => TEMPLATES[l][kind](FULL).title);
    expect(new Set(titles).size).toBe(PAGE_LOCALES.length);
  });
});

describe("escaping", () => {
  it("escapes the five markup-significant characters, ampersand first", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("neutralises a hostile store name instead of letting it become markup", () => {
    const hostile: StoreLegalFacts = {
      ...BARE,
      storeName: '<script>alert(1)</script><img src=x onerror=alert(1)>',
    };
    const { bodyHtml, metaDescription } = renderLegalTemplate("terms", "en", hostile);
    // The payload survives only as inert escaped text — no live tag, no live
    // attribute. `onerror` legitimately appears as the literal characters
    // inside `&lt;img ... onerror=...&gt;`, which is safe; what must never
    // appear is an actual `<script` or `<img` element, or any attribute at
    // all (the serializer emits none — see attributesIn below).
    expect(bodyHtml).not.toContain("<script");
    expect(bodyHtml).not.toContain("<img");
    expect(bodyHtml).toContain("&lt;script&gt;");
    expect(bodyHtml).toContain("&lt;img src=x onerror=alert(1)&gt;");
    // metaDescription is plain text for a <meta> attribute; the renderer of
    // that attribute escapes it, so it stays raw here by design.
    expect(metaDescription).toContain("<script>");
    expect(attributesIn(bodyHtml)).toEqual([]);
  });
});

describe("builders drop empty structures", () => {
  it("ul() returns null when every item was dropped", () => {
    expect(ul(null, undefined, "   ")).toBeNull();
    expect(ul(null, "kept")).toEqual({ type: "ul", items: ["kept"] });
  });

  it("section() returns null when every block was dropped", () => {
    expect(section("Heading", null, undefined)).toBeNull();
    expect(section("Heading", p("text"))?.blocks).toHaveLength(1);
  });

  it("doc() drops null sections so no empty <h2> is emitted", () => {
    const d = doc("T", "D", null, section("Kept", p("body")), undefined);
    expect(d.sections).toHaveLength(1);
    expect(serializeLegalDocument(d)).toBe("<h2>Kept</h2><p>body</p>");
  });

  it("renders a lead as <strong> inside the paragraph", () => {
    const d = doc("T", "D", section("H", p("Phone:", "0555")));
    expect(serializeLegalDocument(d)).toBe("<h2>H</h2><p><strong>Phone:</strong> 0555</p>");
  });
});

describe("legalFactsFrom normalises rows before the templates see them", () => {
  it("treats blank strings as absent facts", () => {
    const facts = legalFactsFrom(
      { name: "Shop" },
      { legalName: "   ", rcNumber: "", nif: null, contactEmail: "  a@b.dz  " },
    );
    expect(facts.legalName).toBeNull();
    expect(facts.rcNumber).toBeNull();
    expect(facts.nif).toBeNull();
    expect(facts.contactEmail).toBe("a@b.dz");
  });

  it("falls back to the migration defaults when there is no profile row", () => {
    const facts = legalFactsFrom({ name: "Shop" }, null);
    expect(facts).toMatchObject({
      storeName: "Shop",
      returnWindowDays: 0,
      deliveryMinDays: 2,
      deliveryMaxDays: 7,
    });
  });

  it("clamps day counts so a bad row cannot render as prose", () => {
    const facts = legalFactsFrom(
      { name: "Shop" },
      { returnWindowDays: -5, deliveryMinDays: 1.9, deliveryMaxDays: Number.NaN },
    );
    expect(facts.returnWindowDays).toBe(0);
    expect(facts.deliveryMinDays).toBe(1);
    expect(facts.deliveryMaxDays).toBe(7);
  });
});

describe("kind, locale and slug helpers", () => {
  it("recognises the four legal kinds and rejects custom", () => {
    expect(LEGAL_PAGE_KINDS.every(isLegalPageKind)).toBe(true);
    expect(isLegalPageKind("custom")).toBe(false);
    expect(isLegalPageKind("nonsense")).toBe(false);
  });

  it("recognises the three page locales", () => {
    expect(PAGE_LOCALES.every(isPageLocale)).toBe(true);
    expect(isPageLocale("de")).toBe(false);
  });

  it("gives every legal kind a unique default slug and footer position", () => {
    const slugs = LEGAL_PAGE_KINDS.map((k) => LEGAL_PAGE_DEFAULTS[k].slug);
    const positions = LEGAL_PAGE_KINDS.map((k) => LEGAL_PAGE_DEFAULTS[k].position);
    expect(new Set(slugs).size).toBe(LEGAL_PAGE_KINDS.length);
    expect(new Set(positions).size).toBe(LEGAL_PAGE_KINDS.length);
    expect(slugs.every(isValidPageSlug)).toBe(true);
  });

  it("accepts kebab-case slugs and rejects everything else", () => {
    expect(isValidPageSlug("terms")).toBe(true);
    expect(isValidPageSlug("refund-policy")).toBe(true);
    expect(isValidPageSlug("a1-b2-c3")).toBe(true);
    expect(isValidPageSlug("ab")).toBe(false);
    expect(isValidPageSlug("-terms")).toBe(false);
    expect(isValidPageSlug("terms-")).toBe(false);
    expect(isValidPageSlug("terms--policy")).toBe(false);
    expect(isValidPageSlug("Terms")).toBe(false);
    expect(isValidPageSlug("terms policy")).toBe(false);
    expect(isValidPageSlug("شروط")).toBe(false);
    expect(isValidPageSlug("a".repeat(61))).toBe(false);
  });
});

// @vitest-environment node
// Must run in the node environment — see ProductDescription.render.test.ts.
/**
 * Footer render tests — the regression this whole feature exists to fix.
 *
 * Before this feature, the footer's "Shipping"/"Returns" column was two
 * dead `<span>`s with no `href` — a crawler saw policy labels that led
 * nowhere, which reads worse to a Meta Ads reviewer than no labels at all.
 * These tests pin that the column is now driven entirely by `config.pages`
 * (D6): real `<a href="/pages/<slug>">` elements, titled in the store's own
 * language, and — critically — that an empty `pages` array renders an empty
 * list rather than falling back to any hardcoded label.
 */
/// <reference types="vitest/globals" />

import { experimental_AstroContainer as AstroContainer } from "astro/container";
import Footer from "./Footer.astro";
import { DEFAULT_CONFIG } from "@/theme/config/store";
import { en } from "@/theme/content/en";
import type { StoreConfig, StorePageLink } from "@/core/api/types";

function page(overrides: Partial<StorePageLink> = {}): StorePageLink {
  return {
    id: "sp_1",
    kind: "terms",
    slug: "terms",
    title: "Terms and Conditions",
    position: 1,
    ...overrides,
  };
}

async function render(config: StoreConfig): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Footer, { props: { config, content: en } });
}

describe("Footer — the policy links column", () => {
  it("renders a real <a href> for every configured page, never a dead <span>", async () => {
    const html = await render({
      ...DEFAULT_CONFIG,
      pages: [
        page({ id: "sp_terms", kind: "terms", slug: "terms", title: "Terms and Conditions", position: 1 }),
        page({ id: "sp_refund", kind: "refund", slug: "refund-policy", title: "Refund and Return", position: 3 }),
      ],
    });

    expect(html).toContain('href="/pages/terms"');
    expect(html).toContain("Terms and Conditions");
    expect(html).toContain('href="/pages/refund-policy"');
    expect(html).toContain("Refund and Return");
  });

  it("renders no page links, and no hardcoded label, when the store has none", async () => {
    const html = await render({ ...DEFAULT_CONFIG, pages: [] });

    expect(html).not.toContain("/pages/");
    // The old hardcoded fallback labels this feature replaced — must never
    // reappear as dead text once the real link list is empty.
    expect(html).not.toContain("Shipping Info");
    expect(html).not.toContain("Returns & Exchange");
  });

  it("still renders the contact line even with no pages configured", async () => {
    const html = await render({ ...DEFAULT_CONFIG, pages: [] });
    expect(html).toContain(en.navContact);
  });

  it("titles links exactly as the server resolved them — no client-side relabeling", async () => {
    const html = await render({
      ...DEFAULT_CONFIG,
      pages: [page({ slug: "conditions-generales", title: "Conditions Générales de Vente" })],
    });
    expect(html).toContain('href="/pages/conditions-generales"');
    expect(html).toContain("Conditions Générales de Vente");
  });
});

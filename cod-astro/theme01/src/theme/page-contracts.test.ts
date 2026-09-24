/**
 * Page contracts.
 *
 * Some invariants live in a page's frontmatter rather than in any module, so
 * no unit test can reach them and `astro check` is happy either way. They are
 * still invariants, and one of them broke in production.
 *
 * When the checkout page shipped it loaded its own controller, the OTP step
 * and Turnstile — but not `track-abandonment.ts`. Nothing failed. Product
 * pages went on capturing abandoners and the new, higher-value journey
 * captured none, which reads as "the cart is losing us leads" rather than as
 * a missing script tag. That is the class of bug these tests exist for.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const PAGES = resolve(__dirname, "../pages");

function pageFiles(dir: string = PAGES, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) pageFiles(full, out);
    else if (entry.name.endsWith(".astro")) out.push(full);
  }
  return out;
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

function scriptsOf(source: string): Set<string> {
  return new Set([...source.matchAll(/scripts\/([a-z0-9-]+)\.ts/g)].map((m) => m[1]));
}

/**
 * Every page that can take an order.
 *
 * `otp-step` is the marker: it is added per page, and exactly to the pages
 * that render the customer-details form. Using it as the definition means a
 * new checkout surface joins this set automatically instead of being
 * remembered.
 */
function checkoutPages(): Array<{ file: string; scripts: Set<string> }> {
  return pageFiles()
    .map((file) => ({ file, scripts: scriptsOf(read(file)) }))
    .filter((page) => page.scripts.has("otp-step"));
}

describe("pages that take an order", () => {
  it("there are some, so this suite is actually checking something", () => {
    expect(checkoutPages().length).toBeGreaterThanOrEqual(3);
  });

  it("every one of them captures abandoned checkouts", () => {
    const missing = checkoutPages()
      .filter((page) => !page.scripts.has("track-abandonment"))
      .map((page) => relative(PAGES, page.file));

    expect(
      missing,
      `These pages collect a name and a phone number but never load ` +
        `track-abandonment.ts, so everyone who fills the form and leaves is ` +
        `invisible on the merchant's callback list: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every one of them loads the bot gate", () => {
    const missing = checkoutPages()
      .filter((page) => !page.scripts.has("turnstile-field"))
      .map((page) => relative(PAGES, page.file));

    expect(missing).toEqual([]);
  });
});

describe("the checkout page", () => {
  const source = read(join(PAGES, "checkout.astro"));

  it("is closed when the merchant has the cart switched off", () => {
    // Otherwise a feature the merchant disabled stays reachable by URL.
    expect(source).toMatch(/if \(!config\.cartEnabled\)/);
    expect(source).toMatch(/Astro\.redirect\(/);
  });

  it("is not indexed", () => {
    // Transactional and basket-dependent: a crawler only ever sees the empty
    // state, and that is what would land in search results.
    expect(source).toMatch(/noindex=\{true\}/);
  });

  it("loads its own controller", () => {
    expect(scriptsOf(source).has("checkout")).toBe(true);
  });
});

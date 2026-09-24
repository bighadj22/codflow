/**
 * Icon allowlist guard.
 *
 * astro.config.mjs configures astro-icon with an explicit allowlist
 * (`icon({ include: { heroicons: [...] } })`) rather than bundling the whole
 * heroicons set. That is deliberate: it keeps the icon bundle small. It also
 * means using a new icon anywhere in the theme without adding it to that list
 * is invisible until a real request renders it — `astro check`, the theme's
 * own string/style validators, and this suite's happy-dom component tests all
 * pass, because none of them exercise astro-icon's actual sprite lookup. Only
 * a live request does, and it throws mid-render: "Unable to locate
 * \"heroicons:x\" icon!", after headers are already sent — a 200 with an
 * empty body, not a clean error page.
 *
 * This is a real regression: `CartDrawer.astro`, `CartBadge.astro` and
 * `AddToCartButton.astro` shipped using `x-mark`, `minus`, `plus` and `trash`
 * without adding any of them to the allowlist, and the cart crashed the whole
 * page the first time a merchant turned it on.
 *
 * This test reads the two real sources of truth — every `Icon
 * name="heroicons:…"` literal actually in the theme, and the actual allowlist
 * in astro.config.mjs — and fails loudly on any gap, in both directions.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const THEME_ROOT = resolve(__dirname, "../.."); // src/theme -> theme01 package root

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".astro")) out.push(full);
  }
  return out;
}

/** Every `heroicons:<name>` literal actually referenced in the theme's markup. */
function usedIconNames(): Set<string> {
  const names = new Set<string>();
  const pattern = /(?:name|icon)=["']heroicons:([a-z0-9-]+)["']/g;
  for (const file of walk(join(THEME_ROOT, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

/** The heroicons allowlist astro-icon is actually configured with. */
function allowlistedIconNames(): Set<string> {
  const configPath = join(THEME_ROOT, "astro.config.mjs");
  const text = readFileSync(configPath, "utf8");

  const heroSection = text.match(/heroicons:\s*\[([\s\S]*?)\]/);
  if (!heroSection) {
    throw new Error(
      "astro.config.mjs no longer has an `include: { heroicons: [...] }` block " +
        "in the shape this guard expects — update the guard alongside the config.",
    );
  }
  const names = new Set<string>();
  for (const match of heroSection[1].matchAll(/["']([a-z0-9-]+)["']/g)) {
    names.add(match[1]);
  }
  return names;
}

/** The full heroicons set astro-icon draws the allowlist from. */
function installedIconNames(): Set<string> {
  const pkgPath = require.resolve("@iconify-json/heroicons/icons.json", {
    paths: [THEME_ROOT, resolve(THEME_ROOT, "../..")],
  });
  const data = JSON.parse(readFileSync(pkgPath, "utf8")) as { icons: Record<string, unknown> };
  return new Set(Object.keys(data.icons));
}

describe("astro-icon heroicons allowlist", () => {
  it("allowlists every heroicons name the theme actually renders", () => {
    const used = usedIconNames();
    const allowed = allowlistedIconNames();
    const missing = [...used].filter((name) => !allowed.has(name));

    expect(
      missing,
      `These icons are used in .astro markup but missing from the ` +
        `include.heroicons allowlist in astro.config.mjs, which crashes the ` +
        `page at request time (astro-icon throws "Unable to locate" instead ` +
        `of rendering): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("sanity check: the guard itself is actually finding icon usages", () => {
    // If this ever hits zero, the regex above stopped matching real markup —
    // an empty `missing` array would then be a false pass, not a real one.
    expect(usedIconNames().size).toBeGreaterThan(10);
  });

  it("every allowlisted name exists in the installed heroicons package", () => {
    // The inverse mistake: allowlisting a typo'd or renamed icon does nothing
    // useful and hides that the intended icon is still missing.
    const allowed = allowlistedIconNames();
    const installed = installedIconNames();
    const unknown = [...allowed].filter((name) => !installed.has(name));

    expect(
      unknown,
      `These names are in the astro.config.mjs allowlist but do not exist in ` +
        `the installed @iconify-json/heroicons package: ${unknown.join(", ")}`,
    ).toEqual([]);
  });

  it("the cart components specifically stay covered", () => {
    // Names this exact regression shipped with, pinned so a future refactor
    // that renames the allowlist block cannot silently drop them again.
    const allowed = allowlistedIconNames();
    for (const name of ["x-mark", "minus", "plus", "trash", "shopping-bag"]) {
      expect(allowed.has(name), `"${name}" should be allowlisted`).toBe(true);
    }
  });
});

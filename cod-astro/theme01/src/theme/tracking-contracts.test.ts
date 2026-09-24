/**
 * Which pixel the storefront fires at.
 *
 * These invariants live in page frontmatter and in inline scripts, so no unit
 * test can reach them and `astro check` is happy either way — the same class
 * of gap `page-contracts.test.ts` exists for.
 *
 * What they protect: Meta deduplicates a browser event against its server
 * mirror only when both reached the SAME pixel id (capi-deduplication.md). If
 * this theme ever decides a pixel for itself — from a slug in the URL, from
 * sessionStorage, from the store config on a page that has its own pixel — it
 * can pick a different one from the Conversions API, and Meta then records two
 * conversions in two ad accounts instead of merging them into one.
 *
 * So the rule is: the theme RENDERS a pixel the server resolved. It never
 * works one out.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(SRC, relativePath), "utf8");
}

/** The identifier a page hands to StoreLayout — what BaseHead initialises. */
function layoutConfigOf(source: string): string {
  const match = source.match(/<StoreLayout[\s\S]*?config=\{([A-Za-z0-9_$.]+)\}/);
  expect(match, "page must pass a config to StoreLayout").not.toBeNull();
  return match![1];
}

/** The identifier behind data-pixel-id — what product.ts fires events at. */
function pixelSourceOf(source: string): string {
  const match = source.match(/data-pixel-id=\{([A-Za-z0-9_$]+)\.pixelId/);
  expect(match, "page must set data-pixel-id from a config object").not.toBeNull();
  return match![1];
}

const landingPage = read("pages/lp/[slug].astro");
const thankYou = read("pages/thank-you.astro");
const productDetail = read("theme/components/product/ProductDetailContent.astro");

describe("the landing page", () => {
  it("renders the pixel the server resolved for it, not the store's", () => {
    // `lp.tracking` is computed by cod-shared inside the batch this page
    // already runs. Falling back to `config.pixelId` here would put a page
    // with its own pixel back on the store's.
    expect(landingPage).toMatch(/lp\.tracking/);
  });

  it("loads and fires at one and the same pixel", () => {
    // The head initialises whatever config the layout gets; product.ts fires
    // ViewContent and InitiateCheckout at data-pixel-id. If those two name
    // different values, the page installs one pixel and reports to another —
    // and with trackSingle the events would reach nothing at all.
    expect(layoutConfigOf(landingPage)).toBe(pixelSourceOf(landingPage));
  });

  it("does not fall back to the bare store config for either", () => {
    expect(layoutConfigOf(landingPage)).not.toBe("config");
  });
});

describe("the thank-you page", () => {
  it("asks the server which pixel this order belongs to", () => {
    // The page knows the order id and nothing else. Attribution is
    // best-effort server-side, so any slug it might read from the URL could
    // name a pixel the server never recorded against this order.
    expect(thankYou).toMatch(/fetchOrderTracking/);
  });

  it("does not decide the pixel from the store config", () => {
    expect(thankYou).not.toMatch(/config\.pixelId/);
  });

  it("does not re-implement the conversion-stage rule", () => {
    // It used to map conversionEvent → the browser event inline, a second
    // copy of resolveConversionForStage. The endpoint now returns the
    // decision, so the copy is gone and cannot drift.
    expect(thankYou).not.toMatch(/Purchase_Confirmed/);
    expect(thankYou).not.toMatch(/config\.conversionEvent/);
  });

  it("fires the sale at one named pixel", () => {
    // trackSingle rather than track: immune to a future change that
    // initialises a second pixel on the page and silently double-reports.
    //
    // Asserted on the CALL, not on the file: a first attempt matched the word
    // anywhere in the source, so the comment above the call kept it green
    // after the call itself was changed back to `track`.
    const call = thankYou.match(/fbq\(\s*'([a-zA-Z]+)'\s*,\s*([^,]+),/);
    expect(call, "thank-you page must fire an fbq event").not.toBeNull();
    expect(call![1]).toBe("trackSingle");
    // trackSingle's second argument is the pixel — the resolved one, not a
    // literal and not the store config.
    expect(call![2]).toContain("pixelId");
  });

  it("still ties the browser event to the order id for deduplication", () => {
    // capi-deduplication.md: browser eventID must equal the server event_id,
    // and the names must match, or the conversion counts twice.
    expect(thankYou).toMatch(/eventID/);
  });
});

describe("the product page", () => {
  it("keeps using the store pixel", () => {
    // A product page belongs to no landing page. Per-page pixels are a
    // campaign-level idea, and the catalogue is not a campaign.
    expect(productDetail).toMatch(/config\.pixelId/);
    expect(productDetail).not.toMatch(/tracking/);
  });
});

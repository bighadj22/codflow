/**
 * Pages screen presentation logic.
 *
 * Two things matter most here: the list order matches Meta's own checklist
 * (terms/privacy/refund/shipping, custom after), and `pageNeedsReview` is the
 * single source for the ⚠ vs ✓ badge — get it wrong and a merchant either
 * never notices an unreviewed legal page, or is nagged about one they already
 * fixed.
 */
import { describe, expect, it } from "vitest";
import {
  localeLabelKey,
  orderedLocales,
  orderStorePages,
  pageKindLabelKey,
  pageNeedsReview,
  storePagesErrorMessage,
} from "./model";
import type { StorePageSummary } from "./types";

function page(overrides: Partial<StorePageSummary> = {}): StorePageSummary {
  return {
    id: "sp_1",
    kind: "custom",
    slug: "page",
    status: "published",
    showInFooter: true,
    position: 0,
    templateVersion: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    translations: [{ locale: "ar", title: "t", source: "merchant", updatedAt: "2026-01-01T00:00:00.000Z" }],
    ...overrides,
  };
}

describe("orderStorePages", () => {
  it("puts the four legal kinds first, in Meta's checklist order, ahead of any custom page", () => {
    const pages = [
      page({ id: "custom-1", kind: "custom", createdAt: "2026-01-01T00:00:00.000Z" }),
      page({ id: "shipping", kind: "shipping", position: 4 }),
      page({ id: "terms", kind: "terms", position: 1 }),
      page({ id: "refund", kind: "refund", position: 3 }),
      page({ id: "privacy", kind: "privacy", position: 2 }),
    ];
    expect(orderStorePages(pages).map((p) => p.id)).toEqual([
      "terms", "privacy", "refund", "shipping", "custom-1",
    ]);
  });

  it("orders legal kinds by position even if rows arrive out of order", () => {
    const pages = [
      page({ id: "a", kind: "terms", position: 5 }),
      page({ id: "b", kind: "terms", position: 1 }),
    ];
    // Two 'terms' pages is not a real scenario (unique per store), but the
    // sort must still be position-stable rather than crash or reorder oddly.
    expect(orderStorePages(pages).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("orders custom pages newest-first", () => {
    const pages = [
      page({ id: "old", kind: "custom", createdAt: "2026-01-01T00:00:00.000Z" }),
      page({ id: "new", kind: "custom", createdAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(orderStorePages(pages).map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("does not mutate the input array", () => {
    const pages = [page({ id: "a", kind: "shipping" }), page({ id: "b", kind: "terms" })];
    const copy = [...pages];
    orderStorePages(pages);
    expect(pages).toEqual(copy);
  });
});

describe("orderedLocales", () => {
  it("puts the store's own language first", () => {
    expect(orderedLocales("fr")).toEqual(["fr", "ar", "en"]);
    expect(orderedLocales("ar")).toEqual(["ar", "en", "fr"]);
    expect(orderedLocales("en")).toEqual(["en", "ar", "fr"]);
  });

  it("always includes all three locales — none are ever dropped", () => {
    for (const locale of ["ar", "en", "fr"] as const) {
      expect(orderedLocales(locale).sort()).toEqual(["ar", "en", "fr"]);
    }
  });
});

describe("pageNeedsReview", () => {
  it("is false when every saved locale has been merchant-reviewed", () => {
    expect(
      pageNeedsReview(
        page({
          translations: [
            { locale: "ar", title: "t", source: "merchant", updatedAt: "x" },
            { locale: "en", title: "t", source: "merchant", updatedAt: "x" },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("is true when at least one locale is still the untouched template", () => {
    expect(
      pageNeedsReview(
        page({
          translations: [
            { locale: "ar", title: "t", source: "merchant", updatedAt: "x" },
            { locale: "en", title: "t", source: "template", updatedAt: "x" },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("is true for a page with no translations at all (defensive)", () => {
    expect(pageNeedsReview(page({ translations: [] }))).toBe(true);
  });
});

describe("pageKindLabelKey / localeLabelKey", () => {
  it("gives every kind and every locale a distinct label key", () => {
    const kinds = ["terms", "privacy", "refund", "shipping", "custom"] as const;
    const keys = kinds.map(pageKindLabelKey);
    expect(new Set(keys).size).toBe(kinds.length);

    const locales = ["ar", "en", "fr"] as const;
    const localeKeys = locales.map(localeLabelKey);
    expect(new Set(localeKeys).size).toBe(locales.length);
  });
});

describe("storePagesErrorMessage", () => {
  const t = (key: string) => key;

  // Shaped like @/lib/api's ApiError without importing it — that module
  // pulls in astro:env/client, which plain vitest cannot resolve. See the
  // comment on isApiError in model.ts.
  function apiError(code: string) {
    return Object.assign(new Error("x"), { name: "ApiError", code });
  }

  it("maps each known API error code to its own message key", () => {
    expect(storePagesErrorMessage(apiError("DUPLICATE_ENTITY"), t)).toBe("errors.slug_taken");
    expect(storePagesErrorMessage(apiError("STORE_PAGE_CANNOT_DELETE_LEGAL"), t)).toBe(
      "errors.cannot_delete_legal",
    );
    expect(storePagesErrorMessage(apiError("STORE_PAGE_NOT_LEGAL"), t)).toBe("errors.not_legal");
    expect(storePagesErrorMessage(apiError("VALIDATION_FAILED"), t)).toBe("errors.validation");
  });

  it("falls back to a generic message for an unrecognised code or a non-ApiError", () => {
    expect(storePagesErrorMessage(apiError("SOMETHING_ELSE"), t)).toBe("errors.generic");
    expect(storePagesErrorMessage(new Error("network down"), t)).toBe("errors.generic");
    expect(storePagesErrorMessage("not even an error", t)).toBe("errors.generic");
  });
});

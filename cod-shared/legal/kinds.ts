/**
 * Store page kinds, locales, and the defaults a seeded store starts with.
 *
 * Kept separate from the templates so anything that only needs to know *which*
 * pages exist — routing, RBAC, the dashboard list — does not pull three
 * locales of legal prose into its bundle.
 */

/** The four documents Meta Ads looks for before it will run a store's ads. */
export const LEGAL_PAGE_KINDS = ["terms", "privacy", "refund", "shipping"] as const;
export type LegalPageKind = (typeof LEGAL_PAGE_KINDS)[number];

/** Every kind a `store_pages` row may carry. */
export const STORE_PAGE_KINDS = [...LEGAL_PAGE_KINDS, "custom"] as const;
export type StorePageKind = (typeof STORE_PAGE_KINDS)[number];

export function isLegalPageKind(value: string): value is LegalPageKind {
  return (LEGAL_PAGE_KINDS as readonly string[]).includes(value);
}

/**
 * The locales a page body can be stored in — the same three the dashboard and
 * theme01 already ship. A store serves exactly one of them (`stores.lang`).
 */
export const PAGE_LOCALES = ["ar", "en", "fr"] as const;
export type PageLocale = (typeof PAGE_LOCALES)[number];

/**
 * Where locale resolution lands when a store's own language has no row.
 * Matches `stores.lang`'s own default, so the fallback is never a surprise.
 */
export const DEFAULT_PAGE_LOCALE: PageLocale = "ar";

export function isPageLocale(value: string): value is PageLocale {
  return (PAGE_LOCALES as readonly string[]).includes(value);
}

/**
 * Slug and footer order a freshly seeded legal page starts with.
 *
 * These are *starting* values, not constants the system depends on: the
 * storefront resolves a page by `kind`, so a merchant may rename any slug
 * without breaking the checkout consent links or the footer.
 */
export const LEGAL_PAGE_DEFAULTS: Readonly<
  Record<LegalPageKind, { slug: string; position: number }>
> = {
  terms: { slug: "terms", position: 1 },
  privacy: { slug: "privacy", position: 2 },
  refund: { slug: "refund-policy", position: 3 },
  shipping: { slug: "shipping-policy", position: 4 },
};

/**
 * Bumped whenever the template prose changes materially.
 *
 * Stored on the page so a later revision is a visible, merchant-initiated
 * re-apply rather than a silent rewrite of a document they may have signed off.
 */
export const TEMPLATE_VERSION = 1;

/** Slug rule, shared by the API validator and the dashboard field. */
export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PAGE_SLUG_MIN = 3;
export const PAGE_SLUG_MAX = 60;

export function isValidPageSlug(slug: string): boolean {
  return (
    slug.length >= PAGE_SLUG_MIN &&
    slug.length <= PAGE_SLUG_MAX &&
    PAGE_SLUG_PATTERN.test(slug)
  );
}

/**
 * Presentation logic for the Pages screen — everything that isn't a direct
 * fetch. The rules themselves (which slug is valid, which locales exist,
 * which kinds are legal) live in cod-shared/legal; this file only decides how
 * to show them.
 *
 * Deliberately does not import `ApiError` from `@/lib/api`: that module pulls
 * in `astro:env/client`, which only resolves under Astro's own build/dev
 * pipeline and not under plain vitest — importing it here would drag that
 * requirement into every test of this file's pure logic. `isApiError` below
 * duck-types the one property this file actually needs.
 */
import {
  LEGAL_PAGE_KINDS,
  PAGE_LOCALES,
  DEFAULT_PAGE_LOCALE,
  isValidPageSlug,
} from "../../../../cod-shared/legal/kinds";
import type { PageLocale, StorePageKind, StorePageSummary } from "./types";

export { isValidPageSlug };
export { LEGAL_PAGE_KINDS, PAGE_LOCALES, DEFAULT_PAGE_LOCALE };

/** List order: the four legal kinds first (Meta's own checklist order), custom pages after, newest first. */
export function orderStorePages(pages: StorePageSummary[]): StorePageSummary[] {
  const rank = (kind: StorePageKind) => {
    const i = (LEGAL_PAGE_KINDS as readonly string[]).indexOf(kind);
    return i === -1 ? LEGAL_PAGE_KINDS.length : i;
  };
  return [...pages].sort((a, b) => {
    const r = rank(a.kind) - rank(b.kind);
    if (r !== 0) return r;
    if (a.kind === "custom" && b.kind === "custom") {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return a.position - b.position;
  });
}

/**
 * The store's own language first, then the other two — never omitted. Seeding
 * always writes all three locales, so every tab has *something* to show; the
 * store's own language is simply the one that matters, and the other two are
 * "used only if you switch your store language" (plan §7/§10).
 */
export function orderedLocales(storeLocale: PageLocale): PageLocale[] {
  return [storeLocale, ...PAGE_LOCALES.filter((l) => l !== storeLocale)];
}

/**
 * A page still needs the merchant's attention when ANY of its saved locales
 * is still the untouched template (source='template') — plan D8. A page with
 * zero translations (should not happen post-seed, but a defensive read)
 * counts as needing attention too, since there is nothing to show yet.
 */
export function pageNeedsReview(page: StorePageSummary): boolean {
  if (page.translations.length === 0) return true;
  return page.translations.some((t) => t.source === "template");
}

const KIND_LABEL_KEYS: Record<StorePageKind, string> = {
  terms: "kind.terms",
  privacy: "kind.privacy",
  refund: "kind.refund",
  shipping: "kind.shipping",
  custom: "kind.custom",
};

/** Dot-path into the store-pages `kind` namespace for this page's kind. */
export function pageKindLabelKey(kind: StorePageKind): string {
  return KIND_LABEL_KEYS[kind];
}

const LOCALE_LABEL_KEYS: Record<PageLocale, string> = {
  ar: "locale.ar",
  en: "locale.en",
  fr: "locale.fr",
};

export function localeLabelKey(locale: PageLocale): string {
  return LOCALE_LABEL_KEYS[locale];
}

/** Duck-types `@/lib/api`'s `ApiError` — see the module comment for why. */
function isApiError(value: unknown): value is { code?: string } {
  return typeof value === "object" && value !== null && (value as { name?: unknown }).name === "ApiError";
}

/**
 * Maps a thrown ApiError to a message already in the merchant's language.
 * Falls back to a generic save-failed message for anything the screen does
 * not have specific copy for — never the raw server string, which may be in
 * English regardless of the merchant's dashboard language.
 */
export function storePagesErrorMessage(cause: unknown, t: (key: string) => string): string {
  if (isApiError(cause)) {
    switch (cause.code) {
      case "DUPLICATE_ENTITY":
        return t("errors.slug_taken");
      case "STORE_PAGE_CANNOT_DELETE_LEGAL":
        return t("errors.cannot_delete_legal");
      case "STORE_PAGE_NOT_LEGAL":
        return t("errors.not_legal");
      case "VALIDATION_FAILED":
        return t("errors.validation");
      default:
        return t("errors.generic");
    }
  }
  return t("errors.generic");
}

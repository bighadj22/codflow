/**
 * The legal template pack: the pre-made policy documents a CodFlow store is
 * seeded with, and the facts they are rendered from.
 *
 * These templates are a starting point written for Algerian cash-on-delivery
 * stores. They are not legal advice, and the dashboard says so where the
 * merchant can see it.
 */

export {
  LEGAL_PAGE_KINDS,
  STORE_PAGE_KINDS,
  LEGAL_PAGE_DEFAULTS,
  PAGE_LOCALES,
  DEFAULT_PAGE_LOCALE,
  TEMPLATE_VERSION,
  PAGE_SLUG_PATTERN,
  PAGE_SLUG_MIN,
  PAGE_SLUG_MAX,
  isLegalPageKind,
  isPageLocale,
  isValidPageSlug,
} from "./kinds";
export type { LegalPageKind, StorePageKind, PageLocale } from "./kinds";

export { renderLegalTemplate, legalFactsFrom, TEMPLATES } from "./render";
export type { RenderedLegalPage } from "./render";

export { serializeLegalDocument, escapeHtml } from "./serialize";

export type {
  LegalBlock,
  LegalDocument,
  LegalSection,
  LegalTemplatePack,
  LegalTemplateRegistry,
  StoreLegalFacts,
} from "./types";

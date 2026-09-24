/**
 * The one call that turns a store's facts into a ready-to-store legal page.
 *
 * Everything the template pack knows — which locale, which clauses survive
 * which missing fact, how a document becomes markup — sits behind this
 * signature. Callers (the seeder, the "reset to template" endpoint) pass three
 * values and get back exactly the columns `store_page_translations` needs.
 */

import { TEMPLATE_VERSION } from "./kinds";
import type { LegalPageKind, PageLocale } from "./kinds";
import { serializeLegalDocument } from "./serialize";
import type { LegalTemplateRegistry, StoreLegalFacts } from "./types";
import { ar } from "./templates/ar";
import { en } from "./templates/en";
import { fr } from "./templates/fr";

export const TEMPLATES: LegalTemplateRegistry = { ar, en, fr };

export interface RenderedLegalPage {
  readonly title: string;
  readonly metaDescription: string;
  /**
   * Allow-listed HTML: `h2`, `p`, `strong`, `ul`, `li`, no attributes.
   * Already inside `sanitizeRichText`'s allow-list, so seeding never needs to
   * sanitise — but the write chokepoint does so anyway, uniformly, rather than
   * trusting a caller to know which path it is on.
   */
  readonly bodyHtml: string;
  readonly templateVersion: number;
}

export function renderLegalTemplate(
  kind: LegalPageKind,
  locale: PageLocale,
  facts: StoreLegalFacts,
): RenderedLegalPage {
  const document = TEMPLATES[locale][kind](facts);
  return {
    title: document.title,
    metaDescription: document.metaDescription,
    bodyHtml: serializeLegalDocument(document),
    templateVersion: TEMPLATE_VERSION,
  };
}

/**
 * Row shapes → template facts.
 *
 * Accepts the store row and the (possibly absent) legal profile row, and
 * normalises every empty-string-or-null column to `null` so the templates only
 * ever test truthiness. A store with no profile row at all still renders: the
 * defaults here match the column defaults in migration 0030.
 */
export function legalFactsFrom(
  store: { name: string },
  profile: {
    legalName?: string | null;
    rcNumber?: string | null;
    nif?: string | null;
    address?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    returnWindowDays?: number | null;
    deliveryMinDays?: number | null;
    deliveryMaxDays?: number | null;
  } | null,
): StoreLegalFacts {
  const text = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  // A negative or fractional day count would render as prose; clamp to a whole
  // non-negative number rather than letting a bad row reach a published page.
  const days = (value: number | null | undefined, fallback: number): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.trunc(value));
  };

  return {
    storeName: store.name,
    legalName: text(profile?.legalName),
    rcNumber: text(profile?.rcNumber),
    nif: text(profile?.nif),
    address: text(profile?.address),
    contactEmail: text(profile?.contactEmail),
    contactPhone: text(profile?.contactPhone),
    returnWindowDays: days(profile?.returnWindowDays, 0),
    deliveryMinDays: days(profile?.deliveryMinDays, 2),
    deliveryMaxDays: days(profile?.deliveryMaxDays, 7),
  };
}

/**
 * A legal document as *data*, plus the builders templates are written with.
 *
 * Templates are not HTML strings. They are typed structures, for two reasons
 * that both bit the alternative:
 *
 *   1. A clause the merchant has no fact for (no RC number, no return window)
 *      must vanish, not render as `[YOUR RC NUMBER]`. As data that is a `null`
 *      the builder drops; as a string it is a regex over prose.
 *   2. The serializer emits a fixed, tiny tag set with no attributes at all,
 *      so the output is inside `cod-shared/lib/rich-text.ts`'s allow-list by
 *      construction rather than by review.
 */

import type { LegalPageKind, PageLocale } from "./kinds";

export type LegalBlock =
  | { readonly type: "p"; readonly lead?: string; readonly text: string }
  | { readonly type: "ul"; readonly items: readonly string[] };

export interface LegalSection {
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  readonly title: string;
  readonly metaDescription: string;
  readonly sections: readonly LegalSection[];
}

/**
 * The merchant facts a policy cannot be written without.
 *
 * Every field except `storeName` is optional on purpose: a store that has
 * filled in nothing still gets four complete, publishable documents — shorter
 * ones, with the clauses that needed a missing fact left out.
 */
export interface StoreLegalFacts {
  readonly storeName: string;
  readonly legalName: string | null;
  readonly rcNumber: string | null;
  readonly nif: string | null;
  readonly address: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  /** 0 means no post-delivery return window is offered; the clause is dropped. */
  readonly returnWindowDays: number;
  readonly deliveryMinDays: number;
  readonly deliveryMaxDays: number;
}

/** One locale's four documents. */
export type LegalTemplatePack = Readonly<
  Record<LegalPageKind, (facts: StoreLegalFacts) => LegalDocument>
>;

export type LegalTemplateRegistry = Readonly<Record<PageLocale, LegalTemplatePack>>;

// ─── Builders ────────────────────────────────────────────────────────────────
//
// `null` and `undefined` mean "this clause had no fact behind it". They are
// filtered out here, so a template body reads as a list of clauses and never
// as a chain of conditionals.

type Maybe<T> = T | null | undefined;

export function p(text: string): LegalBlock;
export function p(lead: string, text: string): LegalBlock;
export function p(a: string, b?: string): LegalBlock {
  return b === undefined ? { type: "p", text: a } : { type: "p", lead: a, text: b };
}

/** A bullet list. Returns null when every item was dropped. */
export function ul(...items: Maybe<string>[]): LegalBlock | null {
  const kept = items.filter((item): item is string => Boolean(item && item.trim()));
  return kept.length > 0 ? { type: "ul", items: kept } : null;
}

/** A section. Returns null when every block was dropped. */
export function section(
  heading: string,
  ...blocks: Maybe<LegalBlock>[]
): LegalSection | null {
  const kept = blocks.filter((block): block is LegalBlock => Boolean(block));
  return kept.length > 0 ? { heading, blocks: kept } : null;
}

export function doc(
  title: string,
  metaDescription: string,
  ...sections: Maybe<LegalSection>[]
): LegalDocument {
  return {
    title,
    metaDescription,
    sections: sections.filter((s): s is LegalSection => Boolean(s)),
  };
}

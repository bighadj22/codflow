/**
 * Store Pages Queries
 *
 * The single write chokepoint for `store_pages` / `store_page_translations` /
 * `store_legal_profile` (report-md/LEGAL_PAGES_PLAN.md). Every body that
 * reaches D1 — merchant-edited or template-seeded — passes through
 * `writeTranslation`: sanitised via `sanitizeRichText`, plain-text derived via
 * `toPlainText`. There is no second path to `body_html`.
 *
 * Mirrors the products.ts / landing-pages.ts split: this module raises no
 * typed errors (AppError lives in cod-server, not cod-shared) and returns
 * `null`/`false` for "not found" / "not available". Friendly 404/409s are the
 * cod-server endpoint wrapper's job — see
 * cod-server/src/endpoints/store-pages/queries.ts.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { storePages, storePageTranslations, storeLegalProfile, stores } from "../db/schema";
import type { AppDb } from "../db/client";
import { sanitizeRichText, toPlainText } from "../lib/rich-text";
import {
  LEGAL_PAGE_KINDS,
  LEGAL_PAGE_DEFAULTS,
  DEFAULT_PAGE_LOCALE,
  PAGE_LOCALES,
  TEMPLATE_VERSION,
} from "../legal/kinds";
import type { LegalPageKind, PageLocale, StorePageKind } from "../legal/kinds";
import { legalFactsFrom, renderLegalTemplate } from "../legal/render";

export type StorePageRow = typeof storePages.$inferSelect;
export type StorePageTranslationRow = typeof storePageTranslations.$inferSelect;
export type StoreLegalProfileRow = typeof storeLegalProfile.$inferSelect;

export interface StorePageSummary {
  id: string;
  kind: StorePageKind;
  slug: string;
  status: "published" | "draft";
  showInFooter: boolean;
  position: number;
  templateVersion: number | null;
  createdAt: string;
  updatedAt: string;
  /** One entry per locale that has ever been saved for this page. */
  translations: Array<{
    locale: PageLocale;
    title: string;
    source: "template" | "merchant";
    updatedAt: string;
  }>;
}

export interface StorePageDetail extends StorePageSummary {
  bodies: Record<PageLocale, StorePageTranslationRow | undefined>;
}

/** What the storefront needs to render one page in one language. */
export interface ResolvedStorePage {
  id: string;
  kind: StorePageKind;
  slug: string;
  /** The locale actually served — may differ from the one requested (fallback). */
  locale: PageLocale;
  title: string;
  bodyHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
  bodyPlain: string;
}

/** What the footer (and the checkout consent line) need for every page — one row per link. */
export interface FooterPageEntry {
  id: string;
  kind: StorePageKind;
  slug: string;
  title: string;
  position: number;
}

export interface SaveTranslationInput {
  title: string;
  bodyHtml: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CreateCustomPageInput {
  slug: string;
  locale: PageLocale;
  title: string;
  bodyHtml: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  showInFooter?: boolean;
  position?: number;
}

export interface UpdateStorePageMetaInput {
  slug?: string;
  status?: "published" | "draft";
  showInFooter?: boolean;
  position?: number;
}

export interface UpsertLegalProfileInput {
  legalName?: string | null;
  rcNumber?: string | null;
  nif?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  returnWindowDays?: number;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
}

// ─── The write chokepoint ─────────────────────────────────────────────────────

/**
 * Sanitise, derive plain text, and upsert one page's one locale.
 *
 * Every write to `store_page_translations` — a merchant edit, a template
 * seed, or a "reset to template" — goes through this function. It is the only
 * place `body_html` is assigned, which is what makes "the storefront can trust
 * every stored body" true without every caller having to remember why.
 *
 * `source` is a parameter rather than always `"merchant"` because seeding and
 * reset legitimately write template-sourced content — but they still sanitise,
 * because a template is proven safe by `legal/templates.sanitize.test.ts`
 * rather than trusted on the strength of where it came from.
 */
async function writeTranslation(
  db: AppDb,
  pageId: string,
  locale: PageLocale,
  input: SaveTranslationInput,
  source: "template" | "merchant",
  now: string,
): Promise<StorePageTranslationRow> {
  const bodyHtml = (await sanitizeRichText(input.bodyHtml)).html;
  const bodyPlain = await toPlainText(bodyHtml);

  const row: StorePageTranslationRow = {
    pageId,
    locale,
    title: input.title,
    bodyHtml,
    bodyPlain,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    source,
    updatedAt: now,
  };

  await db
    .insert(storePageTranslations)
    .values(row)
    .onConflictDoUpdate({
      target: [storePageTranslations.pageId, storePageTranslations.locale],
      set: {
        title: row.title,
        bodyHtml: row.bodyHtml,
        bodyPlain: row.bodyPlain,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
        source: row.source,
        updatedAt: row.updatedAt,
      },
    });

  return row;
}

/**
 * A merchant edit. Always flips `source` to `"merchant"` — the one-way switch
 * the dashboard reads to tell a still-default page from a reviewed one
 * (plan D8). There is no path back to `"template"` except an explicit reset.
 */
export async function saveTranslation(
  db: AppDb,
  pageId: string,
  locale: PageLocale,
  input: SaveTranslationInput,
): Promise<StorePageTranslationRow> {
  return writeTranslation(db, pageId, locale, input, "merchant", new Date().toISOString());
}

/**
 * Re-applies the current template to one locale of one legal page, discarding
 * whatever the merchant had written there. Bumps the page's `templateVersion`
 * to the current constant — the page-level marker of which revision's prose
 * it carries, independent of any one locale's `source` flag.
 *
 * Returns null when the page is not a legal kind (a custom page has no
 * template to reset to) or the store row cannot be found.
 */
export async function resetTranslationToTemplate(
  db: AppDb,
  storeId: string,
  pageId: string,
  locale: PageLocale,
): Promise<StorePageTranslationRow | null> {
  const page = await db
    .select()
    .from(storePages)
    .where(and(eq(storePages.id, pageId), eq(storePages.storeId, storeId)))
    .get();
  if (!page || !isLegalKind(page.kind)) return null;

  const store = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, storeId)).get();
  if (!store) return null;

  const profile = await getLegalProfile(db, storeId);
  const facts = legalFactsFrom(store, profile ?? null);
  const rendered = renderLegalTemplate(page.kind, locale, facts);
  const now = new Date().toISOString();

  const translation = await writeTranslation(
    db,
    pageId,
    locale,
    { title: rendered.title, bodyHtml: rendered.bodyHtml, metaDescription: rendered.metaDescription },
    "template",
    now,
  );

  await db
    .update(storePages)
    .set({ templateVersion: rendered.templateVersion, updatedAt: now })
    .where(eq(storePages.id, pageId));

  return translation;
}

function isLegalKind(kind: StorePageKind): kind is LegalPageKind {
  return (LEGAL_PAGE_KINDS as readonly string[]).includes(kind);
}

// ─── Seeding ───────────────────────────────────────────────────────────────────

/**
 * Idempotent per store: creates whichever of the four legal kinds this store
 * does not already have, seeding all three locales for each so switching
 * `stores.lang` never reveals a blank page. Skips a kind entirely when a page
 * of that kind already exists, so calling this twice never duplicates pages.
 *
 * Called at store provisioning (every new store), from a dashboard button for
 * stores that predate this feature, and by the Pages screen's empty state —
 * never lazily on a read, so a page's existence is never a side effect of
 * someone merely looking.
 */
export async function seedStorePages(
  db: AppDb,
  storeId: string,
): Promise<{ created: LegalPageKind[] }> {
  const store = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, storeId)).get();
  if (!store) return { created: [] };

  const existingKinds = new Set(
    (
      await db
        .select({ kind: storePages.kind })
        .from(storePages)
        .where(eq(storePages.storeId, storeId))
    ).map((r) => r.kind),
  );

  const missing = LEGAL_PAGE_KINDS.filter((kind) => !existingKinds.has(kind));
  if (missing.length === 0) return { created: [] };

  const profile = await getLegalProfile(db, storeId);
  const facts = legalFactsFrom(store, profile ?? null);
  const now = new Date().toISOString();

  for (const kind of missing) {
    const defaults = LEGAL_PAGE_DEFAULTS[kind];
    const slug = await uniqueSlug(db, storeId, defaults.slug);
    const pageId = crypto.randomUUID();

    await db.insert(storePages).values({
      id: pageId,
      storeId,
      kind,
      slug,
      status: "published",
      showInFooter: true,
      position: defaults.position,
      templateVersion: TEMPLATE_VERSION,
      createdAt: now,
      updatedAt: now,
    });

    for (const locale of PAGE_LOCALES) {
      const rendered = renderLegalTemplate(kind, locale, facts);
      await writeTranslation(
        db,
        pageId,
        locale,
        { title: rendered.title, bodyHtml: rendered.bodyHtml, metaDescription: rendered.metaDescription },
        "template",
        now,
      );
    }
  }

  return { created: missing };
}

/** Appends `-2`, `-3`, … until the slug is free for this store. */
async function uniqueSlug(db: AppDb, storeId: string, base: string): Promise<string> {
  if (!(await slugExists(db, storeId, base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await slugExists(db, storeId, candidate))) return candidate;
  }
  // Unreachable in practice — 1000 collisions on one store's slugs — but a
  // deterministic fallback beats an infinite loop if it ever is.
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function slugExists(
  db: AppDb,
  storeId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const row = await db
    .select({ id: storePages.id })
    .from(storePages)
    .where(and(eq(storePages.storeId, storeId), eq(storePages.slug, slug)))
    .get();
  return row !== undefined && row.id !== excludeId;
}

// ─── Reads — dashboard ─────────────────────────────────────────────────────────

/** Every page for the merchant's Pages list, ordered the way the footer would show them. */
export async function listStorePages(db: AppDb, storeId: string): Promise<StorePageSummary[]> {
  const pages = await db
    .select()
    .from(storePages)
    .where(eq(storePages.storeId, storeId))
    .orderBy(asc(storePages.position));
  if (pages.length === 0) return [];

  const translations = await db
    .select()
    .from(storePageTranslations)
    .where(
      inArray(
        storePageTranslations.pageId,
        pages.map((p) => p.id),
      ),
    );

  const byPage = groupTranslationsByPage(translations);
  return pages.map((page) => summarise(page, byPage.get(page.id) ?? []));
}

export async function getStorePageById(
  db: AppDb,
  storeId: string,
  id: string,
): Promise<StorePageDetail | null> {
  const page = await db
    .select()
    .from(storePages)
    .where(and(eq(storePages.id, id), eq(storePages.storeId, storeId)))
    .get();
  if (!page) return null;

  const translations = await db
    .select()
    .from(storePageTranslations)
    .where(eq(storePageTranslations.pageId, id));

  const bodies = Object.fromEntries(PAGE_LOCALES.map((l) => [l, undefined])) as StorePageDetail["bodies"];
  for (const t of translations) bodies[t.locale] = t;

  return { ...summarise(page, translations), bodies };
}

function groupTranslationsByPage(
  translations: StorePageTranslationRow[],
): Map<string, StorePageTranslationRow[]> {
  const map = new Map<string, StorePageTranslationRow[]>();
  for (const t of translations) {
    const list = map.get(t.pageId);
    if (list) list.push(t);
    else map.set(t.pageId, [t]);
  }
  return map;
}

function summarise(page: StorePageRow, translations: StorePageTranslationRow[]): StorePageSummary {
  return {
    id: page.id,
    kind: page.kind as StorePageKind,
    slug: page.slug,
    status: page.status as "published" | "draft",
    showInFooter: page.showInFooter,
    position: page.position,
    templateVersion: page.templateVersion,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    translations: translations
      .map((t) => ({
        locale: t.locale as PageLocale,
        title: t.title,
        source: t.source as "template" | "merchant",
        updatedAt: t.updatedAt,
      }))
      .sort((a, b) => PAGE_LOCALES.indexOf(a.locale) - PAGE_LOCALES.indexOf(b.locale)),
  };
}

// ─── Reads — storefront ────────────────────────────────────────────────────────

/**
 * The published page in the store's language, or the closest usable
 * substitute — never a placeholder, never a mix of two locales in one body.
 *
 * Resolution order: the requested locale, then `DEFAULT_PAGE_LOCALE`, then
 * whichever locale the page happens to have, in `PAGE_LOCALES` order. A draft
 * page or an unknown slug resolves to null — the caller 404s (theme01 plan
 * §9 — never a soft 200 with empty content).
 */
export async function resolvePublishedPage(
  db: AppDb,
  storeId: string,
  slug: string,
  locale: PageLocale,
): Promise<ResolvedStorePage | null> {
  const page = await db
    .select()
    .from(storePages)
    .where(and(eq(storePages.storeId, storeId), eq(storePages.slug, slug)))
    .get();
  if (!page || page.status !== "published") return null;

  const translations = await db
    .select()
    .from(storePageTranslations)
    .where(eq(storePageTranslations.pageId, page.id));
  if (translations.length === 0) return null;

  const byLocale = new Map(translations.map((t) => [t.locale as PageLocale, t]));
  const resolved =
    byLocale.get(locale) ??
    byLocale.get(DEFAULT_PAGE_LOCALE) ??
    translations.find((t) => byLocale.get(t.locale as PageLocale)) ??
    translations[0];
  if (!resolved) return null;

  return {
    id: page.id,
    kind: page.kind as StorePageKind,
    slug: page.slug,
    locale: resolved.locale as PageLocale,
    title: resolved.title,
    bodyHtml: resolved.bodyHtml,
    metaTitle: resolved.metaTitle,
    metaDescription: resolved.metaDescription,
    bodyPlain: resolved.bodyPlain,
  };
}

/**
 * The footer's (and checkout consent line's) link list: published pages that
 * opt into the footer, titled in the store's own language, ordered the way
 * they should display.
 *
 * A page missing a translation in `locale` is left out rather than falling
 * back to another language — every legal page always has all three (seeded
 * together), so this only ever excludes a custom page a merchant created
 * without yet adding a title in their store's language. Silent omission over
 * an N+1 fallback query: `/store/config` runs on every page view.
 */
export async function getFooterPages(
  db: AppDb,
  storeId: string,
  locale: PageLocale,
): Promise<FooterPageEntry[]> {
  const rows = await db
    .select({
      id: storePages.id,
      kind: storePages.kind,
      slug: storePages.slug,
      position: storePages.position,
      title: storePageTranslations.title,
    })
    .from(storePages)
    .innerJoin(
      storePageTranslations,
      and(eq(storePageTranslations.pageId, storePages.id), eq(storePageTranslations.locale, locale)),
    )
    .where(
      and(
        eq(storePages.storeId, storeId),
        eq(storePages.status, "published"),
        eq(storePages.showInFooter, true),
      ),
    )
    .orderBy(asc(storePages.position));

  return rows.map((r) => ({ ...r, kind: r.kind as StorePageKind }));
}

// ─── Custom pages ──────────────────────────────────────────────────────────────

export async function createCustomPage(
  db: AppDb,
  storeId: string,
  input: CreateCustomPageInput,
): Promise<{ id: string; slug: string }> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(storePages).values({
    id,
    storeId,
    kind: "custom",
    slug: input.slug,
    status: "draft",
    showInFooter: input.showInFooter ?? false,
    position: input.position ?? 0,
    templateVersion: null,
    createdAt: now,
    updatedAt: now,
  });

  await writeTranslation(
    db,
    id,
    input.locale,
    { title: input.title, bodyHtml: input.bodyHtml, metaTitle: input.metaTitle, metaDescription: input.metaDescription },
    "merchant",
    now,
  );

  return { id, slug: input.slug };
}

export async function updateStorePageMeta(
  db: AppDb,
  storeId: string,
  id: string,
  input: UpdateStorePageMetaInput,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(storePages)
    .set({
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.showInFooter !== undefined && { showInFooter: input.showInFooter }),
      ...(input.position !== undefined && { position: input.position }),
      updatedAt: now,
    })
    .where(and(eq(storePages.id, id), eq(storePages.storeId, storeId)));
}

/** Unconditional. The "custom kind only" guard is a server-layer concern (mirrors landing-pages' delete-with-orders split). */
export async function deleteStorePage(db: AppDb, storeId: string, id: string): Promise<void> {
  await db.delete(storePages).where(and(eq(storePages.id, id), eq(storePages.storeId, storeId)));
}

// ─── Legal profile ──────────────────────────────────────────────────────────────

export async function getLegalProfile(
  db: AppDb,
  storeId: string,
): Promise<StoreLegalProfileRow | undefined> {
  return db.select().from(storeLegalProfile).where(eq(storeLegalProfile.storeId, storeId)).get();
}

/** The subset `/store/config` may expose to the storefront — no RC/NIF. */
export interface PublicLegalContact {
  contactEmail: string | null;
  contactPhone: string | null;
  deliveryMinDays: number;
  deliveryMaxDays: number;
}

export async function getPublicLegalContact(
  db: AppDb,
  storeId: string,
): Promise<PublicLegalContact | null> {
  const row = await db
    .select({
      contactEmail: storeLegalProfile.contactEmail,
      contactPhone: storeLegalProfile.contactPhone,
      deliveryMinDays: storeLegalProfile.deliveryMinDays,
      deliveryMaxDays: storeLegalProfile.deliveryMaxDays,
    })
    .from(storeLegalProfile)
    .where(eq(storeLegalProfile.storeId, storeId))
    .get();
  return row ?? null;
}

export async function upsertLegalProfile(
  db: AppDb,
  storeId: string,
  input: UpsertLegalProfileInput,
): Promise<StoreLegalProfileRow> {
  const now = new Date().toISOString();
  const row: StoreLegalProfileRow = {
    storeId,
    legalName: input.legalName ?? null,
    rcNumber: input.rcNumber ?? null,
    nif: input.nif ?? null,
    address: input.address ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    returnWindowDays: input.returnWindowDays ?? 0,
    deliveryMinDays: input.deliveryMinDays ?? 2,
    deliveryMaxDays: input.deliveryMaxDays ?? 7,
    updatedAt: now,
  };

  await db
    .insert(storeLegalProfile)
    .values(row)
    .onConflictDoUpdate({
      target: storeLegalProfile.storeId,
      set: {
        legalName: row.legalName,
        rcNumber: row.rcNumber,
        nif: row.nif,
        address: row.address,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        returnWindowDays: row.returnWindowDays,
        deliveryMinDays: row.deliveryMinDays,
        deliveryMaxDays: row.deliveryMaxDays,
        updatedAt: row.updatedAt,
      },
    });

  return row;
}

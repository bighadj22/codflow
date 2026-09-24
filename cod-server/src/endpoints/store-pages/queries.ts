/**
 * Typed-error wrapper around cod-shared/queries/store-pages — the same split
 * as landing-pages/queries.ts: raw D1 operations stay in cod-shared (which
 * cannot import AppError — that class lives here, in cod-server), and this
 * file turns "not found" / a raw constraint crash into the friendly 404/409/422
 * the API contract promises.
 *
 * Single-tenant: "the store" is resolved once per request by the handler
 * (mirrors stores/handlers.ts's `getStore(db)`), and its id is threaded
 * through every call here as an explicit parameter — this module never
 * resolves it itself, so every function stays testable with any storeId.
 */
import type { AppDb } from "@/db";
import { NotFoundError, ConflictError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import * as shared from "../../../../cod-shared/queries/store-pages";
import type { PageLocale, StorePageKind } from "../../../../cod-shared/legal/kinds";

export * from "../../../../cod-shared/queries/store-pages";

type CreateCustomPageData = Parameters<typeof shared.createCustomPage>[2];
type UpdateStorePageMetaData = Parameters<typeof shared.updateStorePageMeta>[3];
type SaveTranslationData = Parameters<typeof shared.saveTranslation>[3];

function isSlugUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed:.*store_pages\.slug/i.test(err.message);
}

function conflict(slug: string): ConflictError {
  return new ConflictError(
    `Slug "${slug}" is already used by another page`,
    ERROR_CODES.DUPLICATE_ENTITY,
    { slug },
  );
}

export async function getStorePageOrThrow(db: AppDb, storeId: string, id: string) {
  const page = await shared.getStorePageById(db, storeId, id);
  if (!page) throw new NotFoundError("Store Page", id);
  return page;
}

export async function createCustomPage(
  db: AppDb,
  storeId: string,
  data: CreateCustomPageData,
) {
  if (await shared.slugExists(db, storeId, data.slug)) throw conflict(data.slug);

  try {
    const { id } = await shared.createCustomPage(db, storeId, data);
    return getStorePageOrThrow(db, storeId, id);
  } catch (err) {
    // Race: a concurrent writer took the slug between the check and the insert.
    if (isSlugUniqueViolation(err)) throw conflict(data.slug);
    throw err;
  }
}

export async function updateStorePageMeta(
  db: AppDb,
  storeId: string,
  id: string,
  data: UpdateStorePageMetaData,
) {
  await getStorePageOrThrow(db, storeId, id);

  if (data.slug && (await shared.slugExists(db, storeId, data.slug, id))) {
    throw conflict(data.slug);
  }

  try {
    await shared.updateStorePageMeta(db, storeId, id, data);
  } catch (err) {
    if (isSlugUniqueViolation(err)) throw conflict(data.slug!);
    throw err;
  }
  return getStorePageOrThrow(db, storeId, id);
}

/**
 * A legal page (terms/privacy/refund/shipping) is exactly the artefact Meta
 * looks for — deleting it re-enters the rejection loop with no obvious way
 * back, so it can be unpublished but never deleted. `seed-defaults` is the
 * visible recovery path if one is ever removed by direct DB access.
 */
export async function deleteStorePage(db: AppDb, storeId: string, id: string) {
  const page = await getStorePageOrThrow(db, storeId, id);
  if (page.kind !== "custom") {
    throw new BusinessLogicError(
      `"${page.kind}" is a legal page and cannot be deleted — unpublish it instead`,
      ERROR_CODES.STORE_PAGE_CANNOT_DELETE_LEGAL,
      { id, kind: page.kind },
    );
  }
  await shared.deleteStorePage(db, storeId, id);
}

export async function saveTranslation(
  db: AppDb,
  storeId: string,
  pageId: string,
  locale: PageLocale,
  data: SaveTranslationData,
) {
  await getStorePageOrThrow(db, storeId, pageId);
  return shared.saveTranslation(db, pageId, locale, data);
}

export async function resetTranslationToTemplate(
  db: AppDb,
  storeId: string,
  pageId: string,
  locale: PageLocale,
) {
  const page = await getStorePageOrThrow(db, storeId, pageId);
  if (page.kind === "custom") {
    throw new BusinessLogicError(
      "A custom page has no template to reset to",
      ERROR_CODES.STORE_PAGE_NOT_LEGAL,
      { id: pageId },
    );
  }
  const result = await shared.resetTranslationToTemplate(db, storeId, pageId, locale);
  if (!result) throw new NotFoundError("Store", storeId);
  return result;
}

export type { StorePageKind };

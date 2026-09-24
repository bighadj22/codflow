import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { getStore } from "../../../../cod-shared/queries/stores";
import { getLegalProfile, upsertLegalProfile } from "../../../../cod-shared/queries/store-pages";
import { NotFoundError, ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { logActivity, ACTIONS } from "@/lib/activity";
import { isPageLocale } from "../../../../cod-shared/legal/kinds";
import type { PageLocale } from "../../../../cod-shared/legal/kinds";
import {
  createCustomPageSchema,
  updateStorePageMetaSchema,
  saveTranslationSchema,
  upsertLegalProfileSchema,
} from "./validation";

/**
 * Single-tenant: resolves "the" store once per request. Every store-pages
 * handler starts here — mirrors stores/handlers.ts's own `getStore(db)` call.
 */
async function requireStore(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await getStore(db);
  if (!store) throw new NotFoundError("Store");
  return { db, store };
}

function requireLocaleParam(c: Context<AppContext>): PageLocale {
  const locale = c.req.param("locale")!;
  if (!isPageLocale(locale)) {
    throw new ValidationError(
      `Unsupported locale "${locale}" — must be ar, en, or fr`,
      ERROR_CODES.VALIDATION_FAILED,
      { locale },
    );
  }
  return locale;
}

export async function listStorePages(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const data = await queries.listStorePages(db, store.id);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function getStorePage(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const id = c.req.param("id")!;
  const data = await queries.getStorePageOrThrow(db, store.id, id);
  return c.json({ success: true, data }, 200);
}

export async function createCustomPage(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const body: any = (c.req as any).valid?.("json");
  const data = body ?? createCustomPageSchema.parse(await c.req.json());

  const result = await queries.createCustomPage(db, store.id, data);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.STORE_PAGE_CREATED, {
    type: "store_page", id: result.id, label: data.title,
  }, { slug: data.slug, kind: "custom" });

  return c.json({ success: true, data: result }, 201);
}

export async function updateStorePage(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const id = c.req.param("id")!;
  const body: any = (c.req as any).valid?.("json");
  const data = body ?? updateStorePageMetaSchema.parse(await c.req.json());

  const result = await queries.updateStorePageMeta(db, store.id, id, data);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.STORE_PAGE_UPDATED, {
    type: "store_page", id, label: result.translations[0]?.title ?? id,
  }, { fields: Object.keys(data) });

  return c.json({ success: true, data: result }, 200);
}

export async function deleteStorePage(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const id = c.req.param("id")!;

  await queries.deleteStorePage(db, store.id, id);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.STORE_PAGE_DELETED, { type: "store_page", id });

  return c.json({ success: true }, 200);
}

export async function saveTranslation(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const id = c.req.param("id")!;
  const locale = requireLocaleParam(c);
  const body: any = (c.req as any).valid?.("json");
  const data = body ?? saveTranslationSchema.parse(await c.req.json());

  const result = await queries.saveTranslation(db, store.id, id, locale, data);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.STORE_PAGE_TRANSLATION_SAVED, {
    type: "store_page", id, label: data.title,
  }, { locale });

  return c.json({ success: true, data: result }, 200);
}

export async function resetTranslation(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const id = c.req.param("id")!;
  const locale = requireLocaleParam(c);

  const result = await queries.resetTranslationToTemplate(db, store.id, id, locale);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.STORE_PAGE_TRANSLATION_RESET, {
    type: "store_page", id, label: result.title,
  }, { locale });

  return c.json({ success: true, data: result }, 200);
}

export async function seedDefaults(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const result = await queries.seedStorePages(db, store.id);

  if (result.created.length > 0) {
    const actor = c.get("user");
    await logActivity(db, actor, ACTIONS.STORE_PAGES_SEEDED, {
      type: "store_page", id: store.id,
    }, { created: result.created });
  }

  return c.json({ success: true, data: result }, 200);
}

export async function getLegalProfileHandler(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const profile = await getLegalProfile(db, store.id);
  return c.json({ success: true, data: profile ?? null }, 200);
}

export async function upsertLegalProfileHandler(c: Context<AppContext>) {
  const { db, store } = await requireStore(c);
  const body: any = (c.req as any).valid?.("json");
  const data = body ?? upsertLegalProfileSchema.parse(await c.req.json());

  const result = await upsertLegalProfile(db, store.id, data);

  const actor = c.get("user");
  await logActivity(db, actor, ACTIONS.STORE_LEGAL_PROFILE_UPDATED, {
    type: "store_page", id: store.id,
  }, { fields: Object.keys(data) });

  return c.json({ success: true, data: result }, 200);
}

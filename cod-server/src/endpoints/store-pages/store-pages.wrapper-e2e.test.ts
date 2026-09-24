/**
 * store-pages typed-error wrapper — real-D1 E2E (workerd).
 *
 * Bundles cod-server/src/endpoints/store-pages/queries.ts (the AppError
 * wrapper) into a Miniflare worker with a D1 binding, same pattern as
 * cod-server/src/endpoints/products/products.rich-text-e2e.test.ts. Proves
 * the wrapper's ADDED behaviour over cod-shared/queries/store-pages —
 * 404/409/422 mapping and the legal-kind delete guard — against the real
 * engine. Does NOT re-prove sanitisation depth: that is
 * cod-shared/queries/store-pages.e2e.test.ts's job (16 tests, already green).
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const here = resolve(__dirname);
const MIGRATIONS_DIR = resolve(here, "../../db/migrations");

const WORKER_SOURCE = `
import { getDb } from "@/db";
import * as q from "./queries";

export default {
  async fetch(request, env) {
    const db = getDb(env.DB);
    const { fn, args } = await request.json();
    try {
      const result = await q[fn](db, ...args);
      return Response.json({ ok: true, result });
    } catch (e) {
      return Response.json({
        ok: false,
        name: e && e.name,
        message: e && e.message,
        code: e && e.code,
        statusCode: e && e.statusCode,
        context: e && e.context,
      });
    }
  },
};
`;

const registry: Miniflare[] = [];
let mf: Miniflare;

interface WrapperError {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
}

async function call<T>(fn: string, ...args: unknown[]): Promise<T> {
  const worker = await mf.getWorker();
  const res = await worker.fetch("http://store-pages-wrapper-e2e.test/", {
    method: "POST",
    body: JSON.stringify({ fn, args }),
  });
  const data = (await res.json()) as { ok: boolean; result?: T } & Partial<WrapperError>;
  if (!data.ok) throw Object.assign(new Error(data.message), data);
  return data.result as T;
}

async function callErr(fn: string, ...args: unknown[]): Promise<WrapperError> {
  const worker = await mf.getWorker();
  const res = await worker.fetch("http://store-pages-wrapper-e2e.test/", {
    method: "POST",
    body: JSON.stringify({ fn, args }),
  });
  const data = (await res.json()) as { ok: boolean } & WrapperError;
  if (data.ok) throw new Error(`expected ${fn} to throw, it returned a result`);
  return data;
}

async function insertStore(id: string, name: string) {
  const d1 = await mf.getD1Database("DB");
  await d1
    .prepare(
      `INSERT INTO stores (id, name, theme_id, primary_color, accent_color, bg_color, font_family, lang, currency, currency_symbol, reviews_enabled, cart_enabled, cart_shipping_mode, status, created_at, updated_at)
       VALUES (?, ?, 'theme01', '#7c3aed', '#f59e0b', '#f8f8f8', 'Cairo, sans-serif', 'en', 'DZD', 'دج', 1, 0, 'highest', 'active', ?, ?)`,
    )
    .bind(id, name, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")
    .run();
}

beforeAll(async () => {
  const bundled = await build({
    stdin: {
      contents: WORKER_SOURCE,
      resolveDir: here,
      sourcefile: "worker.ts",
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    alias: { "@": resolve(here, "../..") },
    write: false,
    logLevel: "warning",
  });

  mf = new Miniflare({
    modules: [{ type: "ESModule", path: "index.mjs", contents: bundled.outputFiles[0].text }],
    d1Databases: { DB: "test-db" },
  });
  registry.push(mf);

  const d1 = await mf.getD1Database("DB");
  const prepared: D1PreparedStatement[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) prepared.push(d1.prepare(statement));
  }
  for (let i = 0; i < prepared.length; i += 50) {
    await d1.batch(prepared.slice(i, i + 50));
  }
}, 120_000);

afterAll(async () => {
  for (const instance of registry) await instance.dispose();
});

describe("getStorePageOrThrow", () => {
  it("throws NotFoundError (404) for an unknown id", async () => {
    await insertStore("w-store-1", "Store 1");
    const err = await callErr("getStorePageOrThrow", "w-store-1", "does-not-exist");
    expect(err.name).toBe("NotFoundError");
    expect(err.statusCode).toBe(404);
    expect(err.context).toMatchObject({ entity: "Store Page", id: "does-not-exist" });
  });

  it("throws NotFoundError for a page that belongs to a different store", async () => {
    await insertStore("w-store-2a", "Store 2a");
    await insertStore("w-store-2b", "Store 2b");
    const created = await call<{ id: string }>("createCustomPage", "w-store-2a", {
      slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>",
    });
    const err = await callErr("getStorePageOrThrow", "w-store-2b", created.id);
    expect(err.name).toBe("NotFoundError");
  });
});

describe("createCustomPage — 409 on slug conflict", () => {
  it("succeeds with a full detail payload", async () => {
    await insertStore("w-store-3", "Store 3");
    const created = await call<{ id: string; slug: string; bodies: Record<string, unknown> }>(
      "createCustomPage",
      "w-store-3",
      { slug: "about", locale: "en", title: "About", bodyHtml: "<p>We sell things.</p>" },
    );
    expect(created.slug).toBe("about");
    expect(created.bodies).toHaveProperty("en");
  });

  it("throws ConflictError (409, DUPLICATE_ENTITY) on a taken slug", async () => {
    await insertStore("w-store-4", "Store 4");
    await call("createCustomPage", "w-store-4", { slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>" });
    const err = await callErr("createCustomPage", "w-store-4", {
      slug: "faq", locale: "en", title: "FAQ 2", bodyHtml: "<p>y</p>",
    });
    expect(err.name).toBe("ConflictError");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("DUPLICATE_ENTITY");
    expect(err.context).toMatchObject({ slug: "faq" });
  });

  it("does not collide with the same slug used by a DIFFERENT store", async () => {
    await insertStore("w-store-5a", "Store 5a");
    await insertStore("w-store-5b", "Store 5b");
    await call("createCustomPage", "w-store-5a", { slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>" });
    const created = await call<{ slug: string }>("createCustomPage", "w-store-5b", {
      slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>",
    });
    expect(created.slug).toBe("faq");
  });
});

describe("updateStorePageMeta", () => {
  it("throws NotFoundError for a missing page", async () => {
    await insertStore("w-store-6", "Store 6");
    const err = await callErr("updateStorePageMeta", "w-store-6", "missing", { status: "draft" });
    expect(err.name).toBe("NotFoundError");
  });

  it("throws ConflictError when renamed to a slug already taken on the same store", async () => {
    await insertStore("w-store-7", "Store 7");
    await call("createCustomPage", "w-store-7", { slug: "terms-of-use", locale: "en", title: "T", bodyHtml: "<p>x</p>" });
    const second = await call<{ id: string }>("createCustomPage", "w-store-7", {
      slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>",
    });
    const err = await callErr("updateStorePageMeta", "w-store-7", second.id, { slug: "terms-of-use" });
    expect(err.name).toBe("ConflictError");
    expect(err.statusCode).toBe(409);
  });

  it("succeeds when the slug is unchanged (does not conflict with itself)", async () => {
    await insertStore("w-store-8", "Store 8");
    const created = await call<{ id: string }>("createCustomPage", "w-store-8", {
      slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>",
    });
    const updated = await call<{ status: string }>("updateStorePageMeta", "w-store-8", created.id, {
      slug: "faq", status: "published",
    });
    expect(updated.status).toBe("published");
  });
});

describe("deleteStorePage — the legal-kind guard", () => {
  it("throws BusinessLogicError (422, STORE_PAGE_CANNOT_DELETE_LEGAL) for a legal kind", async () => {
    await insertStore("w-store-9", "Store 9");
    await call("seedStorePages", "w-store-9");
    const pages = await call<Array<{ id: string; kind: string }>>("listStorePages", "w-store-9");
    const terms = pages.find((p) => p.kind === "terms")!;

    const err = await callErr("deleteStorePage", "w-store-9", terms.id);
    expect(err.name).toBe("BusinessLogicError");
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("STORE_PAGE_CANNOT_DELETE_LEGAL");
    expect(err.context).toMatchObject({ kind: "terms" });
  });

  it("succeeds for a custom page", async () => {
    await insertStore("w-store-10", "Store 10");
    const created = await call<{ id: string }>("createCustomPage", "w-store-10", {
      slug: "temp", locale: "en", title: "Temp", bodyHtml: "<p>x</p>",
    });
    await call("deleteStorePage", "w-store-10", created.id);
    const err = await callErr("getStorePageOrThrow", "w-store-10", created.id);
    expect(err.name).toBe("NotFoundError");
  });

  it("throws NotFoundError before the guard for a missing id", async () => {
    await insertStore("w-store-11", "Store 11");
    const err = await callErr("deleteStorePage", "w-store-11", "missing");
    expect(err.name).toBe("NotFoundError");
  });
});

describe("saveTranslation — must resolve to an existing page", () => {
  it("throws NotFoundError for a missing page id", async () => {
    await insertStore("w-store-12", "Store 12");
    const err = await callErr("saveTranslation", "w-store-12", "missing", "en", {
      title: "X", bodyHtml: "<p>x</p>",
    });
    expect(err.name).toBe("NotFoundError");
  });

  it("succeeds and flips source to merchant", async () => {
    await insertStore("w-store-13", "Store 13");
    const created = await call<{ id: string }>("createCustomPage", "w-store-13", {
      slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>",
    });
    const saved = await call<{ source: string }>("saveTranslation", "w-store-13", created.id, "en", {
      title: "FAQ v2", bodyHtml: "<p>updated</p>",
    });
    expect(saved.source).toBe("merchant");
  });
});

describe("resetTranslationToTemplate — the custom-page guard", () => {
  it("throws BusinessLogicError (422, STORE_PAGE_NOT_LEGAL) for a custom page", async () => {
    await insertStore("w-store-14", "Store 14");
    const created = await call<{ id: string }>("createCustomPage", "w-store-14", {
      slug: "faq", locale: "en", title: "FAQ", bodyHtml: "<p>x</p>",
    });
    const err = await callErr("resetTranslationToTemplate", "w-store-14", created.id, "en");
    expect(err.name).toBe("BusinessLogicError");
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("STORE_PAGE_NOT_LEGAL");
  });

  it("succeeds for a legal kind", async () => {
    await insertStore("w-store-15", "Store 15");
    await call("seedStorePages", "w-store-15");
    const pages = await call<Array<{ id: string; kind: string }>>("listStorePages", "w-store-15");
    const terms = pages.find((p) => p.kind === "terms")!;
    await call("saveTranslation", "w-store-15", terms.id, "en", { title: "Custom", bodyHtml: "<p>x</p>" });
    const reset = await call<{ source: string; title: string }>(
      "resetTranslationToTemplate", "w-store-15", terms.id, "en",
    );
    expect(reset.source).toBe("template");
    expect(reset.title).toBe("Terms and Conditions");
  });

  it("throws NotFoundError before the guard for a missing page", async () => {
    await insertStore("w-store-16", "Store 16");
    const err = await callErr("resetTranslationToTemplate", "w-store-16", "missing", "en");
    expect(err.name).toBe("NotFoundError");
  });
});

/**
 * Orphan-image sweep — real D1 + real R2 (Miniflare, workerd).
 *
 * The destructive risk in this feature is deleting an object that something
 * still references, so the whole test is built around that: every reference
 * source the database has is seeded, one object per source is placed in the
 * bucket, and the sweep must delete exactly one key — the unreferenced, old one.
 * `landing/` objects and fresh objects must survive untouched.
 *
 * The migrations loader mirrors `products/products.rich-text-e2e.test.ts`.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const here = resolve(__dirname);

const WORKER_SOURCE = `
import { drizzle } from "drizzle-orm/d1";
import { sweepOrphanImages } from "./sweep-orphan-images";
import { collectReferencedImageKeys } from "../../../cod-shared/queries/image-references";

export default {
  async fetch(request, env) {
    const { fn, args } = await request.json();
    try {
      if (fn === "sweep") {
        const options = { ...(args ?? {}) };
        if (options.now) options.now = new Date(options.now);
        return Response.json({ ok: true, result: await sweepOrphanImages(env, options) });
      }
      if (fn === "referenced") {
        const keys = await collectReferencedImageKeys(drizzle(env.DB));
        return Response.json({ ok: true, result: [...keys] });
      }
      return Response.json({ ok: false, error: "unknown fn " + fn }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: String((e && e.stack) || e) }, { status: 500 });
    }
  },
};
`;

/** Every object is uploaded "now", so a future clock makes them all old enough. */
const FUTURE = "2027-06-01T00:00:00.000Z";

const hex = (char: string) => char.repeat(32);
const KEYS = {
  orphan: `products/${hex("0")}.jpg`,
  galleryKey: `products/${hex("1")}.jpg`,
  galleryUrl: `products/${hex("2")}.jpg`,
  described: `products/${hex("3")}.jpg`,
  category: `products/${hex("4")}.jpg`,
  landing: `landing/${hex("9")}.jpg`,
};
const MANAGED_KEYS = [
  KEYS.orphan,
  KEYS.galleryKey,
  KEYS.galleryUrl,
  KEYS.described,
  KEYS.category,
];
const ORPHAN_BODY = "orphan-object-body";

const registry: Miniflare[] = [];
let mf: Miniflare;
let d1: Awaited<ReturnType<Miniflare["getD1Database"]>>;
let bucket: Awaited<ReturnType<Miniflare["getR2Bucket"]>>;

async function call<T>(fn: string, args?: unknown): Promise<T> {
  const worker = await mf.getWorker();
  const res = await worker.fetch("http://orphan-sweep.test/", {
    method: "POST",
    body: JSON.stringify({ fn, args }),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; error?: string };
  if (!data.ok) throw new Error(`workerd call ${fn} failed: ${data.error}`);
  return data.result as T;
}

interface Report {
  dryRun: boolean;
  prefix: string;
  olderThanDays: number;
  scanned: number;
  referenced: number;
  orphans: { key: string; size: number; uploaded: string }[];
  orphanBytes: number;
  deleted: number;
}

const publicUrl = (key: string) => `https://media.example.com/${key}`;

async function seed() {
  await d1.prepare("DELETE FROM product_images").run();
  await d1.prepare("DELETE FROM product_categories").run();
  await d1.prepare("DELETE FROM products").run();

  // 1. A description whose ONLY reference to `described` is inside the HTML.
  await d1
    .prepare(
      `INSERT INTO products (id, name, description, description_format, handle, currency, price, has_variants, inventory, track_inventory, low_stock_threshold, visibility, status, show_in_store, store_featured, deleted_at, created_at, updated_at)
       VALUES ('p1', 'Described', ?, 'html', 'p1', 'DZD', 1000, 0, 5, 1, 5, 1, 'ACTIVE', 1, 0, NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    )
    .bind(`<p>look</p><img src="${publicUrl(KEYS.described)}" alt="a">`)
    .run();

  // 2. Gallery record that only knows its key.
  await d1
    .prepare(
      `INSERT INTO product_images (id, product_id, src, r2_key, type, position, created_at, updated_at)
       VALUES ('i1', 'p1', ?, ?, 1, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    )
    .bind(publicUrl(KEYS.galleryKey), KEYS.galleryKey)
    .run();

  // 3. Gallery record saved without a key — only its URL names the object.
  await d1
    .prepare(
      `INSERT INTO product_images (id, product_id, src, r2_key, type, position, created_at, updated_at)
       VALUES ('i2', 'p1', ?, NULL, 1, 2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    )
    .bind(publicUrl(KEYS.galleryUrl))
    .run();

  // 4. Category image — uploaded into the same products/ namespace.
  await d1
    .prepare(
      `INSERT INTO product_categories (id, name, slug, image_url, position, created_at, updated_at)
       VALUES ('c1', 'Cat', 'cat', ?, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    )
    .bind(publicUrl(KEYS.category))
    .run();

  for (const key of MANAGED_KEYS) {
    await bucket.put(key, key === KEYS.orphan ? ORPHAN_BODY : `body-of-${key}`);
  }
  await bucket.put(KEYS.landing, "landing-body");
}

async function listKeys(prefix = ""): Promise<string[]> {
  const listed = await bucket.list({ prefix });
  return listed.objects.map((o) => o.key).sort();
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
    alias: { "@": resolve(here, "..") },
    write: false,
    logLevel: "warning",
  });

  mf = new Miniflare({
    modules: [{ type: "ESModule", path: "index.mjs", contents: bundled.outputFiles[0].text }],
    d1Databases: { DB: "test-db" },
    r2Buckets: { IMAGES: "test-bucket" },
  });
  registry.push(mf);

  d1 = await mf.getD1Database("DB");
  bucket = await mf.getR2Bucket("IMAGES");

  const dir = resolve(here, "../db/migrations");
  const preparedStatements: D1PreparedStatement[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) preparedStatements.push(d1.prepare(statement));
  }
  for (let i = 0; i < preparedStatements.length; i += 50) {
    await d1.batch(preparedStatements.slice(i, i + 50));
  }
}, 120_000);

afterAll(async () => {
  for (const instance of registry) await instance.dispose();
});

beforeEach(async () => {
  for (const key of await listKeys()) await bucket.delete(key);
  await seed();
});

describe("collectReferencedImageKeys", () => {
  it("finds all four reference sources, bare or inside a URL", async () => {
    const referenced = await call<string[]>("referenced");
    expect(referenced.sort()).toEqual(
      [KEYS.galleryKey, KEYS.galleryUrl, KEYS.described, KEYS.category].sort()
    );
  });

  it("does not invent references for the unreferenced objects", async () => {
    const referenced = await call<string[]>("referenced");
    expect(referenced).not.toContain(KEYS.orphan);
    expect(referenced).not.toContain(KEYS.landing);
  });
});

describe("sweepOrphanImages", () => {
  it("reports the orphan and deletes nothing on a dry run", async () => {
    const report = await call<Report>("sweep", { now: FUTURE });

    expect(report.dryRun).toBe(true);
    expect(report.deleted).toBe(0);
    expect(report.orphans.map((o) => o.key)).toEqual([KEYS.orphan]);
    expect(report.orphanBytes).toBe(ORPHAN_BODY.length);
  });

  it("counts only the managed namespace, and every referenced key", async () => {
    const report = await call<Report>("sweep", { now: FUTURE });

    expect(report.prefix).toBe("products/");
    expect(report.scanned).toBe(MANAGED_KEYS.length);
    expect(report.referenced).toBe(4);
  });

  it("deletes exactly the orphan when deletion is enabled", async () => {
    const report = await call<Report>("sweep", { dryRun: false, now: FUTURE });

    expect(report.deleted).toBe(1);
    expect(await listKeys()).not.toContain(KEYS.orphan);
  });

  it("never deletes an object that only a description references", async () => {
    await call<Report>("sweep", { dryRun: false, now: FUTURE });
    expect(await listKeys()).toContain(KEYS.described);
  });

  it("never deletes an object that only a category image references", async () => {
    await call<Report>("sweep", { dryRun: false, now: FUTURE });
    expect(await listKeys()).toContain(KEYS.category);
  });

  it("never deletes an object referenced by a gallery key or URL", async () => {
    await call<Report>("sweep", { dryRun: false, now: FUTURE });
    const remaining = await listKeys();
    expect(remaining).toContain(KEYS.galleryKey);
    expect(remaining).toContain(KEYS.galleryUrl);
  });

  it("never touches the landing/ namespace", async () => {
    await call<Report>("sweep", { dryRun: false, now: FUTURE });
    expect(await listKeys()).toContain(KEYS.landing);
  });

  it("keeps an unreferenced object inside the grace period", async () => {
    // Real clock: the seeded object was uploaded moments ago, so the one key
    // that is genuinely unreferenced is still too new to delete.
    const report = await call<Report>("sweep", { dryRun: false });

    expect(report.orphans).toEqual([]);
    expect(report.deleted).toBe(0);
    expect(await listKeys()).toContain(KEYS.orphan);
  });

  it("leaves every managed object in place when it deletes nothing", async () => {
    await call<Report>("sweep", { dryRun: false, now: FUTURE });
    const remaining = await listKeys("products/");
    expect(remaining.sort()).toEqual(MANAGED_KEYS.filter((k) => k !== KEYS.orphan).sort());
  });
});

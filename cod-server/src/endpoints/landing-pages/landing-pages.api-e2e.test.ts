/**
 * Landing Pages — Slice 2: management API on real D1 + real route stack.
 *
 * The real OpenAPIHono router + real error handler + real queries against
 * real migrations. Auth middleware is stubbed with an admin user (the
 * dashboard seam) — the RBAC middleware itself is covered by route tests.
 *
 * Covers: create (draft, slug default, 409 on taken slug, 404 on missing
 * product), update (slug change + 409), publish/unpublish/archive lifecycle,
 * delete guard (refused with orders, clean without), reorder validation,
 * stats math on real attributed orders, compare view.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import landingPagesRouter from "./routes";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";

let db: AppDb;
let rawD1: D1Database;
let app: OpenAPIHono<AppContext>;

/** R2 bucket stub — tracks deleted keys so shared-object guards are testable. */
const r2DeletedKeys: string[] = [];
const r2BucketStub = {
  delete: async (key: string) => {
    r2DeletedKeys.push(key);
  },
} as unknown as R2Bucket;

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });
  rawD1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  const prepared: D1PreparedStatement[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) prepared.push(rawD1.prepare(statement));
  }
  for (let i = 0; i < prepared.length; i += 50) {
    await rawD1.batch(prepared.slice(i, i + 50));
  }
  db = drizzle(rawD1 as unknown as D1Database, { schema }) as unknown as AppDb;

  app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: rawD1 as any, IMAGES: r2BucketStub } as any;
    c.set("user", {
      id: "admin_user_001",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      status: "active",
      apiKey: "cod_admin_key",
      scopes: ["*"],
    } as any);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/landing-pages", landingPagesRouter);

  registry.push(mf);
}, 120_000);

const registry: Miniflare[] = [];
afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

const NOW = () => new Date().toISOString();
let seq = 0;

async function seedProduct(): Promise<string> {
  const id = `prod-lpm-${++seq}`;
  await db.insert(schema.products).values({
    id, name: `LPM Product ${seq}`, handle: `lpm-product-${seq}`, price: 5000,
    hasVariants: false, inventory: 10, trackInventory: true, lowStockThreshold: 2,
    status: "ACTIVE", visibility: true, showInStore: true, storeFeatured: false,
    createdAt: NOW(), updatedAt: NOW(),
  });
  return id;
}

async function seedCustomer(): Promise<string> {
  const id = `cust-lpm-${++seq}`;
  await db.insert(schema.customers).values({
    id, name: "LPM Customer", phone: `0555${String(300000 + seq).slice(-6)}`,
    wilaya: "الجزائر", totalOrders: 0, totalSpent: 0, createdAt: NOW(),
  });
  return id;
}

async function createLp(body: Record<string, unknown>): Promise<Response> {
  return app.request("/api/landing-pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Slice 2 — landing pages management API (real D1 + real routes)", () => {
  it("creates a draft LP with an auto-generated slug and default spacing", async () => {
    const productId = await seedProduct();
    const res = await createLp({ name: "Zinc v1 — test", productId });
    expect(res.status).toBe(201);
    const body: any = (await res.json()) as any;
    expect(body.data).toMatchObject({
      name: "Zinc v1 — test",
      productId,
      status: "draft",
      imageGap: 0,
      sidePadding: 0,
      contentMaxWidth: 0,
      views: 0,
      publishedAt: null,
    });
    expect(body.data.slug).toMatch(/^lp-[a-z0-9]{8}$/);
    expect(body.data.product.name).toBe(`LPM Product ${seq}`);
    expect(body.data.images).toEqual([]);
    expect(body.data.stats).toMatchObject({ views: 0, orders: 0, revenue: 0 });
  });

  it("refuses creation for a missing product (404) — no orphan LP", async () => {
    const res = await createLp({ name: "Orphan", productId: "prod-does-not-exist" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).code).toBe("PRODUCT_NOT_FOUND");
  });

  it("slug collision returns a friendly 409, never a raw 500", async () => {
    const productId = await seedProduct();
    const slugBase = `my-lp-${crypto.randomUUID().slice(0, 6)}`;
    const first = await createLp({ name: "First", productId, slug: slugBase });
    expect(first.status).toBe(201);

    const dup = await createLp({ name: "Second", productId, slug: slugBase });
    expect(dup.status).toBe(409);
    const body: any = (await dup.json()) as any;
    expect(body.code).toBe("DUPLICATE_ENTITY");
    expect(body.context).toMatchObject({ slug: slugBase });
  });

  it("updates spacing + slug; renaming to a taken slug is a 409", async () => {
    const productId = await seedProduct();
    const rnd = crypto.randomUUID().slice(0, 6);
    const created = (await (await createLp({ name: "Original", productId, slug: `orig-${rnd}` })).json()) as any;
    const other = (await (await createLp({ name: "Other", productId, slug: `other-${rnd}` })).json()) as any;

    const ok = await app.request(`/api/landing-pages/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageGap: 12, name: "Renamed" }),
    });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as any).data).toMatchObject({
      imageGap: 12, name: "Renamed",
    });

    const clash = await app.request(`/api/landing-pages/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: `other-${rnd}` }),
    });
    expect(clash.status).toBe(409);
    expect(((await clash.json()) as any).context).toMatchObject({ slug: `other-${rnd}` });
  });

  it("publish → live; unpublish → draft; archive → archived", async () => {
    const productId = await seedProduct();
    const created = (await (await createLp({ name: "Lifecycle", productId })).json()) as any;
    const id = created.data.id;

    const pub = await app.request(`/api/landing-pages/${id}/publish`, { method: "POST" });
    expect(pub.status).toBe(200);
    const pubBody: any = (await pub.json()) as any;
    expect(pubBody.data).toMatchObject({ status: "published" });
    expect(pubBody.data.publishedAt).toBeTruthy();

    const unpub = await app.request(`/api/landing-pages/${id}/unpublish`, { method: "POST" });
    const unpubBody: any = (await unpub.json()) as any;
    expect(unpubBody.data).toMatchObject({ status: "draft" });
    expect(unpubBody.data.publishedAt).toBeTruthy(); // history preserved

    const arch = await app.request(`/api/landing-pages/${id}/archive`, { method: "POST" });
    expect(arch.status).toBe(200);
    const row = await db.select().from(schema.landingPages)
      .where(eq(schema.landingPages.id, id)).get();
    expect(row?.status).toBe("archived");
  });

  it("images: add → ordered stack; reorder; foreign/duplicate IDs rejected", async () => {
    const productId = await seedProduct();
    const created = (await (await createLp({ name: "Images LP", productId })).json()) as any;
    const id = created.data.id;

    const add1 = await app.request(`/api/landing-pages/${id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "landing/img-1.jpg", src: "https://m.example/img-1.jpg", altText: "الأول" }),
    });
    expect(add1.status).toBe(201);
    expect(((await add1.json()) as any).data).toHaveLength(1);

    await app.request(`/api/landing-pages/${id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "landing/img-2.jpg", src: "https://m.example/img-2.jpg" }),
    });
    await app.request(`/api/landing-pages/${id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "landing/img-3.jpg", src: "https://m.example/img-3.jpg" }),
    });

    const list = (await (await app.request(`/api/landing-pages/${id}/images`)).json()) as any;
    expect(list.data.map((i: any) => i.position)).toEqual([1, 2, 3]);
    const imgIds = list.data.map((i: any) => i.id);

    // Reorder 3,1,2
    const reorder = await app.request(`/api/landing-pages/${id}/images/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [imgIds[2], imgIds[0], imgIds[1]] }),
    });
    const reordered: any[] = ((await reorder.json()) as any).data;
    expect(reordered[0].src).toContain("img-3");
    expect(reordered.map((i: any) => i.position)).toEqual([1, 2, 3]);

    // Duplicate IDs rejected (ValidationError → 400, same taxonomy as products reorder)
    const dup = await app.request(`/api/landing-pages/${id}/images/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [imgIds[0], imgIds[0], imgIds[1]] }),
    });
    expect(dup.status).toBe(400);
    expect(((await dup.json()) as any).code).toBe("VALIDATION_FAILED");

    // Foreign ID rejected
    const foreign = await app.request(`/api/landing-pages/${id}/images/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [imgIds[0], imgIds[1], "img-not-ours"] }),
    });
    expect(foreign.status).toBe(400);
  });

  it("stats math: views + attributed orders + revenue join correctly", async () => {
    const productId = await seedProduct();
    const created = (await (await createLp({ name: "Stats LP", productId, slug: "stats-lp" })).json()) as any;
    const id = created.data.id;

    // Publish + 2 attributed orders (5000 each) + 1 unattributed order
    await app.request(`/api/landing-pages/${id}/publish`, { method: "POST" });
    for (const [n, cust] of [["a", await seedCustomer()], ["b", await seedCustomer()]] as const) {
      await db.insert(schema.orders).values({
        id: `ord-lpstats-${n}`, orderNumber: `ORD-LPSTAT-${n}`, customerId: cust,
        customerName: "Stats", phone: "0555000001", price: 5000,
        status: "new", deliveryMethod: "unassigned", deliveryType: "home",
        deliveryFee: 0, driverFee: 0, codAmount: 5000, landingPageId: id,
        createdAt: NOW(), updatedAt: NOW(),
      });
    }
    const cust3 = await seedCustomer();
    await db.insert(schema.orders).values({
      id: "ord-lpstats-x", orderNumber: "ORD-LPSTAT-X", customerId: cust3,
      customerName: "Other", phone: "0555000002", price: 9000,
      status: "new", deliveryMethod: "unassigned", deliveryType: "home",
      deliveryFee: 0, driverFee: 0, codAmount: 9000,
      createdAt: NOW(), updatedAt: NOW(),
    });

    // Bump views like the public endpoint will (atomic increment)
    await db.update(schema.landingPages)
      .set({ views: 100 })
      .where(eq(schema.landingPages.id, id));

    const detail = (await (await app.request(`/api/landing-pages/${id}`)).json()) as any;
    expect(detail.data.views).toBe(100);
    expect(detail.data.stats).toMatchObject({ views: 100, orders: 2, revenue: 10000 });
  });

  it("delete refused while orders exist (422 LANDING_PAGE_HAS_ORDERS); clean delete works", async () => {
    const productId = await seedProduct();
    const withOrders = (await (await createLp({ name: "Guarded", productId, slug: `guarded-${crypto.randomUUID().slice(0, 6)}` })).json()) as any;
    const cust = await seedCustomer();
    await db.insert(schema.orders).values({
      id: "ord-guard-1", orderNumber: "ORD-GUARD-1", customerId: cust,
      customerName: "Guard", phone: "0555000003", price: 5000,
      status: "new", deliveryMethod: "unassigned", deliveryType: "home",
      deliveryFee: 0, driverFee: 0, codAmount: 5000, landingPageId: withOrders.data.id,
      createdAt: NOW(), updatedAt: NOW(),
    });

    const refused = await app.request(`/api/landing-pages/${withOrders.data.id}`, { method: "DELETE" });
    expect(refused.status).toBe(422);
    const body: any = await refused.json();
    expect(body.code).toBe("LANDING_PAGE_HAS_ORDERS");
    expect(body.context).toMatchObject({ orderCount: 1 });

    // Clean LP deletes, images cascade
    const clean = (await (await createLp({ name: "Clean", productId, slug: `clean-${crypto.randomUUID().slice(0, 6)}` })).json()) as any;
    await app.request(`/api/landing-pages/${clean.data.id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "landing/clean-1.jpg", src: "https://m.example/clean-1.jpg" }),
    });
    const del = await app.request(`/api/landing-pages/${clean.data.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const images = await db.select().from(schema.landingPageImages)
      .where(eq(schema.landingPageImages.landingPageId, clean.data.id));
    expect(images).toHaveLength(0);
  });

  it("list + compare: filter by product returns its LPs with stats", async () => {
    const productId = await seedProduct();
    const rnd = crypto.randomUUID().slice(0, 6);
    const slugA = `cmp-a-${rnd}`;
    const slugB = `cmp-b-${rnd}`;
    const a = (await (await createLp({ name: "Creative A", productId, slug: slugA })).json()) as any;
    const b = (await (await createLp({ name: "Creative B", productId, slug: slugB })).json()) as any;
    await createLp({ name: "Other product LP", productId: await seedProduct(), slug: `cmp-x-${crypto.randomUUID().slice(0, 6)}` });

    const list = (await (await app.request(`/api/landing-pages?productId=${productId}`)).json()) as any;
    expect(list.data.map((d: any) => d.id).sort()).toEqual([a.data.id, b.data.id].sort());
    expect(list.data[0]).toMatchObject({ productName: expect.any(String), imageCount: expect.any(Number) });

    const compare = (await (await app.request(`/api/landing-pages/compare?productId=${productId}`)).json()) as any;
    expect(compare.data).toHaveLength(2);
    expect(compare.data.map((d: any) => d.slug).sort()).toEqual([slugA, slugB].sort());
  });

  it("list pagination: opt-in limit/offset; omitted → full list", async () => {
    const productId = await seedProduct();
    const rnd = crypto.randomUUID().slice(0, 6);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = (await (
        await createLp({ name: `Page ${i}`, productId, slug: `pg-${i}-${rnd}` })
      ).json()) as any;
      ids.push(res.data.id);
    }

    // No params → unbounded (dashboard contract).
    const full = (await (
      await app.request(`/api/landing-pages?productId=${productId}`)
    ).json()) as any;
    expect(full.data).toHaveLength(3);

    // limit=2 → exactly 2 rows of this product.
    const page1 = (await (
      await app.request(`/api/landing-pages?productId=${productId}&limit=2`)
    ).json()) as any;
    expect(page1.data).toHaveLength(2);
    expect(page1.count).toBe(2);
    page1.data.forEach((row: any) => expect(row.productId).toBe(productId));

    // limit=2&offset=2 → exactly 1 row.
    const page2 = (await (
      await app.request(`/api/landing-pages?productId=${productId}&limit=2&offset=2`)
    ).json()) as any;
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0].productId).toBe(productId);

    // Pages cover the full set without overlap.
    const paged = new Set([...page1.data, ...page2.data].map((d: any) => d.id));
    expect([...paged].sort()).toEqual([...ids].sort());

    // Out-of-range limit is a 400 validation error.
    const bad = await app.request(`/api/landing-pages?limit=500`);
    expect(bad.status).toBe(400);
  });

  it("getLandingPageById detail carries images + product + stats together (batched read)", async () => {
    const productId = await seedProduct();
    const rnd = crypto.randomUUID().slice(0, 6);
    const created = (await (
      await createLp({ name: "Detail page", productId, slug: `detail-${rnd}` })
    ).json()) as any;

    const detail = (await (
      await app.request(`/api/landing-pages/${created.data.id}`)
    ).json()) as any;
    expect(detail.data.id).toBe(created.data.id);
    expect(Array.isArray(detail.data.images)).toBe(true);
    expect(detail.data.product).toMatchObject({ id: productId, price: expect.any(Number) });
    expect(detail.data.stats).toMatchObject({
      views: expect.any(Number),
      orders: expect.any(Number),
      revenue: expect.any(Number),
    });
  });

  it("invalid slug format is a 400 validation error (not a 500)", async () => {
    const productId = await seedProduct();
    const res = await createLp({ name: "Bad slug", productId, slug: "Invalid Slug!" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).code).toBe("VALIDATION_FAILED");
  });
});

describe("publicUrl resolution — store domain wins, env falls back, relative last", () => {
  it("no domain, no fallback env → relative /lp/<slug>", async () => {
    const productId = await seedProduct();
    const res = await createLp({ name: "Relative URL", productId, slug: "url-relative-" + crypto.randomUUID().slice(0, 6) });
    const body: any = await res.json();
    expect(body.data.publicUrl).toBe(`/lp/${body.data.slug}`);
  });

  it("store domain set → https://<domain>/lp/<slug>", async () => {
    const productId = await seedProduct();
    await db.insert(schema.stores).values({
      id: "store-url-test", name: "URL Store", lang: "ar", currency: "DZD",
      currencySymbol: "دج", domain: "demo.codflow.store",
      createdAt: NOW(), updatedAt: NOW(),
    }).onConflictDoUpdate({
      target: schema.stores.id,
      set: { domain: "demo.codflow.store" },
    });

    const res = await createLp({ name: "Domain URL", productId, slug: "url-domain-" + crypto.randomUUID().slice(0, 6) });
    const body: any = await res.json();
    expect(body.data.publicUrl).toBe(`https://demo.codflow.store/lp/${body.data.slug}`);

    // list carries it too
    const list: any = await (await app.request("/api/landing-pages")).json();
    const mine = list.data.find((d: any) => d.id === body.data.id);
    expect(mine.publicUrl).toBe(`https://demo.codflow.store/lp/${mine.slug}`);

    // cleanup the domain so later tests aren't affected
    await db.update(schema.stores).set({ domain: null }).where(eq(schema.stores.id, "store-url-test"));
  });
});

describe("duplicate + shared R2-object guard", () => {
  it("duplicate: fresh draft, new slug, zeroed stats, images share R2 keys", async () => {
    const productId = await seedProduct();
    const created: any = await (await createLp({ name: "Original Creative", productId, slug: `dup-src-${crypto.randomUUID().slice(0, 6)}` })).json();
    const sourceId = created.data.id;

    // Two images on the source
    await app.request(`/api/landing-pages/${sourceId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `landing/dup-${crypto.randomUUID().slice(0, 6)}.jpg`, src: "https://m.example/dup-1.jpg" }),
    });
    await app.request(`/api/landing-pages/${sourceId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `landing/dup2-${crypto.randomUUID().slice(0, 6)}.jpg`, src: "https://m.example/dup-2.jpg" }),
    });
    // Views + attributed order on the source — must NOT copy
    await db.update(schema.landingPages).set({ views: 77 }).where(eq(schema.landingPages.id, sourceId));
    const cust = await seedCustomer();
    await db.insert(schema.orders).values({
      id: `ord-dup-${crypto.randomUUID().slice(0, 6)}`, orderNumber: `ORD-DUP-${crypto.randomUUID().slice(0, 6)}`,
      customerId: cust, customerName: "Dup", phone: "0555000009", price: 5000,
      status: "new", deliveryMethod: "unassigned", deliveryType: "home",
      deliveryFee: 0, driverFee: 0, codAmount: 5000, landingPageId: sourceId,
      createdAt: NOW(), updatedAt: NOW(),
    });

    const dupRes = await app.request(`/api/landing-pages/${sourceId}/duplicate`, { method: "POST" });
    expect(dupRes.status).toBe(201);
    const dup: any = await dupRes.json();
    expect(dup.data).toMatchObject({
      status: "draft",
      views: 0,
      name: "Original Creative (copy)",
      productId,
    });
    expect(dup.data.slug).toMatch(/^lp-[a-z0-9]{8}$/);
    expect(dup.data.slug).not.toBe("dup-src"); // never the source slug
    expect(dup.data.stats).toMatchObject({ views: 0, orders: 0, revenue: 0 });
    expect(dup.data.images).toHaveLength(2);

    // Images reference the SAME R2 keys (immutable objects shared)
    const sourceImages = await db.select().from(schema.landingPageImages)
      .where(eq(schema.landingPageImages.landingPageId, sourceId));
    const dupImages = dup.data.images as Array<{ r2Key: string }>;
    expect(dupImages.map((i) => i.r2Key).sort()).toEqual(sourceImages.map((i) => i.r2Key).sort());

    // Source stats untouched
    const srcDetail: any = await (await app.request(`/api/landing-pages/${sourceId}`)).json();
    expect(srcDetail.data.views).toBe(77);
    expect(srcDetail.data.stats.orders).toBe(1);
  });

  it("deleting an image on the ORIGINAL leaves the shared R2 object while the duplicate references it", async () => {
    const productId = await seedProduct();
    const created: any = await (await createLp({ name: "Shared Key Original", productId, slug: `shared-${crypto.randomUUID().slice(0, 6)}` })).json();
    const sourceId = created.data.id;
    const sharedKey = `landing/shared-${crypto.randomUUID().slice(0, 6)}.jpg`;

    await app.request(`/api/landing-pages/${sourceId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: sharedKey, src: "https://m.example/shared.jpg" }),
    });
    const dup: any = await (await app.request(`/api/landing-pages/${sourceId}/duplicate`, { method: "POST" })).json();

    // Delete the image on the ORIGINAL — the duplicate still references the key
    const sourceImages = await db.select().from(schema.landingPageImages)
      .where(eq(schema.landingPageImages.landingPageId, sourceId));
    const deletedBefore = r2DeletedKeys.length;
    const del = await app.request(`/api/landing-pages/${sourceId}/images/${sourceImages[0].id}`, { method: "DELETE" });
    expect(del.status).toBe(200);

    // R2 object NOT removed (the duplicate's row still references it)
    expect(r2DeletedKeys.length).toBe(deletedBefore);
    const dupImages = await db.select().from(schema.landingPageImages)
      .where(eq(schema.landingPageImages.landingPageId, dup.data.id));
    expect(dupImages.map((i) => i.r2Key)).toEqual([sharedKey]);

    // Now delete the duplicate's image too — the last reference goes, R2 removed
    const del2 = await app.request(`/api/landing-pages/${dup.data.id}/images/${dupImages[0].id}`, { method: "DELETE" });
    expect(del2.status).toBe(200);
    expect(r2DeletedKeys[r2DeletedKeys.length - 1]).toBe(sharedKey);
  });

  it("duplicate of a missing LP is a 404", async () => {
    const res = await app.request(`/api/landing-pages/lp-not-here/duplicate`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

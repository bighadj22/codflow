/**
 * /store/config's pages[] + legalContact, and GET /store/pages/{slug} —
 * Slice 3 real-D1 E2E (plain Node, same pattern as storefront-tracking-e2e.test.ts).
 *
 * No esbuild/workerd bundling needed here: every function this slice adds to
 * the READ path (getFooterPages, getPublicLegalContact, resolvePublishedPage)
 * is a plain Drizzle read — the write chokepoint's sanitizeRichText already
 * ran when the fixture rows below were written (by Slice 1/2's own e2e
 * suites), so these rows are inserted directly, pre-sanitised, matching what
 * a real seeded/saved page looks like in D1.
 *
 * Mounts the REAL storeRouter (the same router index.ts wires at /store) with
 * storeAuthMiddleware bypassed via `c.set("storeId", …)` — identical to the
 * established storefront e2e pattern — so every assertion here exercises the
 * actual production handler → queries → D1 path.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import storeRouter from "./routes";

let harness: TestD1;
let app: OpenAPIHono<AppContext>;
const NOW = () => new Date().toISOString();
const STORE_ID = "store-pages-cfg";

beforeAll(async () => {
  harness = await createTestD1();

  app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: harness.raw } as never;
    c.set("storeId", STORE_ID);
    await next();
  });
  app.onError(errorHandler);
  app.route("/store", storeRouter);
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  await harness.db.delete(schema.storePageTranslations);
  await harness.db.delete(schema.storePages);
  await harness.db.delete(schema.storeLegalProfile);
  await harness.db.delete(schema.stores);
  await harness.db.insert(schema.stores).values({
    id: STORE_ID,
    name: "متجر الاختبار",
    lang: "en",
    createdAt: NOW(),
    updatedAt: NOW(),
  });
});

let seq = 0;

async function seedPage(overrides: {
  kind?: "terms" | "privacy" | "refund" | "shipping" | "custom";
  slug?: string;
  status?: "published" | "draft";
  showInFooter?: boolean;
  position?: number;
  translations?: Array<{ locale: "ar" | "en" | "fr"; title: string; bodyHtml: string }>;
} = {}) {
  const n = ++seq;
  const id = `sp-${n}`;
  await harness.db.insert(schema.storePages).values({
    id,
    storeId: STORE_ID,
    kind: overrides.kind ?? "custom",
    slug: overrides.slug ?? `page-${n}`,
    status: overrides.status ?? "published",
    showInFooter: overrides.showInFooter ?? true,
    position: overrides.position ?? n,
    templateVersion: null,
    createdAt: NOW(),
    updatedAt: NOW(),
  });
  const translations = overrides.translations ?? [
    { locale: "en" as const, title: `Page ${n}`, bodyHtml: `<p>Body ${n}</p>` },
  ];
  for (const t of translations) {
    await harness.db.insert(schema.storePageTranslations).values({
      pageId: id,
      locale: t.locale,
      title: t.title,
      bodyHtml: t.bodyHtml,
      bodyPlain: t.bodyHtml.replace(/<[^>]+>/g, ""),
      metaTitle: null,
      metaDescription: null,
      source: "template",
      updatedAt: NOW(),
    });
  }
  return id;
}

describe("GET /store/config — pages[]", () => {
  it("lists only published + showInFooter pages, titled in the store's language, ordered by position", async () => {
    await seedPage({ slug: "terms", kind: "terms", position: 1 });
    await seedPage({ slug: "hidden", showInFooter: false, position: 2 });
    await seedPage({ slug: "draft-page", status: "draft", position: 3 });
    await seedPage({ slug: "refund-policy", kind: "refund", position: 0 });

    const res = await app.request("/store/config");
    expect(res.status).toBe(200);
    const body: any = await res.json();

    const slugs = body.data.pages.map((p: any) => p.slug);
    expect(slugs).toEqual(["refund-policy", "terms"]);
    expect(slugs).not.toContain("hidden");
    expect(slugs).not.toContain("draft-page");
  });

  it("titles each page in the store's own language, not a hardcoded locale", async () => {
    await seedPage({
      slug: "terms",
      kind: "terms",
      translations: [
        { locale: "en", title: "Terms and Conditions", bodyHtml: "<p>x</p>" },
        { locale: "fr", title: "Conditions générales", bodyHtml: "<p>x</p>" },
      ],
    });

    const res = await app.request("/store/config");
    const body: any = await res.json();
    expect(body.data.pages[0].title).toBe("Terms and Conditions");
  });

  it("returns an empty array, not an error, for a store with no pages", async () => {
    const res = await app.request("/store/config");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.pages).toEqual([]);
  });
});

describe("GET /store/config — legalContact", () => {
  it("is null when the store never set a legal profile", async () => {
    const res = await app.request("/store/config");
    const body: any = await res.json();
    expect(body.data.legalContact).toBeNull();
  });

  it("exposes only the public subset — never RC/NIF", async () => {
    await harness.db.insert(schema.storeLegalProfile).values({
      storeId: STORE_ID,
      legalName: "SARL Test",
      rcNumber: "16/00-1234567B25",
      nif: "000116001234567",
      contactEmail: "contact@example.dz",
      contactPhone: "+213 555 00 00 00",
      returnWindowDays: 7,
      deliveryMinDays: 1,
      deliveryMaxDays: 4,
      updatedAt: NOW(),
    });

    const res = await app.request("/store/config");
    const body: any = await res.json();
    expect(body.data.legalContact).toEqual({
      contactEmail: "contact@example.dz",
      contactPhone: "+213 555 00 00 00",
      deliveryMinDays: 1,
      deliveryMaxDays: 4,
    });
    expect(JSON.stringify(body.data)).not.toContain("1234567B25");
    expect(JSON.stringify(body.data)).not.toContain("000116001234567");
  });
});

describe("GET /store/pages/{slug}", () => {
  it("resolves a published page in the store's language", async () => {
    await seedPage({
      slug: "refund-policy",
      kind: "refund",
      translations: [{ locale: "en", title: "Refund Policy", bodyHtml: "<p>Return within 7 days.</p>" }],
    });

    const res = await app.request("/store/pages/refund-policy");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.title).toBe("Refund Policy");
    expect(body.data.locale).toBe("en");
    expect(body.data.bodyHtml).toBe("<p>Return within 7 days.</p>");
  });

  it("falls back to the default locale when the store's language has no translation", async () => {
    await seedPage({
      slug: "about",
      translations: [{ locale: "ar", title: "من نحن", bodyHtml: "<p>نبذة</p>" }],
    });
    // STORE_ID's lang is "en" (see beforeEach), but only an "ar" translation exists.

    const res = await app.request("/store/pages/about");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.locale).toBe("ar");
    expect(body.data.title).toBe("من نحن");
  });

  it("404s for a draft page — never a soft 200 with empty content", async () => {
    await seedPage({ slug: "coming-soon", status: "draft" });
    const res = await app.request("/store/pages/coming-soon");
    expect(res.status).toBe(404);
  });

  it("404s for an unknown slug", async () => {
    const res = await app.request("/store/pages/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("never re-derives or mutates the stored HTML — same bytes in, same bytes out", async () => {
    const hostileLookingButAlreadySanitisedBody =
      "<p>Size <strong>10cm</strong> &amp; up</p>";
    await seedPage({
      slug: "sizing",
      translations: [{ locale: "en", title: "Sizing", bodyHtml: hostileLookingButAlreadySanitisedBody }],
    });
    const res = await app.request("/store/pages/sizing");
    const body: any = await res.json();
    expect(body.data.bodyHtml).toBe(hostileLookingButAlreadySanitisedBody);
  });
});

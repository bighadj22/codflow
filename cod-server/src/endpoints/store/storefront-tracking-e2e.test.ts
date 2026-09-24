/**
 * What the storefront is told about which pixel to use.
 *
 * Two public reads carry that answer:
 *   GET /store/landing-pages/{slug}  → the page's pixel, for the head and the
 *                                      ViewContent / InitiateCheckout events
 *   GET /store/orders/{id}/tracking  → the ORDER's pixel, for the sale event
 *                                      on the thank-you page
 *
 * The second exists because the thank-you page has no idea which landing page
 * the shopper came from — the redirect carries only the order number, the
 * total and the order id. Every alternative (the slug in the URL, the pixel in
 * sessionStorage) lets the browser decide independently of the server, and
 * landing-page attribution is best-effort by design: an unknown, draft or
 * archived slug leaves the order unattributed. The browser would then fire at
 * the page's pixel while the Conversions API mirrored to the store's, and Meta
 * would record two conversions in two ad accounts instead of merging them
 * (capi-deduplication.md — dedup is per pixel).
 *
 * So the browser asks, and the LAST test here is the one that matters: for
 * every combination, what this endpoint reports and what the CAPI Workflow
 * resolves must be the same string.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const capiClient = vi.hoisted(() => ({
  sendCapiEvent: vi.fn(
    async (_pixelId: string, _accessToken: string, _payload: Record<string, unknown>) => ({
      success: true,
      fbtrace_id: "trace-1",
    }),
  ),
}));
vi.mock("@/lib/capi", () => capiClient);

import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import storeRouter from "./routes";
import { CodCapiWorkflow } from "@/workflows/capi";

let harness: TestD1;
let app: OpenAPIHono<AppContext>;
const NOW = () => new Date().toISOString();
const STORE_ID = "store-sft";
let seq = 0;

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
  await harness.db.delete(schema.landingPagePixelConfig);
  await harness.db.delete(schema.storePixelConfig);
  await harness.db.delete(schema.stores);
  await harness.db.insert(schema.stores).values({
    id: STORE_ID,
    name: "Test Store",
    domain: "shop.example.com",
    createdAt: NOW(),
    updatedAt: NOW(),
  });
});

async function setStoreTracking(
  overrides: Partial<typeof schema.storePixelConfig.$inferInsert> = {},
) {
  await harness.db.insert(schema.storePixelConfig).values({
    id: "spc-sft",
    storeId: STORE_ID,
    pixelId: "1111111111",
    accessToken: "EAAG-store-secret",
    conversionEvent: "Purchase",
    testMode: false,
    enabled: true,
    perPageTrackingEnabled: true,
    createdAt: NOW(),
    updatedAt: NOW(),
    ...overrides,
  });
}

/** A published landing page with a product, optionally with its own pixel. */
async function seedLandingPage(
  override?: Partial<typeof schema.landingPagePixelConfig.$inferInsert>,
) {
  const n = ++seq;
  const productId = `prod-sft-${n}`;
  const landingPageId = `lp-sft-${n}`;
  const slug = `lp-sft-${n}`;

  await harness.db.insert(schema.products).values({
    id: productId,
    name: `Product ${n}`,
    handle: `product-sft-${n}`,
    price: 5000,
    hasVariants: false,
    inventory: 10,
    trackInventory: true,
    lowStockThreshold: 2,
    status: "ACTIVE",
    visibility: true,
    showInStore: true,
    storeFeatured: false,
    createdAt: NOW(),
    updatedAt: NOW(),
  });
  await harness.db.insert(schema.landingPages).values({
    id: landingPageId,
    slug,
    name: `Landing page ${n}`,
    productId,
    status: "published",
    publishedAt: NOW(),
    createdAt: NOW(),
    updatedAt: NOW(),
  });
  if (override) {
    await harness.db.insert(schema.landingPagePixelConfig).values({
      id: `lppc-sft-${n}`,
      landingPageId,
      pixelId: "8888888888",
      accessToken: "EAAG-page-secret",
      conversionEvent: "Purchase",
      testMode: false,
      enabled: true,
      createdAt: NOW(),
      updatedAt: NOW(),
      ...override,
    });
  }

  return { landingPageId, slug, productId };
}

/** An order, optionally attributed to a landing page. */
async function seedOrder(landingPageId: string | null) {
  const n = ++seq;
  const orderId = `order-sft-${n}`;
  const customerId = `cust-sft-${n}`;

  await harness.db.insert(schema.customers).values({
    id: customerId,
    name: "Karim Benali",
    phone: `05520000${String(n).padStart(2, "0")}`,
    wilaya: "Alger",
    createdAt: NOW(),
  });
  await harness.db.insert(schema.orders).values({
    id: orderId,
    orderNumber: `ORD-SFT-${n}`,
    customerId,
    customerName: "Karim Benali",
    phone: `05520000${String(n).padStart(2, "0")}`,
    price: 5000,
    deliveryFee: 600,
    landingPageId,
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  return orderId;
}

/** The view counter is a deferred write, so this route needs an executionCtx. */
function executionCtx(pending: Promise<unknown>[]) {
  return {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
    props: {} as Record<string, unknown>,
  };
}

async function landingPageTracking(slug: string) {
  const pending: Promise<unknown>[] = [];
  const res = await app.request(
    `/store/landing-pages/${slug}`,
    undefined,
    undefined,
    executionCtx(pending),
  );
  await Promise.allSettled(pending);
  const body = (await res.json()) as { data: { tracking: unknown } };
  return { res, tracking: body.data.tracking, raw: JSON.stringify(body) };
}

/**
 * The pixel the real CAPI Workflow sends this order's sale to.
 *
 * Runs `run()` against the same database, with the Meta client stubbed, and
 * reads the destination back off the event it produced. Deliberately not a
 * second call to the resolver: that would agree with the endpoint even if the
 * Workflow forgot to pass the landing page along, which is precisely the
 * mistake this property exists to catch.
 */
async function capiDestinationFor(orderId: string): Promise<string | null> {
  capiClient.sendCapiEvent.mockClear();
  const workflow = new CodCapiWorkflow({} as never, { DB: harness.raw } as never);
  const step = {
    async do(_name: string, configOrCallback: unknown, maybeCallback?: unknown) {
      const callback =
        typeof configOrCallback === "function" ? configOrCallback : maybeCallback;
      return (callback as () => unknown)();
    },
  };

  await workflow.run(
    {
      payload: {
        orderId,
        eventName: "Purchase",
        stage: "checkout",
        triggeredAt: Math.floor(Date.now() / 1000),
        triggerStatus: "order_created",
      },
    } as never,
    step as never,
  );

  return (capiClient.sendCapiEvent.mock.calls[0]?.[0] as string | undefined) ?? null;
}

async function orderTracking(orderId: string) {
  const res = await app.request(`/store/orders/${orderId}/tracking`);
  const raw = await res.text();
  return { res, raw, body: res.ok ? (JSON.parse(raw) as { data: Record<string, unknown> }) : null };
}

describe("the landing page endpoint", () => {
  it("reports the store pixel when the page has no override", async () => {
    await setStoreTracking({ pixelId: "1111111111" });
    const { slug } = await seedLandingPage();

    const { tracking } = await landingPageTracking(slug);

    expect(tracking).toEqual({ pixelId: "1111111111", conversionEvent: "Purchase" });
  });

  it("reports the page's own pixel and conversion event", async () => {
    await setStoreTracking({ pixelId: "1111111111", conversionEvent: "Purchase" });
    const { slug } = await seedLandingPage({ pixelId: "8888888888", conversionEvent: "Lead" });

    const { tracking } = await landingPageTracking(slug);

    expect(tracking).toEqual({ pixelId: "8888888888", conversionEvent: "Lead" });
  });

  it("reports the store pixel while the master switch is off", async () => {
    await setStoreTracking({ pixelId: "1111111111", perPageTrackingEnabled: false });
    const { slug } = await seedLandingPage({ pixelId: "8888888888" });

    const { tracking } = await landingPageTracking(slug);

    expect(tracking).toEqual({ pixelId: "1111111111", conversionEvent: "Purchase" });
  });

  it("reports no pixel when the store has tracking switched off", async () => {
    await setStoreTracking({ enabled: false });
    const { slug } = await seedLandingPage({ pixelId: "8888888888" });

    const { tracking } = await landingPageTracking(slug);

    expect(tracking).toEqual({ pixelId: null, conversionEvent: "Purchase" });
  });

  it("never carries either access token", async () => {
    // This payload is fetched to render the public page.
    await setStoreTracking();
    const { slug } = await seedLandingPage({ accessToken: "EAAG-page-secret" });

    const { raw } = await landingPageTracking(slug);

    expect(raw).not.toContain("EAAG-page-secret");
    expect(raw).not.toContain("EAAG-store-secret");
    expect(raw).not.toContain("accessToken");
  });
});

describe("the order tracking endpoint", () => {
  it("reports the pixel of the landing page the order came from", async () => {
    await setStoreTracking({ pixelId: "1111111111" });
    const { landingPageId } = await seedLandingPage({ pixelId: "8888888888" });
    const orderId = await seedOrder(landingPageId);

    const { res, body } = await orderTracking(orderId);

    expect(res.status).toBe(200);
    expect(body?.data).toMatchObject({ pixelId: "8888888888" });
  });

  it("reports the store pixel for an order that came from no landing page", async () => {
    await setStoreTracking({ pixelId: "1111111111" });
    const orderId = await seedOrder(null);

    const { body } = await orderTracking(orderId);

    expect(body?.data).toMatchObject({ pixelId: "1111111111" });
  });

  it("names the browser event to fire, rather than the raw configuration", async () => {
    // The thank-you page used to re-implement the stage rule inline. It now
    // asks, so there is one definition of "does a sale fire at checkout".
    await setStoreTracking({ conversionEvent: "Lead" });
    const orderId = await seedOrder(null);

    const { body } = await orderTracking(orderId);

    expect(body?.data.event).toBe("Lead");
  });

  it("reports no event when the conversion fires further down the funnel", async () => {
    // Purchase_Delivered fires from the server at delivery. A browser event
    // here would be a second, un-mirrored conversion.
    await setStoreTracking({ conversionEvent: "Purchase_Delivered" });
    const orderId = await seedOrder(null);

    const { body } = await orderTracking(orderId);

    expect(body?.data.event).toBeNull();
  });

  it("reports no pixel and no event when tracking is switched off", async () => {
    await setStoreTracking({ enabled: false });
    const orderId = await seedOrder(null);

    const { body } = await orderTracking(orderId);

    expect(body?.data).toMatchObject({ pixelId: null, event: null });
  });

  it("404s for an order that does not exist", async () => {
    await setStoreTracking();

    const { res } = await orderTracking("order-that-never-existed");

    expect(res.status).toBe(404);
  });

  it("returns nothing about the order itself", async () => {
    // Keyed on an unguessable UUID, but it still answers only the one
    // question it exists for — no customer, no total, no contents.
    await setStoreTracking();
    const orderId = await seedOrder(null);

    const { body, raw } = await orderTracking(orderId);

    expect(Object.keys(body!.data).sort()).toEqual(["event", "pixelId"]);
    expect(raw).not.toContain("Karim");
    expect(raw).not.toContain("EAAG");
  });
});

describe("the browser and the Conversions API cannot disagree", () => {
  // The property the whole feature rests on. For every combination, the pixel
  // the thank-you page fires at must be the pixel the server will mirror to —
  // otherwise Meta records two conversions in two ad accounts.
  const matrix: Array<{
    name: string;
    store: Partial<typeof schema.storePixelConfig.$inferInsert>;
    page?: Partial<typeof schema.landingPagePixelConfig.$inferInsert>;
    attributed: boolean;
  }> = [
    { name: "no override", store: { pixelId: "1111111111" }, attributed: true },
    {
      name: "override in force",
      store: { pixelId: "1111111111" },
      page: { pixelId: "8888888888" },
      attributed: true,
    },
    {
      name: "override, master switch off",
      store: { pixelId: "1111111111", perPageTrackingEnabled: false },
      page: { pixelId: "8888888888" },
      attributed: true,
    },
    {
      name: "override switched off",
      store: { pixelId: "1111111111" },
      page: { pixelId: "8888888888", enabled: false },
      attributed: true,
    },
    {
      name: "override exists but the order was never attributed",
      store: { pixelId: "1111111111" },
      page: { pixelId: "8888888888" },
      attributed: false,
    },
    {
      name: "a second landing page with a different pixel",
      store: { pixelId: "1111111111" },
      page: { pixelId: "7777777777" },
      attributed: true,
    },
  ];

  for (const scenario of matrix) {
    it(`agrees for: ${scenario.name}`, async () => {
      await setStoreTracking(scenario.store);
      const { landingPageId } = await seedLandingPage(scenario.page);
      const orderId = await seedOrder(scenario.attributed ? landingPageId : null);

      const { body } = await orderTracking(orderId);
      const browserPixel = body?.data.pixelId ?? null;

      // The pixel the REAL Workflow sends to — driven end to end, not the
      // resolver asked a second time. Comparing the resolver against itself
      // would pass even if the Workflow forgot to pass the landing page.
      const serverPixel = await capiDestinationFor(orderId);

      expect(browserPixel).toBe(serverPixel);
    });
  }
});

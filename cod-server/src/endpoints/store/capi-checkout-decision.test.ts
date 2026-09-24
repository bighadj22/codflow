/**
 * Which conversion event fires at checkout, read from a real database.
 *
 * `capi-lead-trigger.test.ts` stubs `getDb` to `{}`, so the handler's
 * `typeof db.select === "function"` guard short-circuits and the configuration
 * is never read — it proves the workflow is *created*, not that it was created
 * for the right reason. This file drives the same handler against a real D1
 * with a real store tracking row, which is the only way the resolver seam is
 * actually exercised.
 *
 * What it pins (unchanged from before the seam existed):
 *   Purchase            → a Purchase workflow at checkout
 *   Lead                → a Lead workflow at checkout
 *   Purchase_Confirmed  → nothing at checkout (it fires at phone confirmation)
 *   Purchase_Delivered  → nothing at checkout (it fires on delivery)
 *   no configuration    → Purchase, the documented default
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import storeRouter from "./routes";
import * as storeQueries from "./queries";

const dbModule = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/db", () => dbModule);
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/otp-config", () => ({
  getOtpConfigRaw: vi.fn(async () => undefined),
}));
vi.mock("../../../../cod-shared/queries/turnstile-config");

let harness: TestD1;
const NOW = () => new Date().toISOString();
let seq = 0;

beforeAll(async () => {
  harness = await createTestD1();
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

/** A store, optionally with tracking configured. Returns its id. */
async function seedStore(
  pixel?: Partial<typeof schema.storePixelConfig.$inferInsert>,
): Promise<string> {
  const storeId = `store-cd-${++seq}`;
  await harness.db.insert(schema.stores).values({
    id: storeId,
    name: `Store ${seq}`,
    domain: "shop.example.com",
    createdAt: NOW(),
    updatedAt: NOW(),
  });
  if (pixel) {
    await harness.db.insert(schema.storePixelConfig).values({
      id: `spc-${storeId}`,
      storeId,
      pixelId: "9999999999",
      accessToken: "EAAG-token",
      conversionEvent: "Purchase",
      testMode: false,
      enabled: true,
      createdAt: NOW(),
      updatedAt: NOW(),
      ...pixel,
    });
  }
  return storeId;
}

function makeApp(storeId: string, workflow: { create: unknown }) {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {}, CAPI_WORKFLOW: workflow } as never;
    c.set("storeId", storeId);
    await next();
  });
  app.onError(errorHandler);
  app.route("/store", storeRouter);
  return app;
}

/** Everything between the request and the CAPI decision, stubbed to succeed. */
function stubSuccessfulOrderFlow(orderId: string) {
  vi.mocked(storeQueries.loadCatalogSnapshot).mockResolvedValue({
    products: new Map(),
    variants: new Map(),
    offers: [],
  } as never);
  vi.mocked(storeQueries.findMissingSku).mockReturnValue(null as never);
  vi.mocked(storeQueries.findStockShortfall).mockReturnValue(null as never);
  vi.mocked(storeQueries.findOrCreateCustomer).mockResolvedValue({
    id: "cust-1",
    name: "Karim Benali",
  } as never);
  vi.mocked(storeQueries.resolveDeliveryFee).mockResolvedValue(600 as never);
  vi.mocked(storeQueries.priceCartLines).mockReturnValue({ subtotal: 2500 } as never);
  vi.mocked(storeQueries.createStoreOrder).mockResolvedValue({
    id: orderId,
    orderNumber: "ORD-1",
    price: 2500,
    deliveryFee: 600,
  } as never);
}

function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Karim Benali",
    phone: "0551234567",
    wilayaId: 16,
    communeId: "c-16-001",
    deliveryType: "home",
    productId: "prod-1",
    productName: "T-shirt",
    quantity: 1,
    pricePerUnit: 2500,
    ...overrides,
  };
}

async function placeOrder(storeId: string, body: Record<string, unknown> = {}) {
  const orderId = `order-${seq}-${Math.random().toString(16).slice(2)}`;
  stubSuccessfulOrderFlow(orderId);
  const create = vi.fn(
    async (_options: { id: string; params: Record<string, unknown> }) => ({ id: "wf" }),
  );
  const app = makeApp(storeId, { create });

  // The workflow is created through waitUntil so a slow Meta call can never
  // delay the order response — the test must drain it before asserting.
  const pending: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
    props: {} as Record<string, unknown>,
  };

  const res = await app.request(
    "/store/orders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderBody(body)),
    },
    undefined,
    executionCtx,
  );
  await Promise.allSettled(pending);

  return { res, create, orderId };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The handler reads tracking through the real database; everything else in
  // the order path stays stubbed.
  dbModule.getDb.mockReturnValue(harness.db);
});

describe("the checkout-stage conversion decision", () => {
  it("fires a Purchase workflow when the merchant optimises for Purchase", async () => {
    const storeId = await seedStore({ conversionEvent: "Purchase" });

    const { res, create, orderId } = await placeOrder(storeId);

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toMatchObject({
      id: `capi-${orderId}-checkout-Purchase`,
      params: { orderId, eventName: "Purchase", stage: "checkout" },
    });
  });

  it("fires a Lead workflow when the merchant optimises for Lead", async () => {
    const storeId = await seedStore({ conversionEvent: "Lead" });

    const { create, orderId } = await placeOrder(storeId);

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toMatchObject({
      id: `capi-${orderId}-checkout-Lead`,
      params: { eventName: "Lead", stage: "checkout" },
    });
  });

  it("fires nothing at checkout when the conversion is the phone confirmation", async () => {
    const storeId = await seedStore({ conversionEvent: "Purchase_Confirmed" });

    const { res, create } = await placeOrder(storeId);

    expect(res.status).toBe(201);
    expect(create).not.toHaveBeenCalled();
  });

  it("fires nothing at checkout when the conversion is the delivery", async () => {
    const storeId = await seedStore({ conversionEvent: "Purchase_Delivered" });

    const { res, create } = await placeOrder(storeId);

    expect(res.status).toBe(201);
    expect(create).not.toHaveBeenCalled();
  });

  it("defaults to Purchase when the store has no tracking configured", async () => {
    const storeId = await seedStore();

    const { create, orderId } = await placeOrder(storeId);

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toMatchObject({
      id: `capi-${orderId}-checkout-Purchase`,
    });
  });

  it("reads the configuration of the store the request belongs to", async () => {
    // Single-tenant today, but the handler takes the store from the request
    // context — a resolver that ignored it would still pass every test above.
    const lead = await seedStore({ conversionEvent: "Lead" });
    const delivered = await seedStore({ conversionEvent: "Purchase_Delivered" });

    const first = await placeOrder(lead);
    expect(first.create.mock.calls[0]?.[0]).toMatchObject({ params: { eventName: "Lead" } });

    const second = await placeOrder(delivered);
    expect(second.create).not.toHaveBeenCalled();
  });
});

describe("the page Meta is told the checkout happened on", () => {
  it("names the landing page when attribution resolved", async () => {
    // Same rule the Workflow uses at every later stage, so an order's source
    // URL does not change between its checkout event and its delivery mirror.
    const storeId = await seedStore({ conversionEvent: "Purchase" });
    vi.mocked(storeQueries.findPublishedLandingPageIdBySlug).mockResolvedValue(
      "lp-resolved" as never,
    );

    const { create } = await placeOrder(storeId, { landingPageSlug: "zinc-v3" });

    expect(create.mock.calls[0]![0].params).toMatchObject({
      eventSourceUrl: "https://shop.example.com/lp/zinc-v3",
    });
  });

  it("falls back to the thank-you page when the slug never resolved", async () => {
    // Attribution is best-effort: an unknown, draft or archived slug leaves
    // the order unattributed. Naming that page here while the Workflow reads
    // the attributed page from the order and names /thank-you would give one
    // order two different source URLs.
    const storeId = await seedStore({ conversionEvent: "Purchase" });
    vi.mocked(storeQueries.findPublishedLandingPageIdBySlug).mockResolvedValue(null as never);

    const { create } = await placeOrder(storeId, { landingPageSlug: "a-draft-page" });

    expect(create.mock.calls[0]![0].params).toMatchObject({
      eventSourceUrl: "https://shop.example.com/thank-you",
    });
  });

  it("falls back for an order that mentions no landing page at all", async () => {
    const storeId = await seedStore({ conversionEvent: "Purchase" });

    const { create } = await placeOrder(storeId);

    expect(create.mock.calls[0]![0].params).toMatchObject({
      eventSourceUrl: "https://shop.example.com/thank-you",
    });
  });
});

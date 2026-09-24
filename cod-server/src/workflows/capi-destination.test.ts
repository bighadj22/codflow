/**
 * Which pixel the CAPI Workflow actually sends to.
 *
 * `capi.test.ts` covers the Zod payload contract; nothing until now drove
 * `run()` against a real database, so the read that decides the destination —
 * the one thing that must never disagree with the browser — was untested.
 *
 * Meta deduplicates a browser event against its server mirror only when both
 * reached the SAME pixel id (capi-deduplication.md). A server that sends to
 * the wrong pixel does not lose a conversion, it creates a second wrong one in
 * a second ad account. That is why this file exists.
 *
 * Real D1, a fake step executor, and a stubbed Meta client: everything except
 * the network runs for real.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const dbModule = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/db", () => dbModule);

const capiClient = vi.hoisted(() => ({
  sendCapiEvent: vi.fn(
    async (
      _pixelId: string,
      _accessToken: string,
      _payload: {
        eventName: string;
        eventId: string;
        testEventCode: string | null;
        eventSourceUrl?: string | null;
        [key: string]: unknown;
      },
    ) => ({ success: true, fbtrace_id: "trace-1" }),
  ),
}));
vi.mock("@/lib/capi", () => capiClient);

import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { CodCapiWorkflow } from "./capi";

let harness: TestD1;
const NOW = () => new Date().toISOString();
let seq = 0;

beforeAll(async () => {
  harness = await createTestD1();
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

/** Runs every step body immediately and records the step names in order. */
function makeFakeStep() {
  const names: string[] = [];
  return {
    names,
    async do(name: string, configOrCallback: unknown, maybeCallback?: unknown) {
      const callback =
        typeof configOrCallback === "function" ? configOrCallback : maybeCallback;
      names.push(name);
      return (callback as () => unknown)();
    },
  };
}

const STORE_ID = "store-cdest";

interface Scenario {
  /** Tracking config for the store, or undefined for a store with none. */
  storePixel?: Partial<typeof schema.storePixelConfig.$inferInsert>;
  /** Attribute the order to a landing page with this slug. */
  landingPageSlug?: string;
}

/**
 * The workflow reads the store with `stores.limit(1)` — CodFlow runs one D1
 * per merchant, so a fixture with two stores in it is not a harder test, it is
 * a fiction. One store, rewritten per scenario.
 */
async function seedStore(pixel?: Partial<typeof schema.storePixelConfig.$inferInsert>) {
  await harness.db.delete(schema.storePixelConfig);
  await harness.db.delete(schema.stores);

  await harness.db.insert(schema.stores).values({
    id: STORE_ID,
    name: "Test Store",
    domain: "shop.example.com",
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  if (pixel) {
    await harness.db.insert(schema.storePixelConfig).values({
      id: "spc-cdest",
      storeId: STORE_ID,
      pixelId: "1000000000",
      accessToken: "EAAG-store-token",
      conversionEvent: "Purchase_Delivered",
      testMode: false,
      enabled: true,
      createdAt: NOW(),
      updatedAt: NOW(),
      ...pixel,
    });
  }
}

/** A customer and one delivered order ready for a Purchase mirror. */
async function seedOrder(scenario: Scenario = {}) {
  const n = ++seq;
  const orderId = `order-cdest-${n}`;
  const customerId = `cust-cdest-${n}`;
  const productId = `prod-cdest-${n}`;

  await seedStore(scenario.storePixel);

  await harness.db.insert(schema.products).values({
    id: productId,
    name: `Product ${n}`,
    handle: `product-cdest-${n}`,
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

  await harness.db.insert(schema.customers).values({
    id: customerId,
    name: "Karim Benali",
    phone: `05510000${String(n).padStart(2, "0")}`,
    // Legacy denormalised column, still NOT NULL in the table (0000_complete).
    wilaya: "Alger",
    createdAt: NOW(),
  });

  let landingPageId: string | null = null;
  if (scenario.landingPageSlug) {
    landingPageId = `lp-cdest-${n}`;
    await harness.db.insert(schema.landingPages).values({
      id: landingPageId,
      slug: scenario.landingPageSlug,
      name: `Landing page ${n}`,
      productId,
      status: "published",
      publishedAt: NOW(),
      createdAt: NOW(),
      updatedAt: NOW(),
    });
  }

  await harness.db.insert(schema.orders).values({
    id: orderId,
    landingPageId,
    orderNumber: `ORD-CDEST-${n}`,
    customerId,
    customerName: "Karim Benali",
    phone: `05510000${String(n).padStart(2, "0")}`,
    price: 5000,
    deliveryFee: 600,
    status: "delivered",
    createdAt: NOW(),
    updatedAt: NOW(),
  });

  await harness.db.insert(schema.orderProducts).values({
    id: `op-cdest-${n}`,
    orderId,
    productId,
    productName: `Product ${n}`,
    quantity: 1,
    pricePerUnit: 5000,
    lineTotal: 5000,
    createdAt: NOW(),
  });

  return { storeId: STORE_ID, orderId };
}

async function runDeliveredPurchase(orderId: string) {
  const workflow = new CodCapiWorkflow({} as never, { DB: harness.raw } as never);
  const step = makeFakeStep();

  const result = await workflow.run(
    {
      payload: {
        orderId,
        eventName: "Purchase",
        stage: "delivered",
        triggeredAt: Math.floor(Date.now() / 1000),
        triggerStatus: "delivered",
      },
    } as never,
    step as never,
  );

  return { result, step };
}

beforeEach(() => {
  vi.clearAllMocks();
  capiClient.sendCapiEvent.mockResolvedValue({ success: true, fbtrace_id: "trace-1" });
  dbModule.getDb.mockReturnValue(harness.db);
});

describe("the CAPI Workflow's destination", () => {
  it("sends to the pixel and token the store has configured", async () => {
    const { orderId } = await seedOrder({
      storePixel: { pixelId: "5555555555", accessToken: "EAAG-the-real-token" },
    });

    await runDeliveredPurchase(orderId);

    expect(capiClient.sendCapiEvent).toHaveBeenCalledOnce();
    const [pixelId, accessToken] = capiClient.sendCapiEvent.mock.calls[0]!;
    expect(pixelId).toBe("5555555555");
    expect(accessToken).toBe("EAAG-the-real-token");
  });

  it("uses the order id as the event id, which is what Meta deduplicates on", async () => {
    // capi-deduplication.md: the browser's eventID must equal the server's
    // event_id AND the names must match, or the conversion counts twice.
    const { orderId } = await seedOrder({ storePixel: {} });

    await runDeliveredPurchase(orderId);

    const payload = capiClient.sendCapiEvent.mock.calls[0]![2];
    expect(payload.eventId).toBe(orderId);
    expect(payload.eventName).toBe("Purchase");
  });

  it("sends nothing when the store has no tracking configured", async () => {
    const { orderId } = await seedOrder();

    const { result } = await runDeliveredPurchase(orderId);

    expect(capiClient.sendCapiEvent).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true });
  });

  it("sends nothing when tracking is switched off, and records why", async () => {
    const { orderId } = await seedOrder({ storePixel: { enabled: false } });

    const { result } = await runDeliveredPurchase(orderId);

    expect(capiClient.sendCapiEvent).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true, reason: "tracking-disabled" });
  });

  it("sends nothing when the merchant optimises for a different stage", async () => {
    // Purchase at checkout means delivery must not fire a second one.
    const { orderId } = await seedOrder({ storePixel: { conversionEvent: "Purchase" } });

    const { result } = await runDeliveredPurchase(orderId);

    expect(capiClient.sendCapiEvent).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true });
  });

  it("carries the test event code only while test mode is on", async () => {
    const live = await seedOrder({
      storePixel: { testMode: false, testEventCode: "TEST1234" },
    });
    await runDeliveredPurchase(live.orderId);
    expect(capiClient.sendCapiEvent.mock.calls[0]![2].testEventCode).toBeNull();

    vi.clearAllMocks();
    const testing = await seedOrder({
      storePixel: { testMode: true, testEventCode: "TEST1234" },
    });
    await runDeliveredPurchase(testing.orderId);
    expect(capiClient.sendCapiEvent.mock.calls[0]![2].testEventCode).toBe("TEST1234");
  });

  it("records which pixel the event was sent to", async () => {
    // With one pixel this was obvious. With a pixel per landing page it is the
    // first question asked when a merchant says an event is missing.
    const { orderId } = await seedOrder({ storePixel: { pixelId: "6666666666" } });

    await runDeliveredPurchase(orderId);

    const row = await harness.db
      .select()
      .from(schema.capiEventLog)
      .where(eq(schema.capiEventLog.orderId, orderId))
      .get();
    expect(row).toMatchObject({ status: "sent", pixelId: "6666666666" });
  });

  it("records the pixel on a skip caused by a missing token", async () => {
    // The merchant pointed the page at a pixel and never finished the setup.
    // "Skipped" with no destination is a support ticket; with one it is an
    // answer.
    const { orderId } = await seedOrder({
      storePixel: { pixelId: "6767676767", accessToken: "" },
    });

    const { result } = await runDeliveredPurchase(orderId);

    expect(result).toMatchObject({ skipped: true, reason: "no-access-token" });
    const row = await harness.db
      .select()
      .from(schema.capiEventLog)
      .where(eq(schema.capiEventLog.orderId, orderId))
      .get();
    expect(row).toMatchObject({ status: "skipped", pixelId: "6767676767" });
  });

  it("claims the event so a retry cannot send the same sale twice", async () => {
    const { orderId } = await seedOrder({ storePixel: {} });

    await runDeliveredPurchase(orderId);
    expect(capiClient.sendCapiEvent).toHaveBeenCalledOnce();

    const second = await runDeliveredPurchase(orderId);

    expect(capiClient.sendCapiEvent).toHaveBeenCalledOnce();
    expect(second.result).toMatchObject({ skipped: true, reason: "already_sent" });
  });
});

describe("where Meta is told the event happened", () => {
  it("names the landing page the ad pointed at", async () => {
    // event_source_url is what Events Manager shows and what Meta matches
    // against the verified domain. For a landing-page order, /thank-you says
    // nothing about which creative produced the sale.
    const { orderId } = await seedOrder({
      storePixel: {},
      landingPageSlug: "zinc-v3",
    });

    await runDeliveredPurchase(orderId);

    expect(capiClient.sendCapiEvent.mock.calls[0]![2].eventSourceUrl).toBe(
      "https://shop.example.com/lp/zinc-v3",
    );
  });

  it("falls back to the thank-you page for an order from no landing page", async () => {
    const { orderId } = await seedOrder({ storePixel: {} });

    await runDeliveredPurchase(orderId);

    expect(capiClient.sendCapiEvent.mock.calls[0]![2].eventSourceUrl).toBe(
      "https://shop.example.com/thank-you",
    );
  });
});

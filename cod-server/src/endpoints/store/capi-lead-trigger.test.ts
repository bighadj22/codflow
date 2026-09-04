/**
 * CAPI Lead workflow trigger — drives the real createStoreOrder handler
 * through the mounted store router, pinning:
 *   - every order creates a durable Lead Workflow (id capi-{orderId}-Lead)
 *   - creation runs via executionCtx.waitUntil (runtime-safe after response)
 *   - a failing/missing workflow binding never blocks the order (201)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import storeRouter from "./routes";
import * as storeQueries from "./queries";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/otp-config", () => ({
  getOtpConfigRaw: vi.fn(async () => undefined),
}));

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
    fbc: "fb.1.1700000000.abc",
    fbp: "fb.1.1700000001.123",
    ...overrides,
  };
}

function makeApp(workflow?: { create: ReturnType<typeof vi.fn> }) {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {}, ...(workflow ? { CAPI_WORKFLOW: workflow } : {}) } as any;
    c.set("storeId", "store-1");
    await next();
  });
  app.onError(errorHandler);
  app.route("/store", storeRouter);
  return app;
}

function stubSuccessfulOrderFlow() {
  vi.mocked(storeQueries.validateOrderSkus).mockResolvedValue(null as any);
  vi.mocked(storeQueries.checkStoreOrderStock).mockResolvedValue(null as any);
  vi.mocked(storeQueries.findOrCreateCustomer).mockResolvedValue({ id: "cust-1", name: "Karim Benali" } as any);
  vi.mocked(storeQueries.getDeliveryFee).mockResolvedValue(600 as any);
  vi.mocked(storeQueries.createStoreOrder).mockResolvedValue({
    id: "ord-1",
    orderNumber: "ORD-20260901-0001",
    price: 2500,
    deliveryFee: 600,
  } as any);
}

async function placeOrder(
  app: ReturnType<typeof makeApp>,
  headers: Record<string, string> = {}
) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (p: Promise<unknown>) => pending.push(p),
    passThroughOnException: () => {},
    props: {} as Record<string, unknown>,
  };
  const res = await app.request(
    "/store/orders",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Store-API-Key": "key",
        "CF-Connecting-IP": "41.100.1.1",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://shop.example/prod",
        ...headers,
      },
      body: JSON.stringify(orderBody()),
    },
    undefined,
    executionCtx
  );
  await Promise.allSettled(pending);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  stubSuccessfulOrderFlow();
});

describe("CAPI Lead workflow trigger", () => {
  it("creates a durable Lead workflow for every order, via waitUntil", async () => {
    const workflow = { create: vi.fn(async () => ({ id: "capi-ord-1-Lead" })) };
    const before = Math.floor(Date.now() / 1000);

    const res = await placeOrder(makeApp(workflow));

    expect(res.status).toBe(201);
    expect(workflow.create).toHaveBeenCalledOnce();
    const call = workflow.create.mock.calls[0] as unknown as [
      { id: string; params: Record<string, unknown> }
    ];
    const { id, params } = call[0];
    expect(id).toBe("capi-ord-1-Lead");
    expect(params.orderId).toBe("ord-1");
    expect(params.eventName).toBe("Lead");
    expect(params.triggerStatus).toBe("order_created");
    expect(params.eventSourceUrl).toBe("https://shop.example/prod");
    expect(params.triggeredAt).toBeGreaterThanOrEqual(before);
    expect(params.triggeredAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it("still returns 201 when workflow creation rejects", async () => {
    const workflow = { create: vi.fn(async () => { throw new Error("Workflows API down"); }) };

    const res = await placeOrder(makeApp(workflow));

    expect(res.status).toBe(201);
    expect(workflow.create).toHaveBeenCalledOnce();
  });

  it("still returns 201 when the CAPI_WORKFLOW binding is absent", async () => {
    const res = await placeOrder(makeApp());

    expect(res.status).toBe(201);
  });

  it("normalizes an E.164 phone to the canonical local form before storing", async () => {
    const workflow = { create: vi.fn(async () => ({})) };

    const res = await placeOrder(makeApp(workflow));

    expect(res.status).toBe(201);
    const orderArg = vi.mocked(storeQueries.createStoreOrder).mock.calls[0][1];
    expect(orderArg.phone).toBe("0551234567");
  });
});

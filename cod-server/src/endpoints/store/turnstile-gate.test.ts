/**
 * Order-creation Turnstile gate — enforcement tests
 *
 * Drives the real createStoreOrder handler through the mounted router with
 * mocked queries and a mocked siteverify client, pinning the contract:
 *   - disabled (no row OR enabled=false) → order placed exactly as before
 *   - enabled + no token → TURNSTILE_VERIFICATION_REQUIRED (fail-closed)
 *   - enabled + siteverify success → placed
 *   - enabled + siteverify success:false → TURNSTILE_TOKEN_INVALID (fail-closed)
 *   - enabled + timeout-or-duplicate → TURNSTILE_TOKEN_INVALID (expired copy)
 *   - enabled + siteverify unreachable → placed (fail-open, outage policy)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import storeRouter from "./routes";
import * as storeQueries from "./queries";
import * as turnstileConfigQueries from "../../../../cod-shared/queries/turnstile-config";
import * as turnstileLib from "../../../../cod-shared/lib/turnstile";
import * as otpConfigQueries from "../../../../cod-shared/queries/otp-config";
import * as capiHelpers from "@/workflows/capi-helpers";

// The lib module is mocked wholesale for the gate; pull the real error class
// and codes via importActual so the outage test rejects with the genuine shape.
const { TURNSTILE_ERRORS, TurnstileError } = (await vi.importActual(
  "../../../../cod-shared/lib/turnstile"
)) as typeof import("../../../../cod-shared/lib/turnstile");

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("./queries");
vi.mock("@/workflows/capi-helpers", () => ({
  shouldTriggerCapiPurchase: vi.fn(() => false),
  shouldTriggerCapiConfirmed: vi.fn(() => false),
  getCapiWorkflowId: vi.fn((id: string, stage: string, event: string) => `capi-${id}-${stage}-${event}`),
  resolveConversionForStage: vi.fn(() => ({ shouldFire: false })),
  resolveCapiDispatch: vi.fn(() => ({ send: false, reason: "tracking-disabled", message: "mock skip" })),
}));
vi.mock("../../../../cod-shared/queries/otp-config");
vi.mock("../../../../cod-shared/queries/turnstile-config");
vi.mock("../../../../cod-shared/lib/turnstile");
vi.mock("@/lib/capi", () => ({ sendCapiEvent: vi.fn(async () => undefined) }));

const SITE_KEY = "0x4AAA-site";
const SECRET_KEY = "0x4AAA-secret";
const WIDGET_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Karim Benali",
    phone: "0551234567",
    wilayaId: 16,
    communeId: "16001",
    deliveryType: "home",
    productId: "prod-1",
    productName: "T-shirt",
    quantity: 1,
    pricePerUnit: 2500,
    ...overrides,
  };
}

function makeApp() {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {} } as any;
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

async function place(app: ReturnType<typeof makeApp>, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {}, props: {} as Record<string, unknown> };
  const res = await app.request(
    "/store/orders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
    undefined,
    executionCtx
  );
  await Promise.allSettled(pending);
  return res;
}

function enabledRow() {
  return { storeId: "store-1", siteKey: SITE_KEY, secretKey: SECRET_KEY, enabled: true };
}

describe("createStoreOrder turnstile gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubSuccessfulOrderFlow();
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(undefined as any);
    vi.mocked(turnstileLib.verifyTurnstileToken).mockResolvedValue({
      success: true,
      errorCodes: [],
    });
  });

  it("no config row → order placed exactly as before (feature inert)", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(undefined as any);

    const res = await place(makeApp(), orderBody());

    expect(res.status).toBe(201);
    expect(turnstileLib.verifyTurnstileToken).not.toHaveBeenCalled();
    expect(storeQueries.createStoreOrder).toHaveBeenCalledOnce();
  });

  it("config row with enabled=false → order placed (feature inert)", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue({
      ...enabledRow(),
      enabled: false,
    } as any);

    const res = await place(makeApp(), orderBody());

    expect(res.status).toBe(201);
    expect(turnstileLib.verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("enabled + no token → TURNSTILE_VERIFICATION_REQUIRED, order never created", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(enabledRow() as any);

    const res = await place(makeApp(), orderBody());

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.TURNSTILE_VERIFICATION_REQUIRED);
    expect(storeQueries.createStoreOrder).not.toHaveBeenCalled();
  });

  it("enabled + siteverify success → order placed, gate runs BEFORE sku/stock lookups", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(enabledRow() as any);

    const res = await place(makeApp(), orderBody({ turnstileToken: WIDGET_TOKEN }));

    expect(res.status).toBe(201);
    expect(turnstileLib.verifyTurnstileToken).toHaveBeenCalledWith(
      SECRET_KEY,
      WIDGET_TOKEN,
      expect.objectContaining({ remoteip: undefined })
    );
    expect(vi.mocked(turnstileLib.verifyTurnstileToken).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(storeQueries.validateOrderSkus).mock.invocationCallOrder[0]
    );
  });

  it("enabled + siteverify success:false → TURNSTILE_TOKEN_INVALID", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(enabledRow() as any);
    vi.mocked(turnstileLib.verifyTurnstileToken).mockResolvedValue({
      success: false,
      errorCodes: ["invalid-input-response"],
    });

    const res = await place(makeApp(), orderBody({ turnstileToken: WIDGET_TOKEN }));

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.TURNSTILE_TOKEN_INVALID);
    expect(storeQueries.createStoreOrder).not.toHaveBeenCalled();
  });

  it("enabled + timeout-or-duplicate → TURNSTILE_TOKEN_INVALID (expired/replayed copy)", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(enabledRow() as any);
    vi.mocked(turnstileLib.verifyTurnstileToken).mockResolvedValue({
      success: false,
      errorCodes: ["timeout-or-duplicate"],
    });

    const res = await place(makeApp(), orderBody({ turnstileToken: WIDGET_TOKEN }));

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.TURNSTILE_TOKEN_INVALID);
  });

  it("enabled + siteverify unreachable → order placed (fail-open, outage policy)", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(enabledRow() as any);
    vi.mocked(turnstileLib.verifyTurnstileToken).mockRejectedValue(
      new TurnstileError(TURNSTILE_ERRORS.TRANSIENT, "Siteverify unreachable: timeout")
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await place(makeApp(), orderBody({ turnstileToken: WIDGET_TOKEN }));

    expect(res.status).toBe(201);
    expect(storeQueries.createStoreOrder).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("forwards the shopper IP (X-Forwarded-For) to siteverify as remoteip", async () => {
    vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(enabledRow() as any);

    await place(
      makeApp(),
      orderBody({ turnstileToken: WIDGET_TOKEN }),
      { "X-Forwarded-For": "41.100.1.2, 10.0.0.1" }
    );

    expect(turnstileLib.verifyTurnstileToken).toHaveBeenCalledWith(
      SECRET_KEY,
      WIDGET_TOKEN,
      expect.objectContaining({ remoteip: "41.100.1.2" })
    );
  });
});

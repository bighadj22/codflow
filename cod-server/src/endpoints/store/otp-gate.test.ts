/**
 * Order-creation OTP gate — enforcement tests
 *
 * Drives the real createStoreOrder handler through the mounted router with
 * mocked queries, pinning the contract:
 *   - disabled → order placed exactly as before (no config row OR enabled=false)
 *   - enabled + valid "v" token matching the order phone → placed
 *   - enabled + no token / expired token / foreign-key token / phone mismatch → blocked
 *   - enabled + "b" bypass token → placed unverified
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import storeRouter from "./routes";
import * as storeQueries from "./queries";
import * as otpConfigQueries from "../../../../cod-shared/queries/otp-config";
import * as capiHelpers from "@/workflows/capi-helpers";
import { signOtpToken } from "@/endpoints/store-otp/token";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("./queries");
vi.mock("@/workflows/capi-helpers", () => ({
  shouldTriggerCapiPurchase: vi.fn(() => false),
}));
vi.mock("../../../../cod-shared/queries/otp-config");
vi.mock("@/lib/capi", () => ({ sendCapiEvent: vi.fn(async () => undefined) }));

const API_KEY = "dz-gate-key";
const PHONE_LOCAL = "0551234567";
const PHONE_E164 = "+213551234567";

function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Karim Benali",
    phone: PHONE_LOCAL,
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

async function place(app: ReturnType<typeof makeApp>, body: Record<string, unknown>) {
  return app.request("/store/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createStoreOrder OTP gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubSuccessfulOrderFlow();
  });

  it("no config row → order placed exactly as before (feature inert)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(undefined as any);

    const res = await place(makeApp(), orderBody());

    expect(res.status).toBe(201);
    expect(storeQueries.createStoreOrder).toHaveBeenCalledOnce();
  });

  it("config row with enabled=false → order placed (inert)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: false,
    } as any);

    const res = await place(makeApp(), orderBody());

    expect(res.status).toBe(201);
  });

  it("enabled + no token → OTP_VERIFICATION_REQUIRED", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: true,
    } as any);

    const res = await place(makeApp(), orderBody());

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_VERIFICATION_REQUIRED);
    expect(storeQueries.createStoreOrder).not.toHaveBeenCalled();
  });

  it("enabled + valid 'v' token matching the order phone → placed (local form matches E.164)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: true,
    } as any);
    const otpToken = await signOtpToken(API_KEY, PHONE_E164, "v");

    const res = await place(makeApp(), orderBody({ otpToken }));

    expect(res.status).toBe(201);
  });

  it("enabled + expired token → OTP_TOKEN_INVALID", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: true,
    } as any);
    const expired = await signOtpToken(API_KEY, PHONE_E164, "v", Math.floor(Date.now() / 1000) - 16 * 60);

    const res = await place(makeApp(), orderBody({ otpToken: expired }));

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_TOKEN_INVALID);
  });

  it("enabled + token signed with a DIFFERENT store's key → OTP_TOKEN_INVALID", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: true,
    } as any);
    const foreign = await signOtpToken("another-store-key", PHONE_E164, "v");

    const res = await place(makeApp(), orderBody({ otpToken: foreign }));

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_TOKEN_INVALID);
  });

  it("enabled + token for a different phone → OTP_PHONE_MISMATCH", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: true,
    } as any);
    const otherPhone = await signOtpToken(API_KEY, "+213661234567", "v");

    const res = await place(makeApp(), orderBody({ otpToken: otherPhone }));

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_PHONE_MISMATCH);
  });

  it("enabled + 'b' bypass token → order placed unverified (fail-open)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: true,
    } as any);
    const bypass = await signOtpToken(API_KEY, PHONE_E164, "b");

    const res = await place(makeApp(), orderBody({ otpToken: bypass }));

    expect(res.status).toBe(201);
    expect(storeQueries.createStoreOrder).toHaveBeenCalledOnce();
  });

  it("garbage token → OTP_TOKEN_INVALID (never an unhandled throw)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
      storeId: "store-1", apiKey: API_KEY, language: "ar", enabled: true,
    } as any);

    const res = await place(makeApp(), orderBody({ otpToken: "garbage.token" }));

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_TOKEN_INVALID);
  });
});

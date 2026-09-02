/**
 * Storefront OTP handlers — the outcome matrix
 *
 * Pins the fail-open contract: quota/outage → bypass token (order proceeds),
 * everything else strict. Also: config-disabled rejection, phone
 * normalization, KV guard trips, and token minting on verify.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import storeOtpRouter from "./store-routes";
import * as otpConfigQueries from "../../../../cod-shared/queries/otp-config";
import * as dzverifyModule from "./dzverify";
import { DzverifyError, DZVERIFY_ERRORS } from "./dzverify";
import { verifyOtpToken } from "./token";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("../../../../cod-shared/queries/otp-config");

const API_KEY = "dz-config-key";

function makeApp(kv?: KVNamespace) {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {}, ...(kv ? { RATE_LIMIT: kv } : {}) } as any;
    c.set("storeId", "store-1");
    await next();
  });
  app.onError(errorHandler);
  app.route("/store", storeOtpRouter);
  return app;
}

function dzClient(overrides: Partial<Record<"sendOtp" | "verifyOtp" | "getQuota", () => unknown>>) {
  return {
    sendOtp: vi.fn(async () => ({ id: "req-1", status: "SENT", expiresAt: 1716480000000, maxAttempts: 5 })),
    verifyOtp: vi.fn(async () => ({ id: "req-1", status: "VERIFIED" })),
    getQuota: vi.fn(async () => ({})),
    ...overrides,
  };
}

const enabledConfig = {
  storeId: "store-1",
  apiKey: API_KEY,
  language: "ar" as const,
  enabled: true,
  createdAt: "t",
  updatedAt: "t",
};

describe("POST /store/otp/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects with OTP_NOT_ENABLED when the store has no config row (422)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(undefined as any);
    const res = await makeApp().request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567" }),
    });
    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_NOT_ENABLED);
  });

  it("normalizes the phone to E.164 before calling dzverify", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    const client = dzClient({});
    const spy = vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(client as any);

    const res = await makeApp().request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "05 51-234 567" }),
    });

    expect(res.status).toBe(200);
    expect(client.sendOtp).toHaveBeenCalledWith("+213551234567", { language: "ar" });
    spy.mockRestore();
  });

  it("returns the sent payload with requestId + expiry", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(dzClient({}) as any);

    const res = await makeApp().request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567" }),
    });

    const body: any = await res.json();
    expect(body.data).toEqual({ status: "sent", requestId: "req-1", expiresAt: 1716480000000, maxAttempts: 5 });
  });

  it("FAIL-OPEN: quota exhaustion (402) returns a valid bypass token", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(
      dzClient({
        sendOtp: async () => {
          throw new DzverifyError(DZVERIFY_ERRORS.OUT_OF_CREDITS, "no money", 402, { reason: "exhausted" });
        },
      }) as any
    );

    const res = await makeApp().request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567" }),
    });

    const body: any = await res.json();
    expect(body.data.status).toBe("unavailable");
    expect(body.data.reason).toBe("out_of_credits");
    const payload = await verifyOtpToken(API_KEY, body.data.bypassToken);
    expect(payload).not.toBeNull();
    expect(payload!.type).toBe("b");
    expect(payload!.phone).toBe("+213551234567");
  });

  it("FAIL-OPEN: provider outage (network TypeError) returns a bypass token", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(
      dzClient({ sendOtp: async () => { throw new TypeError("fetch failed"); } }) as any
    );

    const res = await makeApp().request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567" }),
    });

    const body: any = await res.json();
    expect(body.data.status).toBe("unavailable");
    expect(body.data.reason).toBe("provider_unavailable");
    expect(await verifyOtpToken(API_KEY, body.data.bypassToken)).not.toBeNull();
  });

  it("NO BYPASS for provider rate limits — customer waits (OTP_RATE_LIMITED)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(
      dzClient({
        sendOtp: async () => {
          throw new DzverifyError(DZVERIFY_ERRORS.BUSINESS_RULE_VIOLATION, "rate limit", 422, { limit: 5, windowSeconds: 3600 });
        },
      }) as any
    );

    const res = await makeApp().request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567" }),
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_RATE_LIMITED);
    expect(body.context.windowSeconds).toBe(3600);
  });

  it("rejects un-normalizable phones with INVALID_PHONE_FORMAT (400)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    const res = await makeApp().request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0211234567" }),
    });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.INVALID_PHONE_FORMAT);
  });

  it("trips the KV phone-cooldown guard on rapid re-sends", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(dzClient({}) as any);

    const kv = {
      get: vi.fn(async (key: string) => (key.includes("otp:cd:") ? String(Math.floor(Date.now() / 1000) + 30) : null)),
      put: vi.fn(async () => undefined),
    } as unknown as KVNamespace;

    const res = await makeApp(kv).request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567" }),
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OTP_RATE_LIMITED);
    expect(body.context.reason).toBe("phone_cooldown");
  });

  it("a KV failure never blocks the send (guard is best-effort)", async () => {
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
    const client = dzClient({});
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(client as any);

    const kv = {
      get: vi.fn(async () => { throw new Error("kv down"); }),
      put: vi.fn(async () => { throw new Error("kv down"); }),
    } as unknown as KVNamespace;

    const res = await makeApp(kv).request("/store/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567" }),
    });

    expect(res.status).toBe(200);
  });
});

describe("POST /store/otp/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(enabledConfig as any);
  });

  it("returns a VALID otpToken bound to the normalized phone on success", async () => {
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(dzClient({}) as any);

    const res = await makeApp().request("/store/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567", requestId: "req-1", code: "482910" }),
    });

    const body: any = await res.json();
    expect(body.data.status).toBe("verified");
    const payload = await verifyOtpToken(API_KEY, body.data.otpToken);
    expect(payload).toMatchObject({ phone: "+213551234567", type: "v" });
  });

  it("wrong-but-retryable code → 422 with attemptsRemaining in context", async () => {
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(
      dzClient({
        verifyOtp: async () => {
          throw new DzverifyError(DZVERIFY_ERRORS.VALIDATION_ERROR, "wrong code", 422, { attemptsRemaining: 3 });
        },
      }) as any
    );

    const res = await makeApp().request("/store/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567", requestId: "req-1", code: "000000" }),
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.context.attemptsRemaining).toBe(3);
  });

  it("terminal states (409 CONFLICT) map to a terminal error — send a new OTP", async () => {
    vi.spyOn(dzverifyModule, "createDzverifyClient").mockReturnValue(
      dzClient({
        verifyOtp: async () => {
          throw new DzverifyError(DZVERIFY_ERRORS.CONFLICT, "expired", 409);
        },
      }) as any
    );

    const res = await makeApp().request("/store/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0551234567", requestId: "req-1", code: "482910" }),
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.context.terminal).toBe(true);
  });
});

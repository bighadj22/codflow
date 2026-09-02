/**
 * dzverify client + phone normalizer — unit tests
 *
 * Interface-driven: every test crosses the module's public seam exactly the
 * way a caller would (mocked fetch for the client, plain inputs for the
 * normalizer). Error taxonomy cases mirror the dz-otp.md table one-for-one.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createDzverifyClient,
  DzverifyError,
  DZVERIFY_ERRORS,
} from "./dzverify";
import { normalizeAlgerianPhone } from "./phone";

const API_KEY = "dz-key-test";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const otpData = {
  id: "01HZX5N7M4J2K8Q4R0T5V7Y9AB",
  recipient: "+213612345678",
  channel: "WHATSAPP",
  status: "SENT",
  attempts: 0,
  maxAttempts: 5,
  ttlSeconds: 300,
  expiresAt: 1716480000000,
  sentAt: 1716479700000,
  verifiedAt: null,
  createdAt: 1716479700000,
};

describe("createDzverifyClient", () => {
  let client: ReturnType<typeof createDzverifyClient>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = createDzverifyClient(API_KEY);
    fetchMock = vi.fn();
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sendOtp POSTs the recipient with the X-API-Key header and parses the envelope", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: otpData }, 201));

    const result = await client.sendOtp("+213612345678", { language: "ar" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.dzverify.com/v1/otp/send");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe(API_KEY);
    expect(JSON.parse(init.body)).toEqual({ recipient: "+213612345678", language: "ar" });
    expect(result.id).toBe(otpData.id);
    expect(result.status).toBe("SENT");
  });

  it("sendOtp omits unset options — provider rejects unknown/out-of-range fields", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: otpData }, 201));

    await client.sendOtp("+213612345678");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      recipient: "+213612345678",
    });
  });

  it("verifyOtp sends requestId + code and returns the VERIFIED request", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { ...otpData, status: "VERIFIED", attempts: 1, verifiedAt: 1716479850000 } })
    );

    const result = await client.verifyOtp(otpData.id, "482910");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.dzverify.com/v1/otp/verify");
    expect(JSON.parse(init.body)).toEqual({ requestId: otpData.id, code: "482910" });
    expect(result.status).toBe("VERIFIED");
  });

  it("getQuota parses the balance snapshot (never 404 — pre-onboarding gets a zeroed shape)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { balanceCentimes: 0, balanceDa: 0, otpEstimate: 0, plan: "none", trialGrantedAt: null, grantedAt: 1, updatedAt: 1 },
      })
    );

    const quota = await client.getQuota();

    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(quota.plan).toBe("none");
    expect(quota.otpEstimate).toBe(0);
  });

  it.each([
    [401, DZVERIFY_ERRORS.UNAUTHORIZED],
    [402, DZVERIFY_ERRORS.OUT_OF_CREDITS],
    [403, DZVERIFY_ERRORS.FORBIDDEN],
    [404, DZVERIFY_ERRORS.NOT_FOUND],
    [409, DZVERIFY_ERRORS.CONFLICT],
    [500, DZVERIFY_ERRORS.INTERNAL_ERROR],
  ])("maps HTTP %d to error code %s", async (status, code) => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code, message: "provider says no" } }, status)
    );

    const err = await client.sendOtp("+213612345678").catch((e) => e);
    expect(err).toBeInstanceOf(DzverifyError);
    expect((err as DzverifyError).code).toBe(code);
    expect((err as DzverifyError).statusCode).toBe(status);
  });

  it("wrong code maps to 422 VALIDATION_ERROR with attemptsRemaining details", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: DZVERIFY_ERRORS.VALIDATION_ERROR, message: "Invalid code", details: { attemptsRemaining: 3 } } },
        422
      )
    );

    const err = await client.verifyOtp(otpData.id, "000000").catch((e) => e);
    expect((err as DzverifyError).code).toBe(DZVERIFY_ERRORS.VALIDATION_ERROR);
    expect((err as DzverifyError).details?.attemptsRemaining).toBe(3);
  });

  it("rate limit maps to 422 BUSINESS_RULE_VIOLATION with limit + windowSeconds", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: DZVERIFY_ERRORS.BUSINESS_RULE_VIOLATION, message: "Too many sends", details: { limit: 5, windowSeconds: 3600 } } },
        422
      )
    );

    const err = await client.sendOtp("+213612345678").catch((e) => e);
    expect((err as DzverifyError).code).toBe(DZVERIFY_ERRORS.BUSINESS_RULE_VIOLATION);
    expect((err as DzverifyError).details).toEqual({ limit: 5, windowSeconds: 3600 });
    expect((err as DzverifyError).isTransient).toBe(true);
  });

  it("OUT_OF_CREDITS is flagged but NOT transient (topping up fixes it, retrying does not)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: DZVERIFY_ERRORS.OUT_OF_CREDITS, message: "Balance too low", details: { reason: "exhausted" } } },
        402
      )
    );

    const err = await client.sendOtp("+213612345678").catch((e) => e);
    expect((err as DzverifyError).isOutOfCredits).toBe(true);
    expect((err as DzverifyError).isTransient).toBe(false);
    expect((err as DzverifyError).details?.reason).toBe("exhausted");
  });

  it("non-JSON bodies map to INTERNAL_ERROR (one failure vocabulary)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } })
    );

    const err = await client.getQuota().catch((e) => e);
    expect(err).toBeInstanceOf(DzverifyError);
    expect((err as DzverifyError).code).toBe(DZVERIFY_ERRORS.INTERNAL_ERROR);
    expect((err as DzverifyError).message).toMatch(/not valid JSON/);
  });

  it("network failures surface as plain TypeError — callers decide the fail-open path", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(client.sendOtp("+213612345678")).rejects.toThrow(TypeError);
  });
});

describe("normalizeAlgerianPhone", () => {
  it("normalizes every local Algerian mobile shape to +213 E.164", () => {
    expect(normalizeAlgerianPhone("0551234567")).toBe("+213551234567");
    expect(normalizeAlgerianPhone("551234567")).toBe("+213551234567");
    expect(normalizeAlgerianPhone("066 123-4567")).toBe("+213661234567");
    expect(normalizeAlgerianPhone(" 0771234567 ")).toBe("+213771234567");
    expect(normalizeAlgerianPhone("05 51 23 45 67")).toBe("+213551234567");
  });

  it("completes already-country-coded forms", () => {
    expect(normalizeAlgerianPhone("+213551234567")).toBe("+213551234567");
    expect(normalizeAlgerianPhone("213551234567")).toBe("+213551234567");
  });

  it("passes other countries through in +CC form", () => {
    expect(normalizeAlgerianPhone("+33612345678")).toBe("+33612345678");
    expect(normalizeAlgerianPhone("+971501234567")).toBe("+971501234567");
  });

  it("returns null for garbage, landlines, and wrong lengths", () => {
    expect(normalizeAlgerianPhone("abc")).toBeNull();
    expect(normalizeAlgerianPhone("0211234567")).toBeNull(); // Algerian landline (021…)
    expect(normalizeAlgerianPhone("1234")).toBeNull();
    expect(normalizeAlgerianPhone("")).toBeNull();
    expect(normalizeAlgerianPhone("+21355123456712345")).toBeNull(); // too long after +CC
    expect(normalizeAlgerianPhone("0551234567x")).toBeNull();
    expect(normalizeAlgerianPhone("+abc12345")).toBeNull();
  });

  it("rejects non-Algerian mobiles given without a + prefix", () => {
    expect(normalizeAlgerianPhone("33612345678")).toBeNull();
  });
});

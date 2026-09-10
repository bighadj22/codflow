/**
 * Turnstile siteverify client — unit tests
 *
 * Interface-driven: every test crosses the module's public seam exactly the
 * way a caller would (mocked fetch). In-band siteverify failures
 * (success:false + error-codes) are RESULTS, never throws; only transport
 * failures (network, timeout, non-200, non-JSON) throw TurnstileError
 * TRANSIENT — callers decide the fail-open/fail-closed policy for those.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  verifyTurnstileToken,
  TurnstileError,
  TURNSTILE_ERRORS,
} from "./turnstile";

const SECRET = "0x4AAA-secret";

function siteverifyResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("verifyTurnstileToken", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    fetchMock = vi.fn();
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs form-encoded secret+response to the siteverify endpoint and parses success", async () => {
    fetchMock.mockResolvedValueOnce(
      siteverifyResponse({
        success: true,
        challenge_ts: "2026-09-09T12:00:00.000Z",
        hostname: "store.example.com",
        "error-codes": [],
        action: "place-order",
      })
    );

    const result = await verifyTurnstileToken(SECRET, "tok-123", {
      remoteip: "41.100.1.2",
      idempotencyKey: "8f0c1e7a-0000-4000-8000-000000000000",
    });

    expect(result).toEqual({
      success: true,
      errorCodes: [],
      hostname: "store.example.com",
      action: "place-order",
      challengeTs: "2026-09-09T12:00:00.000Z",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const params = new URLSearchParams(init.body);
    expect(params.get("secret")).toBe(SECRET);
    expect(params.get("response")).toBe("tok-123");
    expect(params.get("remoteip")).toBe("41.100.1.2");
    expect(params.get("idempotency_key")).toBe("8f0c1e7a-0000-4000-8000-000000000000");
  });

  it("returns in-band failures as a result (success:false + error-codes), never throws", async () => {
    fetchMock.mockResolvedValueOnce(
      siteverifyResponse({ success: false, "error-codes": ["invalid-input-response"] })
    );

    const result = await verifyTurnstileToken(SECRET, "bad-token");

    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(["invalid-input-response"]);
  });

  it("omits optional request params when not provided", async () => {
    fetchMock.mockResolvedValueOnce(siteverifyResponse({ success: true, "error-codes": [] }));

    await verifyTurnstileToken(SECRET, "tok-123");

    const params = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(params.get("secret")).toBe(SECRET);
    expect(params.get("response")).toBe("tok-123");
    expect(params.has("remoteip")).toBe(false);
    expect(params.has("idempotency_key")).toBe(false);
  });

  it("network rejection → TurnstileError TRANSIENT", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(verifyTurnstileToken(SECRET, "tok-123")).rejects.toMatchObject({
      name: "TurnstileError",
      code: TURNSTILE_ERRORS.TRANSIENT,
      statusCode: undefined,
    });
  });

  it("non-200 → TurnstileError TRANSIENT carrying the status", async () => {
    fetchMock.mockResolvedValueOnce(siteverifyResponse({ error: "boom" }, 502));

    await expect(verifyTurnstileToken(SECRET, "tok-123")).rejects.toMatchObject({
      code: TURNSTILE_ERRORS.TRANSIENT,
      statusCode: 502,
    });
  });

  it("non-JSON body → TurnstileError TRANSIENT", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>gateway error</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );

    await expect(verifyTurnstileToken(SECRET, "tok-123")).rejects.toMatchObject({
      code: TURNSTILE_ERRORS.TRANSIENT,
    });
  });

  it("missing/unknown fields degrade to safe defaults (success:false, empty codes)", async () => {
    fetchMock.mockResolvedValueOnce(siteverifyResponse({}));

    const result = await verifyTurnstileToken(SECRET, "tok-123");

    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual([]);
    expect(result.hostname).toBeUndefined();
    expect(result.action).toBeUndefined();
  });
});

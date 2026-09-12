/**
 * readClientMeta + checkMcpRateLimit — the per-request client-context reader
 * and the coarse, fail-open KV rate guard.
 *
 * Contract:
 *   • readClientMeta extracts ONLY the two documented string hints, tolerating
 *     any malformed context shape
 *   • the rate limit is fail-open: absent KV, KV errors, and garbage counters
 *     all allow the call — scope gating and the audit trail are the security
 *     boundary, this guard only stops sustained flooding
 *   • over the limit → blocked with a bounded retry hint
 */

import { describe, it, expect, vi } from "vitest";
import {
  readClientMeta,
  checkMcpRateLimit,
  RATE_LIMIT_MAX_CALLS,
  RATE_LIMIT_WINDOW_SECONDS,
} from "./request-context";

function ctxWithMeta(meta: Record<string, unknown> | undefined) {
  return meta === undefined ? {} : { mcpReq: { _meta: meta } };
}

describe("readClientMeta", () => {
  it("extracts subject and session hints", () => {
    expect(
      readClientMeta(ctxWithMeta({ "openai/subject": "sub-1", "openai/session": "sess-2" })),
    ).toEqual({ subject: "sub-1", session: "sess-2" });
  });

  it("ignores non-string values and unrelated keys", () => {
    expect(
      readClientMeta(
        ctxWithMeta({
          "openai/subject": 42,
          "openai/session": null,
          "openai/userAgent": "Mozilla/5.0",
          "openai/userLocation": { city: "Algiers" },
        }),
      ),
    ).toEqual({});
  });

  it("tolerates missing ctx, missing mcpReq, and missing _meta", () => {
    expect(readClientMeta(undefined)).toEqual({});
    expect(readClientMeta({})).toEqual({});
    expect(readClientMeta({ mcpReq: {} })).toEqual({});
    expect(readClientMeta({ mcpReq: { _meta: undefined } })).toEqual({});
  });

  it("returns partial hints when only one is present", () => {
    expect(readClientMeta(ctxWithMeta({ "openai/session": "s" }))).toEqual({ session: "s" });
  });
});

interface KVStub {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

function makeKV(
  overrides: {
    get?: (key: string) => Promise<string | null>;
    put?: (key: string, value: string) => Promise<void>;
  } = {},
): KVNamespace {
  return {
    get: vi.fn(overrides.get ?? (async () => null)),
    put: vi.fn(overrides.put ?? (async () => undefined)),
  } as unknown as KVNamespace;
}

describe("checkMcpRateLimit", () => {
  it("allows everything when no KV binding exists", async () => {
    const result = await checkMcpRateLimit(undefined, "user-1");
    expect(result).toEqual({ allowed: true });
  });

  it("counts up within the window and allows calls under the limit", async () => {
    const put = vi.fn(async () => undefined);
    const kv = makeKV({ put });
    for (let i = 0; i < 3; i++) {
      expect(await checkMcpRateLimit(kv, "user-1")).toEqual({ allowed: true });
    }
    expect(put).toHaveBeenCalledTimes(3);
    const [key, value, options] = put.mock.calls[0] as unknown as [
      string,
      string,
      { expirationTtl: number },
    ];
    expect(key).toMatch(/^mcp:rl:user-1:\d+$/);
    expect(value).toBe("1");
    expect(options.expirationTtl).toBe(RATE_LIMIT_WINDOW_SECONDS * 2);
  });

  it("blocks at the limit with a bounded retry hint", async () => {
    const kv = makeKV({ get: async () => String(RATE_LIMIT_MAX_CALLS) });
    const result = await checkMcpRateLimit(kv, "user-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_SECONDS);
    }
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("treats one-below-limit as the last allowed call (writes the increment)", async () => {
    const put = vi.fn(async () => undefined);
    const kv = makeKV({ get: async () => String(RATE_LIMIT_MAX_CALLS - 1), put });
    expect(await checkMcpRateLimit(kv, "user-1")).toEqual({ allowed: true });
    expect(put).toHaveBeenCalledWith(
      expect.any(String),
      String(RATE_LIMIT_MAX_CALLS),
      expect.anything(),
    );
  });

  it("fails OPEN on a KV read error", async () => {
    const kv = makeKV({ get: async () => { throw new Error("KV down"); } });
    expect(await checkMcpRateLimit(kv, "user-1")).toEqual({ allowed: true });
  });

  it("fails OPEN on a KV write error (contention beyond 1 write/sec)", async () => {
    const kv = makeKV({ put: async () => { throw new Error("write contention"); } });
    expect(await checkMcpRateLimit(kv, "user-1")).toEqual({ allowed: true });
  });

  it("fails OPEN on a garbage counter value", async () => {
    const kv = makeKV({ get: async () => "not-a-number" });
    expect(await checkMcpRateLimit(kv, "user-1")).toEqual({ allowed: true });
  });

  it("isolates subjects into separate counters", async () => {
    const kv = makeKV({
      get: vi.fn(async (key: string) => (key.includes("alice") ? String(RATE_LIMIT_MAX_CALLS) : null)),
    });
    expect((await checkMcpRateLimit(kv, "alice")).allowed).toBe(false);
    expect((await checkMcpRateLimit(kv, "bob")).allowed).toBe(true);
  });
});

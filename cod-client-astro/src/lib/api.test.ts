import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => {
  let jwt = "stale-jwt";
  return {
    currentJwt: vi.fn(async () => jwt),
    refreshJwt: vi.fn(async () => {
      jwt = "fresh-jwt";
      return jwt;
    }),
  };
});

vi.mock("@/lib/session", () => session);
vi.mock("astro:env/client", () => ({ PUBLIC_API_URL: "https://api.test" }));

import { apiFetch } from "./api";

describe("apiFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries a 401 with a freshly issued bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch<{ ok: boolean }>("/api/orders")).resolves.toEqual({ ok: true });

    expect(session.refreshJwt).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer stale-jwt" },
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer fresh-jwt" },
    });
  });
});

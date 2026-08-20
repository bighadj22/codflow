/**
 * bearerToProps — the security-critical gatekeeper in front of every MCP
 * request. These tests nail the contract at the boundary:
 *   • missing bearer              → throws UnauthenticatedError("missing_bearer")
 *   • bad JWT / unreachable JWKS  → throws UnauthenticatedError("invalid_token")
 *   • happy path                  → returns fully-shaped McpProps
 *
 * Verification is fully offline: we fetch the issuer's JWKS (for
 * reachability + cacheability) and then check issuer, audience and expiry
 * locally. `fetch` is stubbed so tests never touch the network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bearerToProps, extractBearer, UnauthenticatedError } from "./auth";
import type { Env } from "@/types/env";

const env = {
  BETTER_AUTH_URL: "https://app.example.com",
  WORKER_SELF_URL: "https://api.example.com",
} as unknown as Env;

const JWKS_URL = "https://app.example.com/api/auth/jwks";

function base64url(input: object | string): string {
  const raw = typeof input === "string" ? input : JSON.stringify(input);
  return Buffer.from(raw).toString("base64url");
}

function makeToken(payload: object): string {
  return `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.fake-sig`;
}

function stubJwks(ok = true): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ keys: [] }),
  }));
}

const validPayload = {
  iss: "https://app.example.com",
  aud: "https://api.example.com",
  sub: "user-abc",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
  scope: "orders:read customers:read",
  role: "staff",
  name: "Fatima",
  email: "fatima@example.com",
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractBearer", () => {
  it("returns the token when header is well-formed", () => {
    expect(extractBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("is case-insensitive on the scheme (RFC 6750)", () => {
    expect(extractBearer("bearer abc")).toBe("abc");
    expect(extractBearer("BEARER abc")).toBe("abc");
  });

  it("returns undefined for missing / non-Bearer headers", () => {
    expect(extractBearer(undefined)).toBeUndefined();
    expect(extractBearer("")).toBeUndefined();
    expect(extractBearer("Basic abc")).toBeUndefined();
    expect(extractBearer("abc")).toBeUndefined();
  });
});

describe("bearerToProps", () => {
  it("throws missing_bearer when no token is supplied", async () => {
    await expect(bearerToProps(undefined, env)).rejects.toMatchObject({
      name: "UnauthenticatedError",
      code: "missing_bearer",
    });
  });

  it("throws invalid_token for a malformed JWT", async () => {
    stubJwks();
    await expect(bearerToProps("bad.token", env)).rejects.toMatchObject({
      name: "UnauthenticatedError",
      code: "invalid_token",
    });
  });

  it("throws invalid_token when the issuer JWKS is unreachable", async () => {
    stubJwks(false);
    await expect(bearerToProps(makeToken(validPayload), env)).rejects.toMatchObject({
      name: "UnauthenticatedError",
      code: "invalid_token",
    });
  });

  it("throws invalid_token when the token is expired", async () => {
    stubJwks();
    const expired = {
      ...validPayload,
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    await expect(bearerToProps(makeToken(expired), env)).rejects.toMatchObject({
      name: "UnauthenticatedError",
      code: "invalid_token",
    });
  });

  it("throws invalid_token on issuer mismatch", async () => {
    stubJwks();
    const wrongIssuer = { ...validPayload, iss: "https://evil.example" };
    await expect(bearerToProps(makeToken(wrongIssuer), env)).rejects.toMatchObject({
      name: "UnauthenticatedError",
      code: "invalid_token",
    });
  });

  it("throws invalid_token on audience mismatch", async () => {
    stubJwks();
    const wrongAud = { ...validPayload, aud: "https://other.example" };
    await expect(bearerToProps(makeToken(wrongAud), env)).rejects.toMatchObject({
      name: "UnauthenticatedError",
      code: "invalid_token",
    });
  });

  it("fetches the issuer's JWKS for reachability", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await bearerToProps(makeToken(validPayload), env);
    expect(fetchMock).toHaveBeenCalledWith(JWKS_URL);
  });

  it("projects JWT claims onto McpProps (happy path, staff)", async () => {
    stubJwks();
    const props = await bearerToProps(makeToken(validPayload), env);
    expect(props).toEqual({
      userId: "user-abc",
      role: "staff",
      scopes: ["orders:read", "customers:read"],
      name: "Fatima",
      email: "fatima@example.com",
    });
  });

  it("marks admin role correctly", async () => {
    stubJwks();
    const props = await bearerToProps(
      makeToken({ ...validPayload, sub: "admin-1", scope: "", role: "admin" }),
      env,
    );
    expect(props.role).toBe("admin");
  });

  it("defaults non-admin role to 'staff' even when missing", async () => {
    stubJwks();
    const { role: _role, ...noRole } = validPayload;
    const props = await bearerToProps(makeToken(noRole), env);
    expect(props.role).toBe("staff");
  });

  it("handles empty scope string", async () => {
    stubJwks();
    const props = await bearerToProps(
      makeToken({ ...validPayload, scope: "", role: "staff" }),
      env,
    );
    expect(props.scopes).toEqual([]);
  });

  it("handles array scope claim (future-proofing)", async () => {
    stubJwks();
    const props = await bearerToProps(
      makeToken({ ...validPayload, scope: ["orders:read", "customers:read"] }),
      env,
    );
    expect(props.scopes).toEqual(["orders:read", "customers:read"]);
  });

  it("coerces missing name/email to empty strings (never undefined)", async () => {
    stubJwks();
    const { name: _name, email: _email, ...minimal } = validPayload;
    const props = await bearerToProps(makeToken(minimal), env);
    expect(props.name).toBe("");
    expect(props.email).toBe("");
  });

  it("accepts the /mcp audience variant (RFC 8707 resource forms)", async () => {
    stubJwks();
    const props = await bearerToProps(
      makeToken({ ...validPayload, aud: "https://api.example.com/mcp" }),
      env,
    );
    expect(props.userId).toBe("user-abc");
  });
});
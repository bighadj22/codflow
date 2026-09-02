/**
 * MCP OAuth `/authorize` — the login-ticket bridge + consent flow.
 *
 * Contract:
 *   • no ticket / invalid ticket → 302 to the dashboard sign-in relay
 *   • valid ticket → consent page listing ONLY grantable scopes (+ CSRF cookie)
 *   • admin bypass → all requested scopes are grantable
 *   • zero grantable scopes → no-permissions page (no form)
 *   • POST validates CSRF, consumes the single-use ticket, re-intersects the
 *     selected scopes with the user's real permissions, then
 *     `completeAuthorization`
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  AuthorizationError,
  type AuthRequest,
} from "@cloudflare/workers-oauth-provider";
import { mintLoginTicket } from "../../../cod-shared/lib/login-ticket";
import {
  authorizeGet,
  authorizePost,
  buildDenyRedirectUrl,
  buildFormAction,
  buildSignInRedirectUrl,
  computeGrantableScopes,
  consentLang,
  csrfSetCookie,
  csrfCookieValue,
  csrfTokensMatch,
  oauthErrorRedirectUrl,
  renderConsentPage,
} from "./authorize";
import type { Env } from "@/types/env";
import type { AppContext } from "@/types/app";

const db = vi.hoisted(() => ({} as { select?: unknown }));
vi.mock("@/db", () => ({ getDb: () => db }));

const KEY = "0123456789abcdef0123456789abcdef"; // 32 bytes

const authRequest: AuthRequest = {
  responseType: "code",
  clientId: "claude",
  redirectUri: "http://127.0.0.1:3000/callback",
  scope: ["orders:read", "customers:read"],
  state: "xyz",
  codeChallenge: "abc",
  codeChallengeMethod: "S256",
  resource: "https://api.codflow.store/mcp",
  issuer: "https://api.codflow.store",
};

const staffUser = { id: "user-1", name: "Ada", email: "ada@example.com", role: "staff", status: "active" };
const adminUser = { id: "user-1", name: "Ada", email: "ada@example.com", role: "admin", status: "active" };

function setDb(user: unknown, scopes: string[]): void {
  const scopeRows = scopes.map((scope) => ({ scope }));
  db.select = () => ({
    from: () => ({
      where: () => ({
        then: (resolve: (value: unknown) => void) => {
          resolve(scopeRows);
        },
        get: async () => user,
      }),
    }),
  });
}

function authzUrl(ticket?: string): string {
  const url = new URL("https://api.codflow.store/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", "claude");
  url.searchParams.set("redirect_uri", authRequest.redirectUri);
  url.searchParams.set("scope", authRequest.scope.join(" "));
  url.searchParams.set("state", authRequest.state);
  url.searchParams.set("code_challenge", authRequest.codeChallenge!);
  url.searchParams.set("code_challenge_method", authRequest.codeChallengeMethod!);
  if (ticket) url.searchParams.set("ticket", ticket);
  return url.toString();
}

function makeEnv() {
  const parseAuthRequest = vi.fn(async () => authRequest);
  const lookupClient = vi.fn(async () => null);
  const completeAuthorization = vi.fn(async () => ({
    redirectTo: "http://127.0.0.1:3000/callback?code=abc&state=xyz",
  }));
  const kvGet = vi.fn(async (_key: string): Promise<string | null> => null);
  const kvPut = vi.fn(async () => {});
  const env = {
    OAUTH_PROVIDER: { parseAuthRequest, lookupClient, completeAuthorization },
    MCP_LOGIN_TICKET_SECRET: KEY,
    OAUTH_KV: { get: kvGet, put: kvPut },
    BETTER_AUTH_URL: "https://astro-v2.codflow.store/api/auth",
    DB: {},
  } as unknown as Env;
  return { env, parseAuthRequest, lookupClient, completeAuthorization, kvGet, kvPut };
}

function app() {
  const hono = new Hono<AppContext>();
  hono.get("/authorize", authorizeGet);
  hono.post("/authorize", authorizePost);
  return hono;
}

function postForm(env: Env, ticket: string, csrfToken: string, scopes: string[]): Promise<Response> {
  const body = new URLSearchParams();
  body.set("ticket", ticket);
  body.set("csrf_token", csrfToken);
  for (const scope of scopes) body.append("scope", scope);
  return Promise.resolve(app().request(authzUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: csrfSetCookie(csrfToken),
      "accept-language": "en",
    },
    body: body.toString(),
  }, env));
}

describe("authorize helpers", () => {
  it("computes grantable scopes: admin bypass, staff intersection, wildcard", () => {
    expect(computeGrantableScopes("admin", [], ["a", "b"])).toEqual(["a", "b"]);
    expect(computeGrantableScopes("staff", ["a"], ["a", "b"])).toEqual(["a"]);
    expect(computeGrantableScopes("staff", ["*"], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("builds the dashboard sign-in redirect through the relay", () => {
    const url = buildSignInRedirectUrl("https://astro-v2.codflow.store/api/auth", "https://api.codflow.store/authorize?a=1");
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://astro-v2.codflow.store");
    expect(parsed.pathname).toBe("/sign-in");
    expect(parsed.searchParams.get("next")).toContain("/mcp/oauth/login");
    expect(parsed.searchParams.get("next")).toContain("authorize");
  });

  it("strips the ticket from the consent form action", () => {
    const action = buildFormAction("https://api.codflow.store/authorize?client_id=c&ticket=t&state=s");
    expect(action).toBe("/authorize?client_id=c&state=s");
  });

  it("builds the deny redirect with RFC 9207 issuer and state", () => {
    const url = buildDenyRedirectUrl(authRequest);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("error")).toBe("access_denied");
    expect(parsed.searchParams.get("state")).toBe("xyz");
    expect(parsed.searchParams.get("iss")).toBe("https://api.codflow.store");
  });

  it("returns null from the error redirect without a validated redirect URI", () => {
    const error = new AuthorizationError("invalid_request", { description: "bad" });
    expect(oauthErrorRedirectUrl(error)).toBeNull();
  });

  it("detects consent language from Accept-Language with ar default", () => {
    expect(consentLang("fr-FR,fr;q=0.9")).toBe("fr");
    expect(consentLang("en-US,en;q=0.9")).toBe("en");
    expect(consentLang(undefined)).toBe("ar");
    expect(consentLang("de-DE")).toBe("ar");
  });

  it("matches CSRF tokens only when identical (constant-time)", () => {
    expect(csrfTokensMatch("abc", "abc")).toBe(true);
    expect(csrfTokensMatch("abc", "abd")).toBe(false);
    expect(csrfTokensMatch(null, "abc")).toBe(false);
    expect(csrfCookieValue(`a=1; ${csrfSetCookie("tok")}`)).toBe("tok");
    expect(csrfCookieValue(undefined)).toBeNull();
  });

  it("escapes client-controlled strings in the consent page", () => {
    const html = renderConsentPage({
      clientName: "<script>alert(1)</script>",
      grantableScopes: ["orders:read"],
      formAction: "/authorize?a=b",
      csrfToken: "tok",
      ticket: "t",
      denyUrl: "https://x.test/cb?e=1",
      lang: "en",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("authorize GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the dashboard sign-in when no ticket is present", async () => {
    const { env } = makeEnv();
    const res = await app().request(authzUrl(), {}, env);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin).toBe("https://astro-v2.codflow.store");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toContain("/mcp/oauth/login");
  });

  it("redirects to sign-in for an invalid ticket", async () => {
    const { env } = makeEnv();
    const res = await app().request(authzUrl("not-a-ticket"), {}, env);

    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("renders consent with only grantable scopes and a CSRF cookie", async () => {
    setDb(staffUser, ["orders:read"]);
    const { env } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");

    const res = await app().request(authzUrl(ticket), { headers: { "accept-language": "en" } }, env);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("orders:read");
    expect(html).not.toContain("customers:read");
    expect(res.headers.get("set-cookie")).toContain("__Host-MCP_CSRF");
    expect(html).toContain('name="ticket"');
  });

  it("grants every requested scope for an admin", async () => {
    setDb(adminUser, []);
    const { env } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");

    const res = await app().request(authzUrl(ticket), { headers: { "accept-language": "en" } }, env);
    const html = await res.text();

    expect(html).toContain("orders:read");
    expect(html).toContain("customers:read");
  });

  it("renders the no-permissions page when nothing is grantable", async () => {
    setDb(staffUser, []);
    const { env } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");

    const res = await app().request(authzUrl(ticket), { headers: { "accept-language": "en" } }, env);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Nothing to authorize");
    expect(html).not.toContain('method="post"');
  });

  it("rejects an inactive account", async () => {
    setDb({ ...staffUser, status: "inactive" }, ["orders:read"]);
    const { env } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");

    const res = await app().request(authzUrl(ticket), { headers: { "accept-language": "en" } }, env);
    expect(res.status).toBe(403);
  });

  it("renders an OAuth error locally when the client is unknown", async () => {
    const { env, parseAuthRequest } = makeEnv();
    parseAuthRequest.mockRejectedValue(new AuthorizationError("invalid_request", { description: "Unknown client" }));

    const res = await app().request(authzUrl(), { headers: { "accept-language": "en" } }, env);

    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Unknown client");
  });
});

describe("authorize POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes authorization with the user's grantable scopes", async () => {
    setDb(staffUser, ["orders:read"]);
    const { env, completeAuthorization } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");

    const res = await postForm(env, ticket, "csrf-token", ["orders:read"]);

    expect(res.status).toBe(302);
    expect(completeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        scope: ["orders:read"],
        props: expect.objectContaining({ userId: "user-1", role: "staff", scopes: ["orders:read"] }),
      }),
    );
  });

  it("never grants a scope the user does not hold", async () => {
    setDb(staffUser, ["orders:read"]);
    const { env, completeAuthorization } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");

    await postForm(env, ticket, "csrf-token", ["orders:read", "customers:delete"]);

    expect(completeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ scope: ["orders:read"] }),
    );
  });

  it("rejects a mismatched CSRF token", async () => {
    setDb(staffUser, ["orders:read"]);
    const { env, completeAuthorization } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");

    const body = new URLSearchParams({ ticket, csrf_token: "wrong", scope: "orders:read" });
    const res = await app().request(authzUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: csrfSetCookie("right"),
        "accept-language": "en",
      },
      body: body.toString(),
    }, env);

    expect(res.status).toBe(403);
    expect(completeAuthorization).not.toHaveBeenCalled();
  });

  it("rejects a replayed ticket via its single-use nonce", async () => {
    setDb(staffUser, ["orders:read"]);
    const { env, kvGet, completeAuthorization } = makeEnv();
    const ticket = await mintLoginTicket(KEY, "user-1");
    kvGet.mockResolvedValueOnce("1");

    const res = await postForm(env, ticket, "csrf-token", ["orders:read"]);

    expect(res.status).toBe(401);
    expect(completeAuthorization).not.toHaveBeenCalled();
  });
});

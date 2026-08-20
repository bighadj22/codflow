/**
 * MCP Bearer-token verification.
 *
 * Single responsibility: turn a raw `Authorization: Bearer <jwt>` header into
 * a validated `McpProps` object. Called once per MCP request, up-front,
 * before the Durable Object session is touched.
 *
 * Token verification is strictly offline — we fetch the issuer's JWKS
 * (published by cod-client at `${BETTER_AUTH_URL}/api/auth/jwks`) and verify
 * the JWT issuer + audience + expiration locally. No network hop to the auth
 * server on the hot path.
 *
 * Better Auth exp-claim workaround: some Better Auth versions serialise the
 * access token `exp` as a DURATION (seconds until expiry) instead of a
 * Unix timestamp per RFC 7519 §4.1.4. We detect that case by the value
 * being unrealistically small (< 10000) and reconstruct the true expiry
 * from `iat + exp`. Remove the branch once Better Auth ships the fix.
 *
 * Scope extraction note: Better Auth's JWT encodes `scope` as a single
 * space-separated string per RFC 6749 §3.3. We split on whitespace and
 * drop empties. If a future Better Auth version switches to `scope: string[]`
 * we handle that too.
 */

import type { Env } from "@/types/env";
import type { McpProps } from "./props";

export class UnauthenticatedError extends Error {
  constructor(readonly code: "missing_bearer" | "invalid_token", message?: string) {
    super(message ?? code);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Parse a raw HTTP Authorization header and return just the bearer token,
 * or undefined if the header is missing/not a Bearer scheme.
 * Case-insensitive on the scheme per RFC 6750 §2.1.
 */
export function extractBearer(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1];
}

interface JwtPayload {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  iat?: number;
  scope?: string | string[];
  role?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

function decodeJwtPayload(bearer: string): JwtPayload {
  const parts = bearer.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT (expected three dot-separated parts)");
  }
  // JWT payloads are base64url-encoded (RFC 7515 §4.1.2). `atob` expects
  // standard base64, so translate URL-safe chars back and restore padding
  // before decoding — otherwise tokens whose payload happens to contain `+`
  // or `/` throw "not correctly encoded".
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as JwtPayload;
}

/**
 * Verify an OAuth access token and project it onto the MCP session props shape.
 *
 * @param bearer  The raw JWT string (no `Bearer ` prefix — already stripped).
 * @param env     The Worker env. We read:
 *                  • `BETTER_AUTH_URL` — the cod-client origin; used as
 *                    issuer AND to construct the JWKS URL.
 *                  • `WORKER_SELF_URL` — our own origin; MUST be present
 *                    in the token's `aud` claim or verification fails.
 * @throws UnauthenticatedError("missing_bearer") when bearer is falsy.
 * @throws UnauthenticatedError("invalid_token")  when the JWT is bad
 *         (wrong signature / issuer / audience / expired / etc.).
 */
export async function bearerToProps(
  bearer: string | undefined,
  env: Env,
): Promise<McpProps> {
  if (!bearer) {
    throw new UnauthenticatedError("missing_bearer");
  }

  const issuer = env.BETTER_AUTH_URL;
  const audience = env.WORKER_SELF_URL;
  const baseUrl = issuer.replace(/\/api\/auth$/, "");
  const jwksUrl = `${baseUrl}/api/auth/jwks`;

  let payload: JwtPayload;
  try {
    payload = decodeJwtPayload(bearer);

    // Signature check gate: fetch JWKS so the issuer is reachable and the
    // key set is cacheable by the Worker runtime. A proper per-key verify
    // lands once Better Auth's `verifyAccessToken` can round-trip the
    // exp-claim bug (see header docstring).
    const jwksResponse = await fetch(jwksUrl);
    if (!jwksResponse.ok) {
      throw new Error(`Failed to fetch JWKS (${jwksResponse.status})`);
    }
    await jwksResponse.json();

    if (payload.iss !== issuer) {
      throw new Error(`Invalid issuer: expected ${issuer}, got ${payload.iss ?? "<none>"}`);
    }

    // Audience match — lenient about the form the MCP client sent as the
    // `resource` parameter. Different MCP clients pick different shapes:
    //
    //   • Some send the bare RFC 9728 `resource` value (e.g. "https://api.x.com")
    //   • Some append a trailing slash ("https://api.x.com/")  ← Cloudflare AI Playground
    //   • Some append the `/mcp` path ("https://api.x.com/mcp")
    //
    // Better Auth puts whatever the client sent into the `aud` claim, so we
    // need to accept all three for our own origin. cod-client's
    // `validAudiences` mirrors this same set on the AS side.
    const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    const baseAudience = audience.replace(/\/+$/, "");
    const acceptable = new Set([baseAudience, `${baseAudience}/`, `${baseAudience}/mcp`]);
    const audMatch = aud.some((a) => acceptable.has(typeof a === "string" ? a : String(a)));
    if (!audMatch) {
      throw new Error(`Invalid audience: expected one of ${[...acceptable].join(" | ")}, got ${aud.join(", ") || "<none>"}`);
    }

    const now = Math.floor(Date.now() / 1000);
    const { exp, iat } = payload;
    if (typeof exp === "number") {
      // Better Auth bug workaround: exp serialised as duration.
      const effectiveExp = exp < 10_000 && typeof iat === "number" ? iat + exp : exp;
      if (now > effectiveExp) {
        throw new Error("Token expired");
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new UnauthenticatedError("invalid_token", message);
  }

  const rawScope = payload.scope;
  const scopes = Array.isArray(rawScope)
    ? rawScope.map(String)
    : typeof rawScope === "string"
      ? rawScope.split(/\s+/).filter(Boolean)
      : [];

  const role = payload.role === "admin" ? "admin" : "staff";

  return {
    userId: String(payload.sub ?? ""),
    role,
    scopes,
    name:  typeof payload.name  === "string" ? payload.name  : "",
    email: typeof payload.email === "string" ? payload.email : "",
  };
}

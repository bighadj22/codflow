/**
 * Session-JWT verification for dashboard-originated API calls.
 *
 * The Astro dashboard authenticates users via better-auth and forwards a
 * short-lived JWT (issued by the jwt() plugin) as `Authorization: Bearer`.
 * This module verifies those tokens offline against the auth server's JWKS
 * endpoint — the same infrastructure cod-server already trusts for MCP
 * tokens — and returns the caller's user id.
 *
 * Unlike bearerToProps (MCP), this performs REAL cryptographic verification.
 */
import { eq } from "drizzle-orm";

interface JwtHeader {
  alg?: string;
  kid?: string;
}

export interface SessionJwtPayload {
  sub: string;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

interface Env {
  BETTER_AUTH_URL: string;
  WORKER_SELF_URL: string;
}

const JWKS_TTL_MS = 5 * 60 * 1000;

let jwksCache: { keys: JsonWebKey[]; kidByKeyId: Map<string, number>; fetchedAt: number } | null =
  null;

function authBaseUrl(env: Env): string {
  return env.BETTER_AUTH_URL.replace(/\/api\/auth$/, "");
}

async function fetchJwks(env: Env, force = false): Promise<void> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return;
  const res = await fetch(`${authBaseUrl(env)}/api/auth/jwks`);
  if (!res.ok) throw new Error(`Failed to fetch JWKS (${res.status})`);
  const body = (await res.json()) as { keys: Array<JsonWebKey & { kid?: string }> };
  const kidByKeyId = new Map<string, number>();
  body.keys.forEach((k, i) => {
    if (k.kid) kidByKeyId.set(k.kid, i);
  });
  jwksCache = { keys: body.keys, kidByKeyId, fetchedAt: Date.now() };
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function importVerifyKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
}

export async function verifySessionJwt(token: string, env: Env): Promise<SessionJwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  await fetchJwks(env);

  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0]))) as JwtHeader;
  if (!header.kid) throw new Error("JWT header missing kid");
  let keyIndex = jwksCache?.kidByKeyId.get(header.kid);
  if (keyIndex === undefined) {
    // Docs: unknown kid → fetch JWKS again (supports key rotation).
    await fetchJwks(env, true);
    keyIndex = jwksCache?.kidByKeyId.get(header.kid);
  }
  const jwk = keyIndex === undefined ? undefined : jwksCache?.keys[keyIndex];
  if (!jwk) throw new Error(`Unknown signing key: ${header.kid}`);

  const key = await importVerifyKey(jwk);
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as SessionJwtPayload;
  if (!payload.sub) throw new Error("JWT missing sub");

  if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) {
    throw new Error("Token expired");
  }

  if (payload.iss && payload.iss !== env.BETTER_AUTH_URL.replace(/\/api\/auth$/, "")) {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }
  if (payload.aud) {
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const selfBase = (env.WORKER_SELF_URL ?? "").replace(/\/+$/, "");
    // Dashboard-originated JWTs carry the auth server's own origin as audience
    // (better-auth jwt() default). Same trust realm as WORKER_SELF_URL.
    const appOrigin = authBaseUrl(env);
    const acceptable = new Set([
      ...(selfBase ? [selfBase, `${selfBase}/`, `${selfBase}/mcp`] : []),
      appOrigin,
    ]);
    if (acceptable.size > 0 && !auds.some((a) => acceptable.has(String(a)))) {
      throw new Error(`Invalid audience: ${auds.join(", ")}`);
    }
  }

  return payload;
}

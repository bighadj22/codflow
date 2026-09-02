/**
 * Cross-worker login ticket for the MCP OAuth authorize flow.
 *
 * CodFlow's identity lives in Better Auth sessions on the Astro dashboard
 * (`astro-v2.codflow.store`), but the MCP OAuth authorization endpoint runs on
 * cod-server (`api.codflow.store`). The dashboard cannot share its session
 * cookie across origins, so after a successful sign-in it mints a short-lived,
 * single-use, HMAC-signed ticket proving "this user is authenticated", which
 * cod-server verifies before rendering consent.
 *
 * Shared by both workers (mint on the dashboard, verify on cod-server) via the
 * same secret `MCP_LOGIN_TICKET_SECRET` (>= 32 bytes). The ticket is signed,
 * not encrypted: it carries only the user id, an expiry, and a single-use
 * nonce — no session data.
 *
 * Wire shape: `v1.<b64url(payload)>.<b64url(hmac-sha256(domain+payload))>`.
 */

const VERSION = "v1";
const DOMAIN = "mcp-login-ticket.v1.";
export const LOGIN_TICKET_TTL_SECONDS = 5 * 60;
export const LOGIN_TICKET_MIN_KEY_BYTES = 32;

export interface LoginTicketPayload {
  /** Authenticated user id. */
  sub: string;
  /** Expiry as Unix seconds. */
  exp: number;
  /** Single-use nonce consumed by cod-server on consent. */
  nonce: string;
}

function encodeB64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeB64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Mint a login ticket for an authenticated user. Throws a `RangeError` when
 * the secret is shorter than 32 bytes so a dashboard misconfiguration fails
 * loudly instead of minting weak tickets.
 */
export async function mintLoginTicket(
  secret: string,
  userId: string,
  nowMs = Date.now(),
): Promise<string> {
  if (secret.length < LOGIN_TICKET_MIN_KEY_BYTES) {
    throw new RangeError("MCP_LOGIN_TICKET_SECRET must be at least 32 bytes");
  }
  const payload: LoginTicketPayload = {
    sub: userId,
    exp: Math.floor(nowMs / 1000) + LOGIN_TICKET_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const encoded = encodeB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const mac = await sign(secret, DOMAIN + encoded);
  return `${VERSION}.${encoded}.${encodeB64Url(mac)}`;
}

/**
 * Verify a login ticket: checks the version, HMAC (constant-time), payload
 * shape, and expiry. Returns the payload on success or `null` on any failure —
 * fail closed, never throws.
 */
export async function verifyLoginTicket(
  secret: string,
  ticket: string,
  nowMs = Date.now(),
): Promise<LoginTicketPayload | null> {
  const parts = ticket.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;

  const [, encoded, macB64] = parts;
  try {
    const expected = await sign(secret, DOMAIN + encoded);
    if (!constantTimeEqual(expected, decodeB64Url(macB64))) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(decodeB64Url(encoded)),
    ) as Partial<LoginTicketPayload>;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }
    if (payload.exp < Math.floor(nowMs / 1000)) return null;

    return payload as LoginTicketPayload;
  } catch {
    return null;
  }
}

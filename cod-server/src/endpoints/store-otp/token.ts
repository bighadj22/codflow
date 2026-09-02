/**
 * OTP verification tokens — stateless proof of a verified (or bypassed) phone
 *
 * Design: after a customer verifies their WhatsApp code, the server mints a
 * compact HMAC-SHA256 token binding the normalized E.164 phone to an expiry.
 * `POST /store/orders` verifies it without any server-side session state —
 * D1 stays untouched by the OTP flow.
 *
 * Token shape (b64url): `{v,p,e,t}.{sig}`
 *   v = payload version ("1" — future format changes bump this and old
 *       tokens simply stop verifying)
 *   p = phone (E.164, normalized BEFORE signing)
 *   e = expiry (unix seconds)
 *   t = type: "v" = phone verified via WhatsApp code,
 *            "b" = bypass — dzverify could not serve the send (quota
 *                 exhausted / provider down). Server-attested so it cannot
 *                 be forged; the order proceeds unverified per the fail-open
 *                 contract.
 *
 * The signing key derives from the store's dzverify API key
 * (SHA-256(api_key + "codflow-otp-v1")) — rotating the merchant's key
 * invalidates outstanding tokens, and no new platform secret exists to
 * manage. A token minted under one store's key never verifies under
 * another's.
 *
 * Comparison is constant-time via crypto.subtle timing-safe comparison
 * (fixed-length digests compared with a non-early-exit loop).
 */

const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 15 * 60;
const KEY_CONTEXT = "codflow-otp-v1";

export type OtpTokenType = "v" | "b";

export interface OtpTokenPayload {
  phone: string;
  /** Unix seconds. */
  expiresAt: number;
  type: OtpTokenType;
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeJson(value: unknown): string {
  return b64urlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(text: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(text))) as T;
  } catch {
    return null;
  }
}

async function hmacKey(apiKey: string): Promise<CryptoKey> {
  const seed = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${apiKey}${KEY_CONTEXT}`)
  );
  return crypto.subtle.importKey(
    "raw",
    seed,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(apiKey: string, payload: object): Promise<string> {
  const key = await hmacKey(apiKey);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return b64urlEncode(new Uint8Array(signature));
}

/** Constant-time equality for equal-length signature strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Mint a token. `type` "v" for a verified phone, "b" for a fail-open bypass
 * (only minted when dzverify itself could not serve the send).
 */
export async function signOtpToken(
  apiKey: string,
  phone: string,
  type: OtpTokenType,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const payload = { v: TOKEN_VERSION, p: phone, e: nowSeconds + TOKEN_TTL_SECONDS, t: type };
  const signature = await sign(apiKey, payload);
  return `${encodeJson(payload)}.${signature}`;
}

/**
 * Verify a token. Returns the payload, or null for ANY of: malformed input,
 * wrong version, bad signature, expiry, unknown type. Callers only learn
 * "valid until e for phone p" — never why it failed (no oracle).
 */
export async function verifyOtpToken(
  apiKey: string,
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<OtpTokenPayload | null> {
  if (typeof token !== "string" || token.length > 1024) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadPart = token.slice(0, dot);
  const signaturePart = token.slice(dot + 1);

  const payload = decodeJson<{ v?: number; p?: string; e?: number; t?: string }>(payloadPart);
  if (
    payload == null ||
    payload.v !== TOKEN_VERSION ||
    typeof payload.p !== "string" ||
    typeof payload.e !== "number" ||
    (payload.t !== "v" && payload.t !== "b")
  ) {
    return null;
  }

  const expected = await sign(apiKey, { v: payload.v, p: payload.p, e: payload.e, t: payload.t });
  if (!timingSafeEqual(signaturePart, expected)) return null;

  if (payload.e <= nowSeconds) return null;

  return { phone: payload.p, expiresAt: payload.e, type: payload.t };
}

/**
 * Redaction for anything persisted or surfaced to a merchant.
 *
 * Meta error messages do not echo the access token today, but the event log is
 * merchant-visible (tracking health) and a token must never survive a
 * copy-paste into a support ticket. Redaction runs twice on purpose: at the
 * source, where the token is known and can be matched exactly, and again on
 * write, so a future caller that forgets cannot leak one.
 */

const MAX_ERROR_LENGTH = 500;

// A user/system token starts with EAA and is long; an app token is
// "appId|appSecret". Both shapes are what the save-time format guard accepts.
const META_USER_TOKEN = /EAA[A-Za-z0-9+/=_.-]{8,}/g;
const META_APP_TOKEN = /\b\d{6,20}\|[A-Fa-f0-9]{16,}\b/g;
const BEARER_TOKEN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function redactSecrets(message: string): string {
  return message
    .replace(META_USER_TOKEN, "[redacted-token]")
    .replace(META_APP_TOKEN, "[redacted-token]")
    .replace(BEARER_TOKEN, "Bearer [redacted]");
}

/**
 * Bound and redact an error before it is written to `capi_event_log`.
 * `secret` is the token when the caller has it; exact match catches a value
 * that does not look like a token at all.
 */
export function sanitizeErrorForLog(
  message: string | null | undefined,
  secret?: string | null,
): string | null {
  if (!message) return null;
  let out = message;
  if (secret && secret.length >= 8) out = out.split(secret).join("[redacted-token]");
  out = redactSecrets(out).replace(/\s+/g, " ").trim();
  return out.length > MAX_ERROR_LENGTH ? `${out.slice(0, MAX_ERROR_LENGTH)}…` : out;
}

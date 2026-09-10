/**
 * Cloudflare Turnstile siteverify client
 *
 * One deep module hiding the whole server-side verification surface (source of
 * truth: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/):
 *   - POST https://challenges.cloudflare.com/turnstile/v0/siteverify
 *     (accepts form-encoded or JSON; ALWAYS responds JSON).
 *   - Required: secret (widget secret key), response (the client token).
 *     Optional: remoteip (visitor IP), idempotency_key (UUID — safely retry a
 *     validation without double-spending the single-use token).
 *   - Tokens are single-use and expire after 300 seconds; a replayed/expired
 *     token comes back success:false with "timeout-or-duplicate".
 *   - Siteverify reports failures IN-BAND: 200 + { success: false,
 *     "error-codes": [...] } (e.g. invalid-input-secret, timeout-or-duplicate).
 *     Those are returned as a result, not thrown.
 *   - Only transport-level problems (network, timeout, non-JSON, non-200)
 *     throw TurnstileError with the TRANSIENT code — callers decide the
 *     fail-open/fail-closed policy for those (CodFlow: fail-open, orders are
 *     never blocked by a provider outage).
 *
 * Zero dependencies: fetch + URLSearchParams only.
 */

// ─── Errors ───────────────────────────────────────────────────────────────────

export const TURNSTILE_ERRORS = {
  /** Network failure, timeout, non-200, or non-JSON — siteverify unreachable. */
  TRANSIENT: "TRANSIENT",
} as const;

export class TurnstileError extends Error {
  /** Stable code — branch on this, never on message. */
  readonly code: string;
  /** HTTP status when the failure came from a response, undefined for network errors. */
  readonly statusCode: number | undefined;

  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = "TurnstileError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TurnstileVerifyOptions {
  /** Visitor IP — optional per Cloudflare docs; forwarded only when known. */
  remoteip?: string;
  /** UUID — lets a caller safely retry siteverify without consuming the token twice. */
  idempotencyKey?: string;
  /** Override the default 10s transport timeout (ms). */
  timeoutMs?: number;
}

export interface TurnstileVerifyResult {
  /** Siteverify's own verdict — false means the token was rejected (in-band). */
  success: boolean;
  /** Cloudflare error codes (e.g. "timeout-or-duplicate", "invalid-input-secret"). */
  errorCodes: string[];
  /** Hostname the widget was solved on. */
  hostname?: string;
  /** Action passed at widget render time (if any). */
  action?: string;
  /** ISO timestamp of the challenge completion. */
  challengeTs?: string;
}

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TIMEOUT_MS = 10_000;

// ─── Client ───────────────────────────────────────────────────────────────────

export async function verifyTurnstileToken(
  secret: string,
  token: string,
  opts: TurnstileVerifyOptions = {}
): Promise<TurnstileVerifyResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (opts.remoteip) body.set("remoteip", opts.remoteip);
  if (opts.idempotencyKey) body.set("idempotency_key", opts.idempotencyKey);

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new TurnstileError(
      TURNSTILE_ERRORS.TRANSIENT,
      `Siteverify unreachable: ${(cause as Error)?.message ?? "network error"}`
    );
  }

  if (!res.ok) {
    throw new TurnstileError(
      TURNSTILE_ERRORS.TRANSIENT,
      `Siteverify returned HTTP ${res.status}`,
      res.status
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (cause) {
    throw new TurnstileError(
      TURNSTILE_ERRORS.TRANSIENT,
      `Siteverify returned non-JSON: ${(cause as Error)?.message ?? "parse error"}`,
      res.status
    );
  }

  const payload = json as {
    success?: unknown;
    "error-codes"?: unknown;
    hostname?: unknown;
    action?: unknown;
    challenge_ts?: unknown;
  };

  return {
    success: payload.success === true,
    errorCodes: Array.isArray(payload["error-codes"])
      ? payload["error-codes"].filter((c): c is string => typeof c === "string")
      : [],
    hostname: typeof payload.hostname === "string" ? payload.hostname : undefined,
    action: typeof payload.action === "string" ? payload.action : undefined,
    challengeTs: typeof payload.challenge_ts === "string" ? payload.challenge_ts : undefined,
  };
}

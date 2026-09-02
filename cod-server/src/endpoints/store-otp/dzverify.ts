/**
 * dzverify WhatsApp OTP API client
 *
 * One deep module: three methods (sendOtp, verifyOtp, getQuota) hiding the
 * whole provider surface — envelopes, error taxonomy, scope semantics.
 *
 * Interface contract:
 *   - Auth: X-API-Key header (scopes otp:send / otp:verify / otp:read /
 *     usage:read — the quota route's scope is NOT in a key's defaults).
 *   - Phones are E.164 ("+213612345678") — normalize BEFORE calling
 *     (phone.ts). The API rejects anything else with 422.
 *   - Timestamps in responses are Unix milliseconds UTC.
 *   - Every failure throws DzverifyError carrying the provider's stable
 *     error.code plus details (attemptsRemaining, limit, windowSeconds,
 *     reason) — callers branch on `err.code`, never on message text.
 *   - The 6-digit code is never present in any response — it only reaches
 *     the end user's WhatsApp.
 *
 * Source of truth: dz-otp.md (repo root). Verified facts inline.
 */

// ─── Provider data shapes (subset CodFlow consumes) ──────────────────────────

export interface DzverifyOtpRequest {
  id: string;
  recipient: string;
  channel: "WHATSAPP";
  /** SENT | VERIFIED | EXPIRED | FAILED (PENDING is transient). */
  status: string;
  attempts: number;
  maxAttempts: number;
  ttlSeconds: number;
  /** Unix ms — null before the send completes. */
  expiresAt: number | null;
  sentAt: number | null;
  verifiedAt: number | null;
  createdAt: number;
}

export interface DzverifyQuota {
  balanceCentimes: number;
  balanceDa: number;
  otpEstimate: number;
  /** trial | active | suspended | none (none = pre-onboarding, zeroed). */
  plan: string;
  trialGrantedAt: number | null;
  grantedAt: number;
  updatedAt: number;
}

export interface DzverifySendOptions {
  /** en | fr | ar — WhatsApp message language. */
  language?: "en" | "fr" | "ar";
  /** 1–10, provider default 5. Out-of-range is rejected, NOT clamped. */
  maxAttempts?: number;
  /** 60–900 s, provider default 300. Out-of-range is rejected, NOT clamped. */
  ttlSeconds?: number;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Stable provider error codes (dz-otp.md error table). */
export const DZVERIFY_ERRORS = {
  UNAUTHORIZED: "UNAUTHORIZED",
  OUT_OF_CREDITS: "OUT_OF_CREDITS",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class DzverifyError extends Error {
  /** Stable provider error code — branch on this, never on message. */
  readonly code: string;
  readonly statusCode: number;
  /** Structured context: attemptsRemaining, limit, windowSeconds, reason… */
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DzverifyError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  /** True when the send could not happen because the balance is too low. */
  get isOutOfCredits(): boolean {
    return this.code === DZVERIFY_ERRORS.OUT_OF_CREDITS;
  }

  /** True for provider/network failures that are safe to retry later. */
  get isTransient(): boolean {
    return (
      this.code === DZVERIFY_ERRORS.INTERNAL_ERROR ||
      this.statusCode >= 500 ||
      (this.code === DZVERIFY_ERRORS.BUSINESS_RULE_VIOLATION &&
        this.details?.limit !== undefined)
    );
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.dzverify.com";

export interface DzverifyClient {
  sendOtp(recipient: string, options?: DzverifySendOptions): Promise<DzverifyOtpRequest>;
  verifyOtp(requestId: string, code: string): Promise<DzverifyOtpRequest>;
  getQuota(): Promise<DzverifyQuota>;
}

interface ProviderEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

/**
 * Parse a provider response body into data or a thrown DzverifyError.
 * Both envelopes are handled: success `{success, data}` and error
 * `{error: {code, message, details?}}`. Non-JSON bodies map to
 * INTERNAL_ERROR so callers see one failure vocabulary.
 */
async function parseResponse<T>(res: Response): Promise<T> {
  let body: ProviderEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ProviderEnvelope<T>;
  } catch {
    throw new DzverifyError(
      DZVERIFY_ERRORS.INTERNAL_ERROR,
      `dzverify HTTP ${res.status} — response is not valid JSON`,
      res.status
    );
  }

  if (res.ok && body?.success && body.data != null) {
    return body.data;
  }

  const code = body?.error?.code ?? DZVERIFY_ERRORS.INTERNAL_ERROR;
  const message = body?.error?.message ?? body?.message ?? `dzverify HTTP ${res.status}`;
  throw new DzverifyError(code, message, res.status, body?.error?.details);
}

export function createDzverifyClient(apiKey: string): DzverifyClient {
  const headers = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  async function request<T>(path: string, body?: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      ...(body === undefined ? {} : { body }),
    });
    return parseResponse<T>(res);
  }

  return {
    async sendOtp(recipient, options) {
      const payload: Record<string, unknown> = { recipient };
      if (options?.language != null) payload.language = options.language;
      if (options?.maxAttempts != null) payload.maxAttempts = options.maxAttempts;
      if (options?.ttlSeconds != null) payload.ttlSeconds = options.ttlSeconds;
      return request<DzverifyOtpRequest>("/v1/otp/send", JSON.stringify(payload));
    },

    async verifyOtp(requestId, code) {
      return request<DzverifyOtpRequest>(
        "/v1/otp/verify",
        JSON.stringify({ requestId, code })
      );
    },

    async getQuota() {
      return request<DzverifyQuota>("/v1/account/quota");
    },
  };
}

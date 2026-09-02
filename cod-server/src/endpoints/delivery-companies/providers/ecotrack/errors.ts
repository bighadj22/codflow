/**
 * EcoTrack API Error Types
 *
 * The platform reports failures in three styles; this module is the single
 * place that knows them apart:
 *
 *   1. HTTP 429 / "Too Many Attempts."        → rate limit (50 req/min)
 *   2. HTTP 200 + {success:false, error:<n>}  → business error codes
 *      10001 = order not modifiable (validated/locked)
 *      10002 = wilaya not served by this tenant
 *      10003 = return cannot be requested for this order
 *   3. HTTP 422 Laravel validation bag        → field-level errors
 *
 * Every adapter throw site uses these so callers (dispatch flows,
 * company_api_logs) get structured, actionable failures.
 */

import { flattenErrorBag } from "../utils";

export interface EcoTrackApiErrorOptions {
  /** EcoTrack business error code (10001 / 10002 / 10003). */
  errorCode?: number;
  /** HTTP status code of the carrier response. */
  statusCode?: number;
  /** True when the failure is the 50-requests/minute rate limit. */
  isRateLimit?: boolean;
}

export class EcoTrackApiError extends Error {
  readonly errorCode?: number;
  readonly statusCode?: number;
  readonly isRateLimit: boolean;

  constructor(message: string, options: EcoTrackApiErrorOptions = {}) {
    super(message);
    this.name = "EcoTrackApiError";
    this.errorCode = options.errorCode;
    this.statusCode = options.statusCode;
    this.isRateLimit = options.isRateLimit ?? false;
  }
}

/** A business-failure body as returned on HTTP 200. */
export interface EcotrackBusinessErrorBody {
  success?: boolean;
  error?: number;
  message?: string;
  errors?: unknown;
}

/**
 * Build the typed error for an HTTP-200 `{success:false}` response,
 * prefixing the business code so logs name the failure mode.
 */
export function ecotrackBusinessError(
  body: EcotrackBusinessErrorBody,
  fallback: string
): EcoTrackApiError {
  const detail = flattenErrorBag(body.errors);
  const message = detail ?? body.message ?? fallback;
  const prefix = body.error != null ? `EcoTrack ${body.error}: ` : "";
  return new EcoTrackApiError(`${prefix}${message}`, { errorCode: body.error });
}

/**
 * Build the typed error for a non-2xx response. Detects the rate limit and
 * appends flattened field details to Laravel 422 messages.
 */
export function ecotrackHttpError(status: number, json: unknown): EcoTrackApiError {
  const body = (json ?? {}) as { message?: string; errors?: unknown };

  if (status === 429 || body.message === "Too Many Attempts.") {
    return new EcoTrackApiError(
      "EcoTrack rate limit exceeded (50 requests/minute) — retry later",
      { statusCode: status, isRateLimit: true }
    );
  }

  const detail = flattenErrorBag(body.errors);
  const message = detail
    ? `${body.message ?? "EcoTrack request failed"} — ${detail}`
    : body.message ?? `EcoTrack HTTP ${status}`;
  return new EcoTrackApiError(message, { statusCode: status });
}

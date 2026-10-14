/**
 * Shared utilities for delivery provider adapters.
 * Used by all provider implementations (NOEST, ZR Express, and future providers).
 */

/**
 * Flatten an API error-bag into a human-readable string.
 *
 * Handles two formats:
 *  - ZR Express ASP.NET `ValidationProblemDetails.errors`:
 *      an Array of `{ code, description, type }` objects
 *  - Laravel / NOEST style: a Record<field, string | string[]>
 *
 * @returns Human-readable string, or null if empty.
 */
export function flattenErrorBag(errors: unknown): string | null {
  if (!errors) return null;

  // ZR Express: errors is an array of { description: string } objects
  if (Array.isArray(errors)) {
    if (errors.length === 0) return null;
    const parts = errors
      .map((e) => {
        if (typeof e === "string") return e;
        const obj = e as { description?: string; message?: string };
        return obj.description ?? obj.message ?? JSON.stringify(e);
      })
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : null;
  }

  // NOEST / Laravel: errors is Record<field, string | string[]>
  if (typeof errors !== "object") return null;
  const entries = Object.entries(errors as Record<string, unknown>);
  if (entries.length === 0) return null;
  const parts = entries
    .map(([field, val]) => {
      const msgs = (Array.isArray(val) ? val : [val])
        .map((m) => String(m).trim())
        .filter(Boolean);
      return msgs.length > 0 ? `${field}: ${msgs.join(", ")}` : "";
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : null;
}

/**
 * First non-blank string among the candidates.
 *
 * Carriers answer errors with `{"message": ""}` (an empty string is NOT
 * nullish), so a plain `body.message ?? fallback` silently yields an empty
 * message and the merchant only ever sees a generic failure toast.
 */
export function nonBlank(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** Bounded single-line snippet of a raw carrier response body. */
export function bodySnippet(rawText: string, limit = 180): string {
  const flat = rawText.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit)}...` : flat;
}

/** Error carrying the carrier's HTTP status so failure logs can record it. */
export class CarrierHttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "CarrierHttpError";
    this.statusCode = statusCode;
  }
}

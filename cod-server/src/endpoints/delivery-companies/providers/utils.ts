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
    return errors
      .map((e) => {
        if (typeof e === "string") return e;
        const obj = e as { description?: string; message?: string };
        return obj.description ?? obj.message ?? JSON.stringify(e);
      })
      .join(" | ");
  }

  // NOEST / Laravel: errors is Record<field, string | string[]>
  if (typeof errors !== "object") return null;
  const entries = Object.entries(errors as Record<string, unknown>);
  if (entries.length === 0) return null;
  return entries
    .map(([field, val]) => {
      const msgs = Array.isArray(val) ? val.map(String) : [String(val)];
      return `${field}: ${msgs.join(", ")}`;
    })
    .join(" | ");
}

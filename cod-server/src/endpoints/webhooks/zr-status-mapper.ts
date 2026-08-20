/**
 * ZR Express Status Mapper
 *
 * ZR state names are company-configurable free text — NOT a fixed enum.
 * Confirmed/mentioned state names in ZR Express docs:
 *   - "Out for Delivery"  — confirmed in example payload (data.state.name)
 *   - "In Transit"        — mentioned in docs description as example
 *   - "At Hub"            — mentioned in docs description as example
 *
 * All other state names (Delivered, Returned, Cancelled, etc.) are NOT documented.
 * Admins must add them via the custom mapping UI after observing real state names
 * in their ZR account.
 *
 * Custom mapping format stored in delivery_companies.webhook_status_mapping:
 *   { "delivered": ["Delivered", "Livraison effectuée"], "returned": ["Returned"] }
 * Keys = our order status strings. Values = exact ZR state names (case-insensitive match).
 */

// Only state names confirmed or mentioned in ZR Express documentation.
// Keys are lowercased for case-insensitive lookup.
const ZR_DEFAULT_STATE_MAP: Record<string, string> = {
  "out for delivery": "out_for_delivery", // confirmed in example payload
  "in transit":       "assigned",         // mentioned in docs description
  "at hub":           "assigned",         // mentioned in docs description
};

/**
 * Parse the custom mapping JSON stored in DB.
 * Format: { ourStatus: [zrStateName, ...] }
 * Returns null if the JSON is missing, invalid, or empty.
 */
export function parseCustomMapping(
  json: string | null | undefined
): Record<string, string[]> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, string[]>;
  } catch {
    return null;
  }
}

/**
 * Map a ZR state name to one of our order statuses.
 *
 * Lookup order:
 *   1. Custom mapping from DB (admin-configured)
 *   2. Code defaults (3 doc-confirmed entries)
 *
 * Returns null if the state name is not found in either mapping.
 * Caller must log result='unmapped' and NOT change the order status.
 */
export function mapZrStateName(
  stateName: string | null | undefined,
  custom: Record<string, string[]> | null
): string | null {
  if (!stateName) return null;
  const normalized = stateName.toLowerCase().trim();

  // Check custom mapping first (case-insensitive)
  if (custom) {
    for (const [ourStatus, zrNames] of Object.entries(custom)) {
      if (Array.isArray(zrNames)) {
        for (const zrName of zrNames) {
          if (typeof zrName === "string" && zrName.toLowerCase().trim() === normalized) {
            return ourStatus;
          }
        }
      }
    }
  }

  // Fall back to code defaults
  return ZR_DEFAULT_STATE_MAP[normalized] ?? null;
}

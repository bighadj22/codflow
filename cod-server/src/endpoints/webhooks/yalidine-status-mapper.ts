/**
 * Yalidine Status Mapper
 *
 * Yalidine status strings are a system-wide fixed enum — NOT configurable per customer.
 * They appear in the 'data.status' field of parcel_status_updated events.
 *
 * Sources:
 *   [*] Confirmed by Yalidine webhook documentation (yalidine-webhooks.md)
 *   [+] Known from Yalidine REST API documentation (same strings appear in webhooks)
 *
 * Special handling for "Tentative échouée":
 *   - Does NOT change the order status (stays at out_for_delivery)
 *   - Increments orders.deliveryAttempts
 *   - The 'reason' field (e.g. "Client ne répond pas") is stored in the webhook event log
 *
 * If a status string is NOT in this map → result='unmapped', order status unchanged.
 */

type YalidineMapping = {
  status: string | null;
  incrementAttempts: boolean;
};

const YALIDINE_STATUS_MAP: Record<string, YalidineMapping> = {
  "Sorti en livraison": { status: "out_for_delivery", incrementAttempts: false }, // [*]
  "Tentative échouée":  { status: "out_for_delivery", incrementAttempts: true  }, // [*] — stays out_for_delivery, increments attempts
  "Livré":              { status: "delivered",         incrementAttempts: false }, // [+]
  "En cours de retour": { status: "returned",          incrementAttempts: false }, // [+]
  "Retour à l'agence":  { status: "returned",          incrementAttempts: false }, // [+]
  "Retourné":           { status: "returned",          incrementAttempts: false }, // [+]
  "Annulé":             { status: "cancelled",         incrementAttempts: false }, // [+]
  "En préparation":     { status: "preparing",         incrementAttempts: false }, // [+]
  "Ramassé":            { status: "assigned",          incrementAttempts: false }, // [+]
  "En transit":         { status: "assigned",          incrementAttempts: false }, // [+]
};

/**
 * Map a Yalidine status string to our order status.
 *
 * Case-insensitive exact lookup.
 *
 * Returns { status: null, incrementAttempts: false } if not found in the map.
 * Caller must log result='unmapped' and NOT change the order status.
 */
export function mapYalidineStatus(
  status: string | null | undefined
): YalidineMapping {
  if (!status) return { status: null, incrementAttempts: false };

  const normalized = status.trim();

  // Try exact match first
  if (normalized in YALIDINE_STATUS_MAP) {
    return YALIDINE_STATUS_MAP[normalized];
  }

  // Try case-insensitive match
  const lower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(YALIDINE_STATUS_MAP)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }

  return { status: null, incrementAttempts: false };
}

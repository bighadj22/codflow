/**
 * ZR Express Status Mapper
 *
 * ZR state names are company-configurable free text — NOT a fixed enum.
 * The DEFAULT tenant workflow ("New Delivery Workflow") uses French slugs as
 * `state.name` with French display text as `state.description`. Both were
 * captured live on 2026-09-10 via `POST /workflows/search` (23 states) and a
 * real parcel payload (`state.name = "commande_recue"`).
 *
 * Matching is accent- and case-insensitive, and the webhook handler falls back
 * to matching `state.description` when `state.name` misses, so renamed tenants
 * with French display text still map.
 *
 * Only delivery-relevant states are defaulted. Intermediate call-center states
 * (en_traitement, appel_confirmation, …) map to their nearest our-status; the
 * webhook rank guard in cod-shared (updateOrderStatusWebhook) makes any
 * non-advancing mapping a no-op, so these can never regress an order.
 * Admins extend/override via the custom mapping UI
 * (delivery_companies.webhook_status_mapping):
 *   { "delivered": ["Livraison effectuée"], "returned": ["Returned"] }
 * Keys = our order status strings. Values = exact ZR state names.
 */

import { stripAccents } from "../delivery-companies/providers/zr_express/text";

// Default workflow vocabulary (POST /workflows/search, verified live) plus the
// legacy English aliases kept for tenants that customize names.
const ZR_DEFAULT_STATE_MAP_RAW: Record<string, string> = {
  // ── delivered family ──
  "livre":                                "delivered",
  "livre au client":                      "delivered",
  "encaisse":                             "delivered",
  "recouvert":                            "delivered",
  // ── returned family ──
  "retour_sous_traitant":                 "returned",
  "colis_recupere":                       "returned",
  "attente_recuperation_fournisseur":     "returned",
  "reinjecte_dans_stock":                 "returned",
  "recupere_par_fournisseur":             "returned",
  "remboursement_reinjecte":              "returned",
  // ── out for delivery family ──
  "en_livraison":                         "out_for_delivery",
  "sortie_en_livraison":                  "out_for_delivery",
  // ── pre-delivery carrier progression (rank-guard no-ops once dispatched) ──
  "commande_recue":                       "preparing",
  "en_traitement":                        "preparing",
  "appel_confirmation":                   "preparing",
  "commande_confirmee":                   "confirmed",
  "en_preparation":                       "preparing",
  "pret_a_expedier":                      "ready",
  "confirme_au_bureau":                   "assigned",
  "confirme_chez_partenaire":             "assigned",
  "dispatch":                             "assigned",
  "vers_wilaya":                          "assigned",
  // ── legacy English aliases (kept for customized tenants) ──
  "out for delivery":                     "out_for_delivery",
  "in transit":                           "assigned",
  "at hub":                               "assigned",
};

// Normalized lookup keys (accent-stripped, lowercased) → our status.
const ZR_DEFAULT_STATE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ZR_DEFAULT_STATE_MAP_RAW).map(([k, v]) => [stripAccents(k).toLowerCase(), v])
);

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
 *   2. Code defaults (default-workflow vocabulary, verified live)
 *
 * Matching is case- and accent-insensitive on both sides.
 * Returns null if the state name is not found in either mapping.
 * Caller must log result='unmapped' and NOT change the order status.
 */
export function mapZrStateName(
  stateName: string | null | undefined,
  custom: Record<string, string[]> | null
): string | null {
  if (!stateName) return null;
  const normalized = stripAccents(stateName).toLowerCase().trim();

  // Check custom mapping first (accent/case-insensitive)
  if (custom) {
    for (const [ourStatus, zrNames] of Object.entries(custom)) {
      if (Array.isArray(zrNames)) {
        for (const zrName of zrNames) {
          if (
            typeof zrName === "string"
            && stripAccents(zrName).toLowerCase().trim() === normalized
          ) {
            return ourStatus;
          }
        }
      }
    }
  }

  // Fall back to code defaults
  return ZR_DEFAULT_STATE_MAP[normalized] ?? null;
}

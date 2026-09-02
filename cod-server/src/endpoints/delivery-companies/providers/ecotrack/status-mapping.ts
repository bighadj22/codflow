/**
 * EcoTrack → CodFlow Status Mapping
 *
 * Authoritative table lives in CONFORMANCE.md (Slice 11) — code and doc must
 * match exactly. Rule: unmapped values return undefined and are surfaced raw
 * by callers — never guessed into a status (webhook contract rule).
 *
 * Callers must apply results ONLY through updateOrderStatusWebhook (the
 * shared forward-only rank guard) so a mapped status can never move an order
 * backwards. Delivered/Returned/Cancelled are terminal.
 */

import type { OrderStatus } from "../../../../../../cod-shared/db/schema";

const STATUS_MAP: Record<string, OrderStatus> = {
  prete_a_expedier: "dispatched",
  prete_a_preparer: "dispatched",
  en_preparation_stock: "dispatched",
  en_ramassage: "dispatched",
  vers_hub: "dispatched",
  en_hub: "dispatched",
  vers_wilaya: "dispatched",
  en_preparation: "dispatched",
  en_livraison: "out_for_delivery",
  livre_non_encaisse: "delivered",
  encaisse_non_paye: "delivered",
  paiements_prets: "delivered",
  paye_et_archive: "delivered",
  suspendu: "unreachable",
  retour_chez_livreur: "returned",
  retour_transit_entrepot: "returned",
  retour_en_traitement: "returned",
  retour_recu: "returned",
  retour_archive: "returned",
  annule: "cancelled",
};

const ACTIVITY_MAP: Record<string, OrderStatus | null> = {
  order_information_received_by_carrier: "dispatched",
  notification_on_order: null,
  picked: "dispatched",
  accepted_by_carrier: "dispatched",
  dispatched_to_driver: "out_for_delivery",
  attempt_delivery: "out_for_delivery",
  return_asked: "returned",
  return_in_transit: "returned",
  Return_received: "returned",
  livred: "delivered",
  encaissed: "delivered",
  payed: "delivered",
};

/**
 * Map an EcoTrack status enum key (get/orders rows, get/orders/status) to our
 * order status. Undefined = unmapped — surface raw, never guess.
 */
export function mapEcotrackStatus(statusKey: string): OrderStatus | undefined {
  return STATUS_MAP[statusKey];
}

/**
 * Map an EcoTrack activity key (get/tracking/info, get/trackings/info) to our
 * order status. Undefined = unknown key — surface raw, never guess.
 * Null = known non-status event (remark notification) — not a status signal.
 */
export function mapEcotrackActivity(activityKey: string): OrderStatus | null | undefined {
  return ACTIVITY_MAP[activityKey];
}

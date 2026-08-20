/**
 * EcoTrack API — Request / Response Types
 * Auth: Authorization: Bearer {api_token}  (no user_guid in body)
 * Base URL: configurable per account (stored in delivery_companies.api_endpoint)
 *
 * Used by: Packers (https://packers.ecotrack.dz) and any other EcoTrack-platform company.
 */

// ─── Create Order ─────────────────────────────────────────────────────────────
// POST /api/v1/create/order  — sent as query params, no request body

export interface EcotrackCreateOrderParams {
  /** Customer full name — required */
  nom_client: string;
  /** Primary phone (9-10 digits) — required */
  telephone: string;
  /** Secondary phone — optional */
  telephone_2?: string;
  /** Delivery address — required */
  adresse: string;
  /** Wilaya code 1-58 — required */
  code_wilaya: number;
  /** Commune name — required */
  commune: string;
  /** COD amount in DZD — required */
  montant: number;
  /** 1=Livraison, 2=Echange, 3=PICKUP, 4=Recouvrement — required */
  type: 1 | 2 | 3 | 4;
  /** Internal reference — optional */
  reference?: string;
  /** Postal / stop-desk code — optional */
  code_postal?: string;
  /** 0=home delivery, 1=stop desk — optional */
  stop_desk?: 0 | 1;
  /** Delivery notes — optional */
  remarque?: string;
  /** Product name(s); comma-separated refs for stock orders — optional */
  produit?: string;
  /** 0=no, 1=prepare from stock — optional */
  stock?: 0 | 1;
  /** Per-product quantities (comma-separated) if stock=1 — optional */
  quantite?: string;
  /** Product to recover for exchange orders — optional */
  produit_a_recuperer?: string;
  /** Shop name when managing multiple shops — optional */
  boutique?: string;
  /** Package weight — optional */
  weight?: number;
  /**
   * 0=no, 1=fragile package — optional
   * NOTE: This means the contents are physically fragile (handle with care).
   * Do NOT map canOpen to this field — they are semantically different concepts.
   */
  fragile?: 0 | 1;
  /** Customer GPS link — optional */
  gps_link?: string;
}

export interface EcotrackCreateOrderResponse {
  success?: boolean;
  /** Tracking number, e.g. "ECTNYH2407062554" */
  tracking?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── Validate / Ship Order ────────────────────────────────────────────────────
// POST /api/v1/valid/order?tracking={tracking}&ask_collection={0|1}

export interface EcotrackValidateOrderResponse {
  success?: boolean;
  message?: string;
}

// ─── Communes / Stop Desks ────────────────────────────────────────────────────
// GET /api/v1/get/communes?wilaya_id={optional}
// Response is an object keyed by index — NOT an array

export interface EcotrackCommune {
  nom: string;
  wilaya_id: number;
  /** Used as the stop-desk station code when creating stop-desk orders */
  code_postal: string;
  has_stop_desk: 0 | 1;
}

/** The full /api/v1/get/communes response — object keyed by index string */
export type EcotrackCommunesResponse = Record<string, EcotrackCommune>;

// ─── Update Order ─────────────────────────────────────────────────────────────
// POST /api/v1/update/order?tracking=&client=&tel=... (query params only)
// Only works before validation — after validation the order is locked at the carrier.

export interface EcotrackUpdateOrderParams {
  tracking: string;
  client?: string;
  tel?: string;
  tel2?: string;
  adresse?: string;
  code_postal?: string;
  commune?: string;
  wilaya?: number;
  montant?: number;
  remarque?: string;
  product?: string;
  boutique?: string;
  type?: 1 | 2 | 3 | 4;
  stop_desk?: 0 | 1;
  fragile?: 0 | 1;
  gps_link?: string;
}

export interface EcotrackUpdateOrderResponse {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── Delete Order ─────────────────────────────────────────────────────────────
// DELETE /api/v1/delete/order?tracking=
// Only works before validation.
// Response body example: {"delete":"success"} or {"delete":"fail"}

export interface EcotrackDeleteOrderResponse {
  success?: boolean;
  delete?: "success" | "fail";
  message?: string;
}

// ─── Add Remark (maj) ────────────────────────────────────────────────────────
// POST /api/v1/add/maj?tracking=&content=
// Works at any time after dispatch (before or after validation).

export interface EcotrackAddMajResponse {
  success?: boolean;
  message?: string;
}

// ─── Get Remarks (maj list) ──────────────────────────────────────────────────
// GET /api/v1/get/maj?tracking=
// ⚠️ Real response: a direct JSON array — NOT wrapped in { data: [] }
//
// Real response shape (tested 2026-04-18):
// [
//   {
//     "remarque": "test sender : Test remark from API direct call",
//     "commentaires": "",
//     "station": "",
//     "livreur": "",
//     "created_at": "2026-04-18 19:54:03",
//     "tracking": "ECWA372604181429723"
//   }
// ]
//
// Note: `remarque` is prefixed with sender name + " : " (e.g. "test sender : content").

export interface EcotrackMajEntry {
  remarque?: string;     // "senderName : content"
  commentaires?: string;
  station?: string;
  livreur?: string;
  created_at?: string;
  tracking?: string;
}

// The real response is a plain array — not an object wrapper
export type EcotrackGetMajResponse = EcotrackMajEntry[];

// ─── Tracking Info ────────────────────────────────────────────────────────────
// GET /api/v1/get/tracking/info?tracking=
// ⚠️ Real response: object with `activity` array — NOT { data: [] }
//
// Real response shape (tested 2026-04-18):
// {
//   "recipientName": "ahmed benali",
//   "shippedBy": "test store",
//   "originCity": 26,
//   "destLocationCity": 1,
//   "currentStation": "Médéa",
//   "activity": [
//     { "date": "2026-04-18", "time": "19:45:06", "status": "order_information_received_by_carrier", "station": "" }
//   ],
//   "reasons": []
// }
//
// Known status values (docs + tested):
//   order_information_received_by_carrier | notification_on_order | picked
//   accepted_by_carrier | dispatched_to_driver | attempt_delivery
//   return_asked | return_in_transit | Return_received | livred | encaissed | payed
//
// Note: `notification_on_order` is triggered when a remark (maj) is added — not in docs.

export interface EcotrackTrackingActivity {
  date?: string;    // "2026-04-18"
  time?: string;    // "19:45:06"
  status?: string;  // activity type key
  station?: string;
}

export interface EcotrackTrackingInfoResponse {
  recipientName?: string;
  shippedBy?: string;
  originCity?: number;
  destLocationCity?: number;
  currentStation?: string;
  activity?: EcotrackTrackingActivity[];
  reasons?: unknown[];
}

// ─── Bulk Create Orders ───────────────────────────────────────────────────────
// POST /api/v1/create/orders — JSON body, up to 100 orders
// ⚠️ Body uses OBJECT keyed by index string, NOT a JSON array:
//    { "orders": { "0": {...}, "1": {...} } }

export interface EcotrackBulkCreateBody {
  orders: Record<string, Omit<EcotrackCreateOrderParams, never>>;
}

export type EcotrackBulkCreateResult = {
  results: Record<
    string,
    | { success: true; tracking: string }
    | Record<string, string[]>
  >;
};

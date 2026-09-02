/**
 * EcoTrack API — Request / Response Types
 * Auth: Authorization: Bearer {api_token}  (no user_guid in body)
 * Base URL: configurable per account (stored in delivery_companies.api_endpoint)
 *
 * Used by: Packers (https://packers.ecotrack.dz) and any other EcoTrack-platform company.
 */

// ─── Desks ────────────────────────────────────────────────────────────────────
// GET /api/v1/get/desks — the sender's own desk + the carrier's other stations.
// ⚠️ No postal/station codes here: dispatch's Station Code authority stays
// get/communes (code_postal). This data is DISPLAY enrichment (address,
// phones, map, hours) — it cannot join reliably to the communes-based
// stop-desk rows (name matching across sources is fuzzy).

export interface EcotrackDeskLocation {
  wilaya?: string;
  commune?: string;
  adresse?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  map?: string | null;
}

export interface EcotrackMyDesk {
  hub_id?: number;
  hub_name?: string;
  location?: EcotrackDeskLocation;
  working_hours?: Array<{ days?: string; hours?: string }>;
}

export interface EcotrackOtherDesk {
  name?: string;
  phone?: string | null;
  phone2?: string | null;
  code_wilaya?: string;
  wilaya?: string;
  commune?: string;
  adresse?: string | null;
  map?: string | null;
}

export interface EcotrackDesksResponse {
  my_desk?: EcotrackMyDesk;
  other_desks?: EcotrackOtherDesk[];
}

// ─── Returns ──────────────────────────────────────────────────────────────────
// POST /api/v1/ask/for/order/return?tracking=  (query params)
// Only while the parcel is in delivery; the courier MAY ignore the request.

export interface EcotrackAskReturnResponse {
  success?: boolean;
  /** 10003 = return cannot be requested for this order. */
  error?: number;
  message?: string;
}

// POST /api/v1/valid/returns  (JSON body {trackings: [...]})
// Sender confirms physical reception of returned parcels.
// {returned:"fail"} = nothing eligible (already received / not transferred).

export interface EcotrackValidReturnsResponse {
  returned?: "success" | "fail";
}

// ─── Token Validation ─────────────────────────────────────────────────────────
// GET /api/v1/validate/token?api_token={token}
// ⚠️ Auth exception: the token travels as a QUERY PARAM — the Bearer header
// alone does NOT authenticate this endpoint.

export interface EcotrackValidateTokenResponse {
  success?: boolean;
  /** VALID_TOKEN | INVALID_TOKEN | TOKEN_NOT_ALLOWED */
  message?: string;
}

// ─── Wilayas ──────────────────────────────────────────────────────────────────
// GET /api/v1/get/wilayas — plain array of the wilayas THIS tenant serves.
// Absent ids = not served (create/order with such a wilaya answers error 10002).

export interface EcotrackWilaya {
  wilaya_id: number;
  wilaya_name: string;
}

export type EcotrackWilayasResponse = EcotrackWilaya[];

// ─── Bulk Tracking ────────────────────────────────────────────────────────────
// GET /api/v1/get/trackings/info?trackings[]=a&trackings[]=b  (max 100)
//
// ⚠️ UNVERIFIED SHAPE: the Postman collection documents no success example
// (only a 422). dzship's guide warns the endpoint "answers list-style queries"
// where a lazy client can attach the wrong parcel's status — so the adapter
// parses defensively (array rows with a tracking field OR an object keyed by
// tracking) and matches entries to REQUESTED tracking numbers only, never
// positionally. `status` here is the tenant-drifted French display wording —
// pass through raw; mapping to our statuses happens in the reconciliation layer.

export interface EcotrackBulkTrackingEntry {
  tracking: string;
  status?: string;
  activity?: EcotrackTrackingActivity[];
  [key: string]: unknown;
}

// ─── Orders List ──────────────────────────────────────────────────────────────
// GET /api/v1/get/orders?page=&start_date=&end_date=&tracking=
// Laravel pagination, 40/page, default window = last 90 days, archived excluded.

export interface EcotrackOrderRow {
  tracking: string;
  reference: string | null;
  client: string;
  phone: string;
  phone_2: string | null;
  adresse: string;
  commune: string;
  wilaya_id: number;
  montant: string;
  tarif_prestation: string;
  tarif_retour: string;
  type_id: number;
  created_at: string;
  payment_id: number | null;
  return_id: number | null;
  /** Status enum key (e.g. "prete_a_expedier") — NOT the French display wording. */
  status: string;
  products: string | null;
}

export interface EcotrackOrdersPage {
  current_page: number;
  data: EcotrackOrderRow[];
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

// ─── Orders Status Filter ─────────────────────────────────────────────────────
// GET /api/v1/get/orders/status?api_token=…&trackings=a,b,c&status=en_livraison,…
// ⚠️ Auth exception: api_token travels as a QUERY PARAM — Bearer alone does not
// authenticate this endpoint. Max 100 trackings per request.

export interface EcotrackOrderStatusActivity {
  reason?: string;
  details?: string;
  station?: string;
  driver?: string;
  date?: string;
  time?: string;
  postponed_to?: string | null;
}

export interface EcotrackOrderStatusEntry {
  status?: string;
  order_id?: string;
  desk_phone?: string;
  desk_commune?: string;
  desk_map_link?: string;
  desk_address?: string;
  driver_phone?: string;
  activity?: EcotrackOrderStatusActivity[];
}

export interface EcotrackOrdersStatusResponse {
  data: Record<string, EcotrackOrderStatusEntry>;
}

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
  /** Business error code on success=false (10002 = wilaya not served, …). */
  error?: number;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── Validate / Ship Order ────────────────────────────────────────────────────
// POST /api/v1/valid/order?tracking={tracking}&ask_collection={0|1}

export interface EcotrackValidateOrderResponse {
  success?: boolean;
  error?: number;
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
  /** Business error code on success=false (10001 = order not modifiable). */
  error?: number;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── Delete Order ─────────────────────────────────────────────────────────────
// DELETE /api/v1/delete/order?tracking=
// Only works before validation.
// Response body example: {"delete":"success"} or {"delete":"fail"}

export interface EcotrackDeleteOrderResponse {
  success?: boolean;
  error?: number;
  delete?: "success" | "fail";
  message?: string;
}

// ─── Add Remark (maj) ────────────────────────────────────────────────────────
// POST /api/v1/add/maj?tracking=&content=
// Works at any time after dispatch (before or after validation).

export interface EcotrackAddMajResponse {
  success?: boolean;
  error?: number;
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

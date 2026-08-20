/**
 * NOEST API — Request / Response Types
 * Base URL: https://app.noest-dz.com
 * Auth: Authorization: Bearer {api_token}  +  user_guid in body
 */

// ─── Create Order ─────────────────────────────────────────────────────────────

export interface NoestCreateOrderRequest {
  user_guid: string;
  reference?: string;
  client: string;
  phone: string;
  phone_2?: string;
  adresse: string;
  wilaya_id: number;
  commune: string;
  montant: number;
  produit: string;
  /** 1=Delivery, 2=Exchange, 3=Pick-up */
  type_id: 1 | 2 | 3;
  /** 0=Home delivery, 1=Stop-desk */
  stop_desk: 0 | 1;
  station_code?: string;
  remarque?: string;
  /** 0=No, 1=Yes */
  can_open?: 0 | 1;
  poids?: number;
  stock?: 0 | 1;
  quantite?: string;
  shop_name?: string;
  zip_code?: string;
  remboursement?: 0 | 1;
  station_expedition?: number;
}

export interface NoestCreateOrderResponse {
  success?: boolean;
  tracking?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── Validate Order ───────────────────────────────────────────────────────────

export interface NoestValidateOrderRequest {
  user_guid: string;
  tracking: string;
}

export interface NoestValidateOrderResponse {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

// ─── Bulk Create Orders ───────────────────────────────────────────────────────
// POST /api/public/create/orders
// ✅ orders is a real JSON array (unlike EcoTrack which uses object-keyed format)

export interface NoestBulkCreateRequest {
  user_guid: string;
  orders: Omit<NoestCreateOrderRequest, "user_guid">[];
}

/**
 * ✅ VERIFIED: passed is an ARRAY, not an object
 * Real response: { "passed": [{success: true, tracking: "..."}, ...], "failed": [] }
 */
export interface NoestBulkCreateResponse {
  success?: boolean;
  passed?: Array<{ success: true; tracking: string; reference?: string; regional_hub_name?: string; wilaya_rank?: string }>;
  failed?: Array<Record<string, string[]>>;
}

// ─── Bulk Validate Orders ─────────────────────────────────────────────────────
// POST /api/public/valid/orders

export interface NoestBulkValidateRequest {
  user_guid: string;
  trackings: string[];
}

export interface NoestBulkValidateResponse {
  success?: boolean;
  /** Object keyed by tracking when non-empty; Noest returns [] (empty array) when nothing passed. */
  passed?: Record<string, true> | unknown[];
  failed?: Record<string, Record<string, string[]> | string>;
}

// ─── Stop Desks ───────────────────────────────────────────────────────────────
// GET /api/public/desks
// Response is a plain dict at the top level — no { success, data } wrapper.
// e.g. { "01A": { code: "1A", name: "Adrar", address: "...", phones: {"0": "..."}, email: "..." } }

/**
 * ✅ VERIFIED: API returns commune and map fields
 * Real response includes: code, commune, name, address, map, phones, email
 */
export interface NoestStopDesk {
  code: string;
  name: string;
  commune?: string;  // ✅ VERIFIED: Returned by API (e.g. "Adrar")
  address?: string;
  map?: string;      // ✅ VERIFIED: Google Maps link
  /** NOEST returns phones as an object {"0": "...", "1": "...", ...}, not an array. */
  phones?: Record<string, string>;
  email?: string;
  // NOTE: wilaya_id is NOT returned by the API — wilaya is inferred from the code prefix (e.g. "16A" → 16)
}

/** The full /api/public/desks response is a plain dict keyed by station code. */
export type NoestStopDesksResponse = Record<string, NoestStopDesk>;

// ─── Update Order ─────────────────────────────────────────────────────────────
// POST /api/public/update/order
// ✅ VERIFIED: Only works before validation

export interface NoestUpdateOrderRequest {
  tracking: string;
  client?: string;
  tel?: string;
  tel2?: string;
  adresse?: string;
  wilaya?: number;
  commune?: string;
  montant?: number;
  remarque?: string;
  product?: string;
  type?: 1 | 2 | 3;
  poids?: number;
  stop_desk?: 0 | 1;
}

export interface NoestUpdateOrderResponse {
  success?: boolean;
  message?: string;
}

// ─── Delete Order ─────────────────────────────────────────────────────────────
// POST /api/public/delete/order
// ✅ VERIFIED: Only works before validation

export interface NoestDeleteOrderRequest {
  user_guid: string;
  tracking: string;
}

export interface NoestDeleteOrderResponse {
  success?: boolean;
  message?: string;
}

// ─── Add Remark ───────────────────────────────────────────────────────────────
// POST /api/public/add/maj
// ✅ VERIFIED: Works at any time

export interface NoestAddRemarkRequest {
  tracking: string;
  content: string;
}

export interface NoestAddRemarkResponse {
  success?: boolean;
  message?: string;
}

// ─── Get Tracking Info ────────────────────────────────────────────────────────
// POST /api/public/get/trackings/info
// ✅ VERIFIED: Response structure from real API

export interface NoestTrackingActivity {
  event_key?: string;    // Machine-readable: "upload", "customer_validation", etc.
  event?: string;        // Human-readable: "Uploadé sur le système", "Validé", etc.
  causer?: string;       // "PARTENAIRE", "NOEST", etc.
  "badge-class"?: string;
  by?: string;           // Who performed the action
  name?: string;
  driver?: string;
  content?: string;      // Remark content (for mise_a_jour events)
  fdr?: string;
  date?: string;         // "2026-04-24 23:36:21"
}

export interface NoestDeliveryAttempt {
  causer?: string;
  driver?: string;
  content?: string;
  created_at?: string;
}

export interface NoestOrderInfo {
  tracking?: string;
  reference?: string;
  client?: string;
  phone?: string;
  phone_2?: string;
  adresse?: string;
  wilaya_id?: number;
  commune?: string;
  montant?: string;
  remarque?: string;
  produit?: string;
  driver_name?: string;
  driver_phone?: string;
  type_id?: number;
  stop_desk?: number;
  created_at?: string;
}

export interface NoestTrackingInfoData {
  OrderInfo?: NoestOrderInfo;
  recipientName?: string;
  shippedBy?: string;
  originCity?: number;
  destLocationCity?: number;
  activity?: NoestTrackingActivity[];
  deliveryAttempts?: NoestDeliveryAttempt[];
}

/** Response is keyed by tracking number */
export type NoestTrackingInfoResponse = Record<string, NoestTrackingInfoData>;

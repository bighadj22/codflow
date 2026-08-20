/**
 * Yalidine API — Request / Response Types
 * Base URL: https://api.yalidine.app/v1/
 * Auth: X-API-ID header (apiId) + X-API-TOKEN header (apiToken)
 */

// ─── Create Parcel ────────────────────────────────────────────────────────────
// POST /v1/parcels/ — body is an array of parcel objects

export interface YalidineCreateParcelData {
  order_id: string;
  from_wilaya_name: string;
  firstname: string;
  familyname: string;
  contact_phone: string;
  address: string;
  to_commune_name: string;
  to_wilaya_name: string;
  product_list: string;
  price: number;
  do_insurance: boolean;
  declared_value: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  freeshipping: boolean;
  is_stopdesk: boolean;
  stopdesk_id?: number | null;
  has_exchange: boolean;
  product_to_collect?: string | null;
}

// Response is keyed by order_id
export interface YalidineCreateParcelItem {
  success: boolean;
  order_id: string;
  tracking: string | null;
  import_id: number | null;
  label: string | null;
  labels: string | null;
  message: string;
}

export type YalidineCreateParcelResponse = Record<string, YalidineCreateParcelItem>;

// ─── Centers (Stop Desks) ─────────────────────────────────────────────────────
// GET /v1/centers/

export interface YalidineCenter {
  center_id: number;
  name: string;
  address: string;
  gps: string;
  commune_id: number;
  commune_name: string;
  wilaya_id: number;
  wilaya_name: string;
}

export interface YalidineCenterList {
  has_more: boolean;
  total_data: number;
  data: YalidineCenter[];
  links?: { self: string; next?: string };
}

// ─── Update Parcel ────────────────────────────────────────────────────────────
// PATCH /v1/parcels/:tracking

export interface YalidineUpdateParcelRequest {
  firstname?: string;
  familyname?: string;
  contact_phone?: string;
  address?: string;
  to_commune_name?: string;
  to_wilaya_name?: string;
  from_wilaya_name?: string;
  product_list?: string;
  price?: number;
  do_insurance?: boolean;
  declared_value?: number;
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
  freeshipping?: boolean;
  is_stopdesk?: boolean;
  stopdesk_id?: number | null;
  has_exchange?: boolean;
  product_to_collect?: string | null;
}

export interface YalidineUpdateParcelResponse {
  tracking: string;
  order_id: string;
  firstname: string;  // Note: Masked in response
  familyname: string;  // Note: Masked in response
  contact_phone: string;  // Note: Masked in response
  address: string;  // Note: Masked in response
  from_wilaya_name: string;
  to_commune_name: string;
  to_wilaya_name: string;
  product_list: string;
  length: number;
  height: number;
  width: number;
  weight: number;
  price: number;
  declared_value: number;
  do_insurance: number;
  freeshipping: boolean;
  is_stopdesk: number;
  stopdesk_id: number | null;
  has_exchange: number;
  product_to_collect: string | null;
  label: string;
}

// ─── Delete Parcel ────────────────────────────────────────────────────────────
// DELETE /v1/parcels/:tracking or DELETE /v1/parcels/?tracking=X,Y,Z

export interface YalidineDeleteParcelItem {
  tracking: string;
  deleted: boolean;
}

export type YalidineDeleteParcelResponse = YalidineDeleteParcelItem[];

// ─── Tracking History ─────────────────────────────────────────────────────────
// GET /v1/histories/:tracking

export interface YalidineHistoryItem {
  date_status: string;
  tracking: string;
  status: string;
  reason: string;
  center_id: number | null;
  center_name: string | null;
  wilaya_id: number | null;
  wilaya_name: string | null;
  commune_id: number | null;
  commune_name: string | null;
}

export interface YalidineHistoryResponse {
  has_more: boolean;
  total_data: number;
  data: YalidineHistoryItem[];
  links?: { self: string; next?: string };
}

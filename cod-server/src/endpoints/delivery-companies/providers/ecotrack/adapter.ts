/**
 * EcoTrack Delivery Provider Adapter
 *
 * Implements the DeliveryProvider interface for any EcoTrack-platform company
 * (e.g. Packers — https://packers.ecotrack.dz).
 *
 * Auth:     Authorization: Bearer {api_token}
 * Base URL: configurable per account (from company.apiEndpoint)
 *
 * Endpoints used:
 *  createShipment     → POST   /api/v1/create/order      (query params, no body)
 *  validateShipment   → POST   /api/v1/valid/order?tracking=&ask_collection=
 *  getLabelUrl        → GET    /api/v1/get/order/label?tracking=  (returns PDF)
 *  createShipmentsBulk→ POST   /api/v1/create/orders     (JSON body, object-keyed)
 *  getStopDesks       → GET    /api/v1/get/communes       (filter has_stop_desk===1)
 */

import type {
  DeliveryProvider,
  CreateShipmentInput,
  CreateShipmentResult,
  UpdateShipmentInput,
  ShipmentRemark,
  TrackingEvent,
  StopDesk,
} from "../types";
import { flattenErrorBag } from "../utils";
import type {
  EcotrackCreateOrderResponse,
  EcotrackValidateOrderResponse,
  EcotrackUpdateOrderResponse,
  EcotrackDeleteOrderResponse,
  EcotrackAddMajResponse,
  EcotrackGetMajResponse,
  EcotrackTrackingInfoResponse,
  EcotrackCommunesResponse,
  EcotrackBulkCreateBody,
  EcotrackBulkCreateResult,
} from "./types";

export class EcotrackProvider implements DeliveryProvider {
  readonly code = "ecotrack";

  constructor(
    private readonly apiToken: string,
    private readonly baseUrl: string
  ) {}

  // ─── HTTP helpers ────────────────────────────────────────────────────────────

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async get<TRes>(path: string): Promise<TRes> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`EcoTrack HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `EcoTrack HTTP ${res.status}`);
    }
    return json as TRes;
  }

  /**
   * POST with query params only — EcoTrack single-order endpoints use no request body.
   * `pathWithQuery` should already include the full query string.
   */
  private async postParams<TRes>(pathWithQuery: string): Promise<TRes> {
    const res = await fetch(`${this.baseUrl}${pathWithQuery}`, {
      method: "POST",
      headers: this.headers(),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`EcoTrack HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `EcoTrack HTTP ${res.status}`);
    }
    return json as TRes;
  }

  /**
   * DELETE with query params — used by delete/order endpoint.
   */
  private async deleteParams<TRes>(pathWithQuery: string): Promise<TRes> {
    const res = await fetch(`${this.baseUrl}${pathWithQuery}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`EcoTrack HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `EcoTrack HTTP ${res.status}`);
    }
    return json as TRes;
  }

  /**
   * POST with JSON body — used by bulk create endpoint.
   */
  private async postJson<TRes>(path: string, body: unknown): Promise<TRes> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`EcoTrack HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `EcoTrack HTTP ${res.status}`);
    }
    return json as TRes;
  }

  // ─── DeliveryProvider interface ───────────────────────────────────────────────

  /**
   * Create a shipment.
   * Sends all fields as query params (EcoTrack's single-order endpoint has no JSON body).
   * Immediately constructs the label URL from the returned tracking number.
   *
   * FIX: canOpen is NOT mapped to fragile — they are semantically different.
   * EcoTrack `fragile` = package contains fragile items (handle with care).
   * There is no EcoTrack equivalent for canOpen (opening authorization).
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const params = new URLSearchParams();
    params.set("nom_client",  input.customerName);
    params.set("telephone",   input.phone);
    params.set("adresse",     input.address);
    params.set("code_wilaya", String(input.wilayaId));
    params.set("commune",     input.commune);
    params.set("montant",     String(input.amount));
    params.set("type",        "1"); // 1 = Livraison (standard delivery)

    if (input.phone2)             params.set("telephone_2",  input.phone2);
    if (input.reference)          params.set("reference",    input.reference);
    if (input.stationCode)        params.set("code_postal",  input.stationCode);
    if (input.stopDesk != null)   params.set("stop_desk",    input.stopDesk ? "1" : "0");
    if (input.productDescription) params.set("produit",      input.productDescription);
    if (input.remarks)            params.set("remarque",     input.remarks);
    if (input.weight != null)     params.set("weight",       String(input.weight));
    if (input.fragile != null)    params.set("fragile",      input.fragile ? "1" : "0");

    const res = await this.postParams<EcotrackCreateOrderResponse>(
      `/api/v1/create/order?${params.toString()}`
    );

    if (!res.success || !res.tracking) {
      const detail = flattenErrorBag(res.errors);
      throw new Error(detail ?? res.message ?? "EcoTrack: create order failed");
    }

    return {
      trackingNumber: res.tracking,
      labelUrl: this.getLabelUrl(res.tracking),
      rawResponse: res,
    };
  }

  /**
   * Validate (ship) a created order.
   * After validation the order is locked — no more modifications or deletions.
   *
   * @param trackingNumber  Tracking number returned by createShipment
   * @param askCollection   true = request courier pickup at your location (default: false)
   */
  async validateShipment(trackingNumber: string, askCollection?: boolean): Promise<boolean> {
    const params = new URLSearchParams({ tracking: trackingNumber });
    if (askCollection != null) {
      params.set("ask_collection", askCollection ? "1" : "0");
    }
    const res = await this.postParams<EcotrackValidateOrderResponse>(
      `/api/v1/valid/order?${params.toString()}`
    );
    if (res.success === false) {
      throw new Error(res.message ?? "EcoTrack: validate failed");
    }
    return true;
  }

  /**
   * Update a shipment at the carrier API.
   *
   * ✅ Works ONLY on unvalidated orders (before valid/order is called).
   *    Packers returns success=true on validated orders but silently ignores the change.
   *    Tested 2026-04-18: ECWA372604181429862 validated → update call returned success=true
   *    but recipientName at Packers was unchanged. The docs saying "before validation only"
   *    are correct — Packers just doesn't surface the error on already-validated orders.
   *
   * ⚠️  Despite the docs saying all fields are optional, Packers requires these on every call:
   *    tracking, type, wilaya, commune, adresse, montant, tel
   *    The caller is responsible for supplying all required fields.
   */
  async updateShipment(trackingNumber: string, input: UpdateShipmentInput): Promise<boolean> {
    const params = new URLSearchParams({ tracking: trackingNumber });
    // type=1 (Livraison) is required on every update call — Packers rejects requests without it.
    params.set("type", "1");
    if (input.customerName != null) params.set("client",   input.customerName);
    if (input.phone        != null) params.set("tel",      input.phone);
    if (input.phone2       != null) params.set("tel2",     input.phone2);
    if (input.address      != null) params.set("adresse",  input.address);
    if (input.commune      != null) params.set("commune",  input.commune);
    if (input.wilayaId     != null) params.set("wilaya",   String(input.wilayaId));
    if (input.amount       != null) params.set("montant",  String(input.amount));
    if (input.remarks      != null) params.set("remarque", input.remarks);
    if (input.fragile      != null) params.set("fragile",  input.fragile ? "1" : "0");
    if (input.weight       != null) params.set("weight",   String(input.weight));

    const res = await this.postParams<EcotrackUpdateOrderResponse>(
      `/api/v1/update/order?${params.toString()}`
    );
    if (res.success === false) {
      const detail = flattenErrorBag(res.errors);
      throw new Error(detail ?? res.message ?? "EcoTrack: update order failed");
    }
    return true;
  }

  /**
   * Delete a shipment at the carrier API.
   * Only works before validation — after valid/order the order cannot be deleted.
   * Returns true on success; throws on failure or if carrier rejects deletion.
   */
  async deleteShipment(trackingNumber: string): Promise<boolean> {
    const params = new URLSearchParams({ tracking: trackingNumber });
    const res = await this.deleteParams<EcotrackDeleteOrderResponse>(
      `/api/v1/delete/order?${params.toString()}`
    );
    if (res.delete === "fail" || res.success === false) {
      throw new Error(res.message ?? "EcoTrack: shipment cannot be deleted — it may already be validated");
    }
    return true;
  }

  /**
   * Add a remark/note to a shipment.
   * Available at any time after dispatch (before or after validation).
   * The note is visible to both the carrier and the sender.
   */
  async addRemark(trackingNumber: string, content: string): Promise<boolean> {
    const params = new URLSearchParams({ tracking: trackingNumber, content });
    const res = await this.postParams<EcotrackAddMajResponse>(
      `/api/v1/add/maj?${params.toString()}`
    );
    if (res.success === false) {
      throw new Error(res.message ?? "EcoTrack: failed to add remark");
    }
    return true;
  }

  /**
   * Fetch the list of remarks (mises à jour) for a shipment.
   * Includes notes added by both the sender and the courier.
   *
   * ⚠️ Real response: a plain JSON array — NOT wrapped in { data: [] }.
   * Each entry's `remarque` field is prefixed with the sender name: "Name : content".
   */
  async getRemarks(trackingNumber: string): Promise<ShipmentRemark[]> {
    const params = new URLSearchParams({ tracking: trackingNumber });
    const res = await this.get<EcotrackGetMajResponse>(
      `/api/v1/get/maj?${params.toString()}`
    );
    const entries = Array.isArray(res) ? res : [];
    return entries.map((e) => ({
      content:   e.remarque ?? "",
      createdAt: e.created_at,
    }));
  }

  /**
   * Fetch the full tracking history for a shipment.
   * Returns chronological events from the carrier.
   *
   * ⚠️ Real response: object with `activity` array — NOT { data: [] }.
   * Each activity entry has `{ date, time, status, station }`.
   * The `status` field is the activity type key (not an `activity` field).
   * Combined datetime: `"${date} ${time}"`.
   *
   * Includes `notification_on_order` events (triggered by remarks) — not in docs.
   */
  async getTrackingInfo(trackingNumber: string): Promise<TrackingEvent[]> {
    const params = new URLSearchParams({ tracking: trackingNumber });
    const res = await this.get<EcotrackTrackingInfoResponse>(
      `/api/v1/get/tracking/info?${params.toString()}`
    );
    const events = res.activity ?? [];
    return events.map((e) => ({
      activity: e.status ?? "",
      date:     e.date && e.time ? `${e.date} ${e.time}` : e.date,
    }));
  }

  /**
   * Create multiple shipments in a single API call (up to 100 orders).
   *
   * ⚠️ EcoTrack's bulk body format is an OBJECT keyed by index string, NOT a JSON array:
   *    { "orders": { "0": {...}, "1": {...} } }
   *
   * @returns Array of results parallel to inputs — each has either trackingNumber or error
   */
  async createShipmentsBulk(
    inputs: CreateShipmentInput[]
  ): Promise<Array<{ input: CreateShipmentInput; trackingNumber?: string; labelUrl?: string; error?: string }>> {
    if (inputs.length === 0) return [];
    if (inputs.length > 100) throw new Error("EcoTrack: bulk create limit is 100 orders per request");

    const ordersObj: Record<string, Record<string, unknown>> = {};
    inputs.forEach((input, i) => {
      const order: Record<string, unknown> = {
        nom_client:  input.customerName,
        telephone:   input.phone,
        adresse:     input.address,
        code_wilaya: String(input.wilayaId),
        commune:     input.commune,
        montant:     String(input.amount),
        type:        "1",
      };
      if (input.phone2)             order.telephone_2  = input.phone2;
      if (input.reference)          order.reference    = input.reference;
      if (input.stationCode)        order.code_postal  = input.stationCode;
      if (input.stopDesk != null)   order.stop_desk    = input.stopDesk ? 1 : 0;
      if (input.productDescription) order.produit      = input.productDescription;
      if (input.remarks)            order.remarque     = input.remarks;
      if (input.weight != null)     order.weight       = input.weight;
      if (input.fragile != null)    order.fragile      = input.fragile ? 1 : 0;
      ordersObj[String(i)] = order;
    });

    const body: EcotrackBulkCreateBody = { orders: ordersObj as EcotrackBulkCreateBody["orders"] };
    const res = await this.postJson<EcotrackBulkCreateResult>("/api/v1/create/orders", body);

    return inputs.map((input, i) => {
      const key = input.reference ?? String(i);
      const resultEntry = res.results?.[key] ?? res.results?.[String(i)];
      if (!resultEntry) {
        return { input, error: "No result returned for this order" };
      }
      if ("tracking" in resultEntry && resultEntry.tracking) {
        const trackingNumber = resultEntry.tracking as string;
        return { input, trackingNumber, labelUrl: this.getLabelUrl(trackingNumber) };
      }
      const errorMessages = Object.values(resultEntry as Record<string, string[]>)
        .flat()
        .join("; ");
      return { input, error: errorMessages };
    });
  }

  /**
   * Get the PDF label URL for a shipment.
   * The URL requires the same Bearer token to access (it is not a public URL).
   */
  getLabelUrl(trackingNumber: string): string {
    return `${this.baseUrl}/api/v1/get/order/label?tracking=${encodeURIComponent(trackingNumber)}`;
  }

  /**
   * Fetch the list of stop-desk stations from EcoTrack communes.
   * Only returns communes where has_stop_desk === 1.
   *
   * Response format (verified against live Packers 2026-04-23):
   *   - Top-level object keyed by internal commune id (NOT an array)
   *   - Each entry: { nom, wilaya_id, code_postal, has_stop_desk }
   *   - No `address` or `phones` fields — the API does not publish them
   *   - `code_postal` is globally unique (safe for our UNIQUE(company_id, code))
   *
   * For EcoTrack the "stop desk" IS the commune — there is no separate desk
   * name, so we set `name` to the commune label and `commune` to null. That
   * keeps the UI's Commune column meaningful for carriers that DO publish a
   * distinct commune field (Yalidine, NOEST) without showing the same string
   * twice in both columns for Packers.
   */
  async getStopDesks(): Promise<StopDesk[]> {
    const res = await this.get<EcotrackCommunesResponse>("/api/v1/get/communes");
    return Object.values(res)
      .filter((c) => c != null && c.has_stop_desk === 1)
      .map((c) => ({
        code:     c.code_postal,
        name:     c.nom,
        commune:  null,
        wilayaId: c.wilaya_id,
      }));
  }
}

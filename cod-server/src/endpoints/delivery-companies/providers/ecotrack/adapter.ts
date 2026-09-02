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
 *  verifyConnection   → GET    /api/v1/validate/token     (query-param auth)
 *  getWilayas         → GET    /api/v1/get/wilayas
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
  ConnectionCheck,
} from "../types";
import { EcoTrackApiError, ecotrackBusinessError, ecotrackHttpError } from "./errors";
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
  EcotrackValidateTokenResponse,
  EcotrackWilaya,
  EcotrackWilayasResponse,
  EcotrackBulkTrackingEntry,
  EcotrackOrdersPage,
  EcotrackOrderStatusEntry,
  EcotrackOrdersStatusResponse,
  EcotrackTrackingActivity,
  EcotrackAskReturnResponse,
  EcotrackValidReturnsResponse,
  EcotrackMyDesk,
  EcotrackOtherDesk,
  EcotrackDesksResponse,
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

  /**
   * Single HTTP entry point for every EcoTrack endpoint.
   * Single-order endpoints pass only `pathWithQuery` (query params, no body);
   * `body` is set exclusively by the JSON-body endpoints (create/orders,
   * valid/returns). All failures throw EcoTrackApiError with the business
   * code, HTTP status, or rate-limit flag attached.
   */
  private async request<TRes>(
    method: string,
    pathWithQuery: string,
    body?: string
  ): Promise<TRes> {
    const init: RequestInit = { method, headers: this.headers() };
    if (body !== undefined) init.body = body;

    const res = await fetch(`${this.baseUrl}${pathWithQuery}`, init);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new EcoTrackApiError(
        `EcoTrack HTTP ${res.status} — response is not valid JSON`,
        { statusCode: res.status }
      );
    }
    if (!res.ok) {
      throw ecotrackHttpError(res.status, json);
    }
    return json as TRes;
  }

  // ─── DeliveryProvider interface ───────────────────────────────────────────────

  /**
   * Verify the stored credentials via GET /api/v1/validate/token.
   *
   * ⚠️ Auth exception: this endpoint takes the token as a QUERY PARAM —
   * the Bearer header alone does not authenticate it.
   *
   * Enriches a valid check with the tenant's served wilaya ids (best-effort:
   * a territory failure never fails the connection check).
   */
  async verifyConnection(): Promise<ConnectionCheck> {
    const params = new URLSearchParams({ api_token: this.apiToken });
    const res = await this.request<EcotrackValidateTokenResponse>(
      "GET",
      `/api/v1/validate/token?${params.toString()}`
    );

    if (res.success && res.message === "VALID_TOKEN") {
      const details: Record<string, unknown> = {};
      try {
        const wilayas = await this.getWilayas();
        details.servedWilayaIds = wilayas.map((w) => w.wilaya_id);
        details.servedWilayaCount = wilayas.length;
      } catch {
        // Territory lookup is enrichment — a failure must not fail the check.
      }
      return {
        ok: true,
        code: "valid",
        message: "Token is valid",
        ...(Object.keys(details).length > 0 ? { details } : {}),
      };
    }

    if (res.message === "TOKEN_NOT_ALLOWED") {
      return {
        ok: false,
        code: "not_allowed",
        message: "Public API access is disabled for this account — enable it in the courier's dashboard",
      };
    }

    return {
      ok: false,
      code: "invalid_token",
      message: res.message ?? "Token is invalid",
    };
  }

  /**
   * List the wilayas this tenant serves (GET /api/v1/get/wilayas).
   * Absent ids = not served; creating an order for them answers error 10002.
   */
  async getWilayas(): Promise<EcotrackWilaya[]> {
    const res = await this.request<EcotrackWilayasResponse>("GET", "/api/v1/get/wilayas");
    return Array.isArray(res) ? res : [];
  }

  /**
   * Fetch tracking history for up to 100 parcels in one call
   * (GET /api/v1/get/trackings/info?trackings[]=…).
   *
   * ⚠️ Success shape is UNVERIFIED (no documented example). Parses defensively:
   * an array of rows carrying a `tracking` field, or an object keyed by
   * tracking (with or without a `data` wrapper). Entries are matched to the
   * REQUESTED tracking numbers only — never positionally (dzship warns a lazy
   * "take the first row" client attaches the wrong parcel's status).
   *
   * `status` is the tenant-drifted French display wording — returned raw.
   */
  async getTrackingsBulk(trackingNumbers: string[]): Promise<EcotrackBulkTrackingEntry[]> {
    if (trackingNumbers.length === 0) return [];
    if (trackingNumbers.length > 100) {
      throw new Error("EcoTrack: bulk tracking limit is 100 trackings per request");
    }

    const params = new URLSearchParams();
    for (const tracking of trackingNumbers) {
      params.append("trackings[]", tracking);
    }
    const res = await this.request<unknown>(
      "GET",
      `/api/v1/get/trackings/info?${params.toString()}`
    );

    const requested = new Set(trackingNumbers);
    const entries: EcotrackBulkTrackingEntry[] = [];

    const absorb = (tracking: unknown, row: unknown) => {
      if (typeof tracking !== "string" || !requested.has(tracking)) return;
      const obj = (row ?? {}) as Record<string, unknown>;
      entries.push({
        tracking,
        status: typeof obj.status === "string" ? obj.status : undefined,
        activity: Array.isArray(obj.activity) ? (obj.activity as EcotrackTrackingActivity[]) : undefined,
      });
    };

    if (Array.isArray(res)) {
      for (const row of res) {
        const tracking = (row as Record<string, unknown>).tracking;
        absorb(tracking, row);
      }
    } else if (res != null && typeof res === "object") {
      const container =
        "data" in (res as Record<string, unknown>) &&
        (res as Record<string, unknown>).data != null &&
        typeof (res as Record<string, unknown>).data === "object" &&
        !Array.isArray((res as Record<string, unknown>).data)
          ? ((res as Record<string, unknown>).data as Record<string, unknown>)
          : (res as Record<string, unknown>);
      for (const [tracking, row] of Object.entries(container)) {
        absorb(tracking, row);
      }
    }

    return entries;
  }

  /**
   * List this account's in-process orders with their current statuses
   * (GET /api/v1/get/orders). Laravel pagination: 40/page, default window =
   * last 90 days, archived orders excluded. Pass `tracking` to look up one order.
   */
  async getOrders(options?: {
    page?: number;
    startDate?: string;
    endDate?: string;
    tracking?: string;
  }): Promise<EcotrackOrdersPage> {
    const params = new URLSearchParams();
    if (options?.page != null)      params.set("page", String(options.page));
    if (options?.startDate)         params.set("start_date", options.startDate);
    if (options?.endDate)           params.set("end_date", options.endDate);
    if (options?.tracking)          params.set("tracking", options.tracking);

    const query = params.size > 0 ? `?${params.toString()}` : "";
    const res = await this.request<Partial<EcotrackOrdersPage>>(
      "GET",
      `/api/v1/get/orders${query}`
    );

    return {
      current_page: res.current_page ?? 1,
      data: Array.isArray(res.data) ? res.data : [],
      last_page: res.last_page ?? 1,
      per_page: res.per_page ?? 40,
      total: res.total ?? (Array.isArray(res.data) ? res.data.length : 0),
      from: res.from ?? null,
      to: res.to ?? null,
    };
  }

  /**
   * Filter orders by status for up to 100 trackings
   * (GET /api/v1/get/orders/status).
   *
   * ⚠️ Auth exception: this endpoint authenticates via an `api_token` QUERY
   * PARAM — the Bearer header alone is not accepted.
   *
   * Statuses use the sender-dashboard enum keys (prete_a_expedier, en_livraison,
   * retour_recu, annule, all, …); defaults to `all`.
   */
  async getOrdersStatus(
    trackingNumbers: string[],
    statuses?: string[]
  ): Promise<Record<string, EcotrackOrderStatusEntry>> {
    if (trackingNumbers.length === 0) return {};
    if (trackingNumbers.length > 100) {
      throw new Error("EcoTrack: status filter limit is 100 trackings per request");
    }

    const params = new URLSearchParams({ api_token: this.apiToken });
    params.set("trackings", trackingNumbers.join(","));
    params.set("status", (statuses && statuses.length > 0 ? statuses : ["all"]).join(","));

    const res = await this.request<Partial<EcotrackOrdersStatusResponse>>(
      "GET",
      `/api/v1/get/orders/status?${params.toString()}`
    );

    if (res.data != null && typeof res.data === "object" && !Array.isArray(res.data)) {
      return res.data as Record<string, EcotrackOrderStatusEntry>;
    }
    return {};
  }

  /**
   * Ask the carrier to return a parcel that is currently in delivery
   * (POST /api/v1/ask/for/order/return?tracking=).
   *
   * ⚠️ This is a REQUEST, not a state change — the courier may ignore it
   * (platform-documented). Error 10003 throws when the parcel is not in a
   * returnable state.
   */
  async askReturn(trackingNumber: string): Promise<boolean> {
    const params = new URLSearchParams({ tracking: trackingNumber });
    const res = await this.request<EcotrackAskReturnResponse>(
      "POST",
      `/api/v1/ask/for/order/return?${params.toString()}`
    );
    if (res.success === false) {
      throw ecotrackBusinessError(
        res,
        "EcoTrack: return cannot be requested for this parcel"
      );
    }
    return true;
  }

  /**
   * Confirm physical reception of returned parcels
   * (POST /api/v1/valid/returns — one of the only two JSON-body endpoints).
   *
   * Returns true when the carrier confirmed reception; false when nothing
   * was eligible (already received, not transferred, or out of scope).
   */
  async validateReturns(trackingNumbers: string[]): Promise<boolean> {
    if (trackingNumbers.length === 0) return false;

    const res = await this.request<EcotrackValidReturnsResponse>(
      "POST",
      "/api/v1/valid/returns",
      JSON.stringify({ trackings: trackingNumbers })
    );
    return res.returned === "success";
  }

  /**
   * Fetch the sender's own desk and the carrier's other stations
   * (GET /api/v1/get/desks) — address, phones, map links, working hours.
   *
   * ⚠️ Display enrichment ONLY: this endpoint publishes no station codes, so
   * dispatch's Station Code authority remains get/communes (code_postal).
   * Do not feed this into the stop-desk sync.
   */
  async getDesks(): Promise<{
    myDesk: EcotrackMyDesk | null;
    otherDesks: EcotrackOtherDesk[];
  }> {
    const res = await this.request<Partial<EcotrackDesksResponse>>(
      "GET",
      "/api/v1/get/desks"
    );

    return {
      myDesk: res.my_desk ?? null,
      otherDesks: Array.isArray(res.other_desks) ? res.other_desks : [],
    };
  }

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

    const res = await this.request<EcotrackCreateOrderResponse>(
      "POST",
      `/api/v1/create/order?${params.toString()}`
    );

    if (!res.success || !res.tracking) {
      throw ecotrackBusinessError(res, "EcoTrack: create order failed");
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
    const res = await this.request<EcotrackValidateOrderResponse>(
      "POST",
      `/api/v1/valid/order?${params.toString()}`
    );
    if (res.success === false) {
      throw ecotrackBusinessError(res, "EcoTrack: validate failed");
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

    const res = await this.request<EcotrackUpdateOrderResponse>(
      "POST",
      `/api/v1/update/order?${params.toString()}`
    );
    if (res.success === false) {
      throw ecotrackBusinessError(res, "EcoTrack: update order failed");
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
    const res = await this.request<EcotrackDeleteOrderResponse>(
      "DELETE",
      `/api/v1/delete/order?${params.toString()}`
    );
    if (res.delete === "fail" || res.success === false) {
      throw ecotrackBusinessError(
        res,
        "EcoTrack: shipment cannot be deleted — it may already be validated"
      );
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
    const res = await this.request<EcotrackAddMajResponse>(
      "POST",
      `/api/v1/add/maj?${params.toString()}`
    );
    if (res.success === false) {
      throw ecotrackBusinessError(res, "EcoTrack: failed to add remark");
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
    const res = await this.request<EcotrackGetMajResponse>(
      "GET",
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
    const res = await this.request<EcotrackTrackingInfoResponse>(
      "GET",
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
    const res = await this.request<EcotrackBulkCreateResult>(
      "POST",
      "/api/v1/create/orders",
      JSON.stringify(body)
    );

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
    const res = await this.request<EcotrackCommunesResponse>("GET", "/api/v1/get/communes");
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

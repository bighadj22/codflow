/**
 * NOEST Delivery Provider Adapter
 *
 * Implements the DeliveryProvider interface for NOEST (https://app.noest-dz.com).
 * Auth: Bearer token + user_guid in every POST request body.
 *      GET endpoints (/fees, /desks) use Bearer only.
 *
 * Endpoints used:
 *  createShipment        → POST /api/public/create/order
 *  createShipmentsBulk   → POST /api/public/create/orders   (array body, up to 100)
 *  validateShipment      → POST /api/public/valid/order
 *  validateShipmentsBulk → POST /api/public/valid/orders    (up to 100)
 *  getLabelUrl           → GET  /api/public/get/order/label?tracking=
 *  getStopDesks          → GET  /api/public/desks
 */

import type {
  DeliveryProvider,
  CreateShipmentInput,
  CreateShipmentResult,
  UpdateShipmentInput,
  TrackingEvent,
  StopDesk,
} from "../types";
import { flattenErrorBag } from "../utils";
import type {
  NoestCreateOrderRequest,
  NoestCreateOrderResponse,
  NoestValidateOrderResponse,
  NoestBulkCreateRequest,
  NoestBulkCreateResponse,
  NoestBulkValidateRequest,
  NoestBulkValidateResponse,
  NoestStopDesksResponse,
  NoestUpdateOrderRequest,
  NoestUpdateOrderResponse,
  NoestDeleteOrderResponse,
  NoestAddRemarkResponse,
  NoestTrackingInfoResponse,
} from "./types";

const BASE_URL = "https://app.noest-dz.com";

export class NoestProvider implements DeliveryProvider {
  readonly code = "noest";

  private readonly apiToken: string;
  private readonly userGuid: string;

  constructor(apiToken: string, userGuid: string) {
    this.apiToken = apiToken;
    this.userGuid = userGuid;
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────────

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`NOEST HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `NOEST HTTP ${res.status}`);
    }
    return json as TRes;
  }

  private async get<TRes>(path: string): Promise<TRes> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`NOEST HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `NOEST HTTP ${res.status}`);
    }
    return json as TRes;
  }

  // ─── DeliveryProvider interface ───────────────────────────────────────────────

  /**
   * Create a single shipment.
   * canOpen is mapped to the NOEST `can_open` field (package opening authorization).
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const payload: NoestCreateOrderRequest = {
      user_guid:  this.userGuid,
      client:     input.customerName,
      phone:      input.phone,
      adresse:    input.address,
      wilaya_id:  input.wilayaId,
      commune:    input.commune,
      montant:    input.amount,
      produit:    input.productDescription,
      type_id:    1,
      stop_desk:  input.stopDesk ? 1 : 0,
      poids:      input.weight ?? 0,
      ...(input.phone2      ? { phone_2:      input.phone2 }           : {}),
      ...(input.stationCode ? { station_code: input.stationCode }       : {}),
      ...(input.reference   ? { reference:    input.reference }         : {}),
      ...(input.remarks     ? { remarque:     input.remarks }           : {}),
      ...(input.canOpen !== undefined ? { can_open: input.canOpen ? 1 : 0 } : {}),
    };

    const res = await this.post<NoestCreateOrderRequest, NoestCreateOrderResponse>(
      "/api/public/create/order",
      payload
    );

    if (!res.tracking) {
      const detail = flattenErrorBag(res.errors);
      throw new Error(detail ?? res.message ?? "NOEST did not return a tracking number");
    }

    return {
      trackingNumber: res.tracking,
      labelUrl: this.getLabelUrl(res.tracking),
      rawResponse: res,
    };
  }

  /**
   * Create multiple shipments in one call (up to 100).
   * ✅ VERIFIED: NOEST returns passed as an ARRAY, not object-keyed
   * Real response: { "passed": [{success: true, tracking: "..."}, ...], "failed": [] }
   */
  async createShipmentsBulk(
    inputs: CreateShipmentInput[]
  ): Promise<Array<{ input: CreateShipmentInput; trackingNumber?: string; labelUrl?: string; error?: string }>> {
    if (inputs.length === 0) return [];
    if (inputs.length > 100) throw new Error("NOEST: bulk create limit is 100 orders per request");

    const orders = inputs.map((input) => ({
      client:    input.customerName,
      phone:     input.phone,
      adresse:   input.address,
      wilaya_id: input.wilayaId,
      commune:   input.commune,
      montant:   input.amount,
      produit:   input.productDescription,
      type_id:   1 as const,
      stop_desk: (input.stopDesk ? 1 : 0) as 0 | 1,
      poids:     input.weight ?? 0,
      ...(input.phone2      ? { phone_2:      input.phone2 }           : {}),
      ...(input.stationCode ? { station_code: input.stationCode }       : {}),
      ...(input.reference   ? { reference:    input.reference }         : {}),
      ...(input.remarks     ? { remarque:     input.remarks }           : {}),
      ...(input.canOpen !== undefined ? { can_open: (input.canOpen ? 1 : 0) as 0 | 1 } : {}),
    }));

    const body: NoestBulkCreateRequest = { user_guid: this.userGuid, orders };
    const res = await this.post<NoestBulkCreateRequest, NoestBulkCreateResponse>(
      "/api/public/create/orders",
      body
    );

    // ✅ VERIFIED: passed is an array, access by numeric index
    return inputs.map((input, i) => {
      const passed = res.passed?.[i];
      if (passed?.tracking) {
        const trackingNumber = passed.tracking;
        return { input, trackingNumber, labelUrl: this.getLabelUrl(trackingNumber) };
      }
      const failed = res.failed?.[i];
      if (failed) {
        const errorMsg = Object.values(failed).flat().join("; ");
        return { input, error: errorMsg };
      }
      return { input, error: "No result returned for this order" };
    });
  }

  /**
   * Validate (ship) a single order.
   * After validation the order is locked — no more modifications or deletions.
   */
  async validateShipment(trackingNumber: string): Promise<boolean> {
    const res = await this.post<{ user_guid: string; tracking: string }, NoestValidateOrderResponse>(
      "/api/public/valid/order",
      { user_guid: this.userGuid, tracking: trackingNumber }
    );
    if (res.success === false) throw new Error(res.message ?? "NOEST validate failed");
    return true;
  }

  /**
   * Validate multiple orders in one call (up to 100).
   * Returns per-tracking results — partial success is possible.
   */
  async validateShipmentsBulk(
    trackingNumbers: string[]
  ): Promise<Array<{ tracking: string; success: boolean; error?: string }>> {
    if (trackingNumbers.length === 0) return [];
    if (trackingNumbers.length > 100) throw new Error("NOEST: bulk validate limit is 100 trackings per request");

    const body: NoestBulkValidateRequest = { user_guid: this.userGuid, trackings: trackingNumbers };
    const res = await this.post<NoestBulkValidateRequest, NoestBulkValidateResponse>(
      "/api/public/valid/orders",
      body
    );

    return trackingNumbers.map((tracking) => {
      const passedMap = Array.isArray(res.passed) ? undefined : res.passed;
      if (passedMap?.[tracking]) return { tracking, success: true };
      const failed = res.failed?.[tracking];
      if (failed) {
        const errorMsg = typeof failed === "string"
          ? failed
          : Object.values(failed).flat().join("; ");
        return { tracking, success: false, error: errorMsg };
      }
      return { tracking, success: false, error: "No result returned" };
    });
  }

  /**
   * Get the PDF label URL for a shipment.
   * The URL requires the same Bearer token to download.
   */
  getLabelUrl(trackingNumber: string): string {
    return `${BASE_URL}/api/public/get/order/label?tracking=${encodeURIComponent(trackingNumber)}`;
  }

  /**
   * Fetch the list of NOEST stop-desk stations.
   * ✅ VERIFIED: API returns commune and map fields
   * wilaya_id is NOT returned — inferred from the numeric prefix of the code
   * (e.g. "16A" → 16, "01A" → 1).
   */
  async getStopDesks(): Promise<StopDesk[]> {
    const res = await this.get<NoestStopDesksResponse>("/api/public/desks");
    return Object.values(res).map((d) => {
      // NOEST codes look like "16A", "01A" — leading digits are the wilaya ID.
      // parseInt returns NaN if the string starts with letters; clamp anything
      // outside 1–58 to null so the FK to wilayas doesn't break the sync.
      const parsed = parseInt(d.code, 10);
      const wid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 58 ? parsed : null;
      return {
        code:     d.code,
        name:     d.name,
        commune:  d.commune,
        address:  d.address,
        phones:   d.phones ? Object.values(d.phones).filter(Boolean) : undefined,
        wilayaId: wid,
      };
    });
  }
  /**
   * Update a shipment at the NOEST API.
   * ✅ VERIFIED: Only works on unvalidated orders (before valid/order is called).
   * After validation returns: {"success": false, "message": "Commande non trouvée dans l'étape de modification"}
   * All fields are optional except tracking.
   */
  async updateShipment(trackingNumber: string, input: UpdateShipmentInput): Promise<boolean> {
    const payload: NoestUpdateOrderRequest = {
      tracking: trackingNumber,
    };
    
    if (input.customerName != null) payload.client = input.customerName;
    if (input.phone != null) payload.tel = input.phone;
    if (input.phone2 != null) payload.tel2 = input.phone2;
    if (input.address != null) payload.adresse = input.address;
    if (input.commune != null) payload.commune = input.commune;
    if (input.wilayaId != null) payload.wilaya = input.wilayaId;
    if (input.amount != null) payload.montant = input.amount;
    if (input.remarks != null) payload.remarque = input.remarks;
    if (input.weight != null) payload.poids = input.weight;
    
    const res = await this.post<NoestUpdateOrderRequest, NoestUpdateOrderResponse>(
      "/api/public/update/order",
      payload
    );
    
    if (res.success === false) {
      throw new Error(res.message ?? "NOEST: update order failed");
    }
    
    return true;
  }

  /**
   * Delete a shipment at the NOEST API.
   * ✅ VERIFIED: Only works before validation.
   * After validation returns: {"success": false}
   */
  async deleteShipment(trackingNumber: string): Promise<boolean> {
    const res = await this.post<
      { user_guid: string; tracking: string },
      NoestDeleteOrderResponse
    >("/api/public/delete/order", {
      user_guid: this.userGuid,
      tracking: trackingNumber,
    });
    
    if (res.success === false) {
      throw new Error("NOEST: shipment cannot be deleted — it may already be validated");
    }
    
    return true;
  }

  /**
   * Add a remark/note to a shipment.
   * ✅ VERIFIED: Works at any time (before or after validation).
   * Response: {"success": true, "message": "Mise a jour avec success"}
   */
  async addRemark(trackingNumber: string, content: string): Promise<boolean> {
    const res = await this.post<
      { tracking: string; content: string },
      NoestAddRemarkResponse
    >("/api/public/add/maj", {
      tracking: trackingNumber,
      content,
    });
    
    if (res.success === false) {
      throw new Error(res.message ?? "NOEST: failed to add remark");
    }
    
    return true;
  }

  /**
   * Fetch the full tracking history for a shipment.
   * ✅ VERIFIED: Response structure from real API test.
   * Returns chronological events from the carrier.
   * 
   * Response is keyed by tracking number:
   * { "TRACKING": { "OrderInfo": {...}, "activity": [...], "deliveryAttempts": [...] } }
   */
  async getTrackingInfo(trackingNumber: string): Promise<TrackingEvent[]> {
    const res = await this.post<
      { trackings: string[] },
      NoestTrackingInfoResponse
    >("/api/public/get/trackings/info", {
      trackings: [trackingNumber],
    });
    
    const orderData = res[trackingNumber];
    if (!orderData) {
      throw new Error("NOEST: tracking not found");
    }
    
    const events = orderData.activity ?? [];
    return events.map((e) => ({
      activity: e.event_key ?? e.event ?? "",  // Use event_key (machine-readable)
      description: e.event,  // Human-readable description
      date: e.date,
    }));
  }
}

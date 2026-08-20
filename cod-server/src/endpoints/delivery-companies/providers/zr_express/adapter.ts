/**
 * ZR Express Delivery Provider Adapter
 *
 * Implements the DeliveryProvider interface for ZR Express (https://api.zrexpress.app).
 * Auth: X-Api-Key: {secretKey}  +  X-Tenant: {tenantId}
 *
 * Key design points:
 *  - ZR uses UUID-based territories for city + district (not wilaya_id + commune strings)
 *  - No separate "validate shipment" step — parcels are active immediately after creation
 *  - Single create returns a parcel UUID; tracking number comes back in GET /parcels/{id}
 *  - Bulk create (POST /parcels/bulk) returns trackingNumber directly in the response
 *  - Territory resolution is cached in-instance (city cache keyed by wilayaId)
 *
 * Endpoints used:
 *  createShipment        → POST /v1/customers/individual + territory search + POST /v1/parcels
 *  createShipmentsBulk   → POST /v1/customers/individual (×N) + POST /v1/parcels/bulk
 *  validateShipment      → no-op (ZR auto-activates on creation)
 *  getStopDesks          → POST /v1/territories/search (deliveryType=pickup-point)
 */

import type {
  DeliveryProvider,
  CreateShipmentInput,
  CreateShipmentResult,
  StopDesk,
  TrackingEvent,
  UpdateShipmentInput,
} from "../types";
import { flattenErrorBag } from "../utils";
import type {
  ZrCreateCustomerRequest,
  ZrCreateCustomerResponse,
  ZrCreateParcelRequest,
  ZrCreateParcelResponse,
  ZrGetParcelResponse,
  ZrSearchTerritoriesRequest,
  ZrPagedListTerritories,
  ZrTerritoryItem,
  ZrSingleParcelCreationRequest,
  ZrCreateBulkParcelsRequest,
  ZrCreateBulkParcelsResponse,
  ZrStateHistoryResponse,
  ZrDeleteBulkResponse,
  ZrUpdateAmountRequest,
  ZrUpdateCustomerRequest,
  ZrUpdateDeliveryAddressRequest,
  ZrGenerateLabelRequest,
  ZrGenerateLabelResponse,
} from "./types";

const BASE_URL = "https://api.zrexpress.app";
const API_VERSION = "1";

/** UUID v4 regex — used to detect when stationCode is already a ZR territory UUID. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ZrExpressProvider implements DeliveryProvider {
  readonly code = "zr_express";

  private readonly apiToken: string;
  private readonly tenantId: string;

  /**
   * In-request city cache: wilayaId → ZR city territory UUID.
   * Populated lazily on first call that needs territory resolution.
   * Shared across all operations in this adapter instance.
   */
  private cityCache = new Map<number, ZrTerritoryItem>();

  constructor(apiToken: string, tenantId: string) {
    this.apiToken = apiToken;
    this.tenantId = tenantId;
  }

  // ─── HTTP helpers ──────────────────────────────────────────────────────────

  private parseError(json: unknown, status: number): Error {
    const j = json as {
      title?: string;
      detail?: string;
      message?: string;
      errors?: unknown;
    };
    const fieldErrors = flattenErrorBag(j.errors);
    const msg = [j.title, j.detail, fieldErrors].filter(Boolean).join(" — ")
      || j.message
      || `ZR Express HTTP ${status}`;
    return new Error(msg);
  }

  private headers(): HeadersInit {
    return {
      "X-Api-Key": this.apiToken,
      "X-Tenant": this.tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
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
      throw new Error(`ZR Express HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) throw this.parseError(json, res.status);
    return json as TRes;
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
      throw new Error(`ZR Express HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) throw this.parseError(json, res.status);
    return json as TRes;
  }

  /**
   * PATCH helper for the partial-update endpoints (`/parcels/:id/amount`,
   * `/customer`, `/deliveryAddress`). The carrier rejects POST on these with
   * HTTP 405 on the partial-update endpoints (`/parcels/:id/amount`,
   * `/customer`, `/deliveryAddress`) — verified against the ZR Express API.
   *
   * Some endpoints (e.g. /amount) return 204 No Content on success, so we
   * tolerate an empty body and return `{}` rather than blowing up on JSON.parse.
   */
  private async patch<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = text ? undefined : {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`ZR Express HTTP ${res.status} — response is not valid JSON`);
      }
    }
    if (!res.ok) throw this.parseError(json, res.status);
    return (json ?? {}) as TRes;
  }

  // ─── Territory resolution ──────────────────────────────────────────────────

  private async searchTerritories(
    keyword: string,
    extra: Partial<ZrSearchTerritoriesRequest> = {}
  ): Promise<ZrTerritoryItem[]> {
    const body: ZrSearchTerritoriesRequest = {
      keyword,
      pageSize: 50,
      pageNumber: 1,
      ...extra,
    };
    const res = await this.post<ZrSearchTerritoriesRequest, ZrPagedListTerritories>(
      `/api/v${API_VERSION}/territories/search`,
      body
    );
    return res.items ?? [];
  }

  /**
   * Resolve the ZR city territory UUID for a given wilayaId.
   * Uses the wilaya name (from CreateShipmentInput.wilaya) as a keyword,
   * then finds the matching territory by code == wilayaId and level == "wilaya".
   * Results are cached in-instance for the lifetime of this adapter.
   */
  private async resolveCityId(wilayaId: number, wilayaName: string): Promise<ZrTerritoryItem> {
    const cached = this.cityCache.get(wilayaId);
    if (cached) return cached;

    const items = await this.searchTerritories(wilayaName);
    // ✅ FIX: ZR uses "wilaya" not "state" for territory level
    const match = items.find((t) => t.code === wilayaId && t.level === "wilaya");
    if (!match) {
      const itemsByCode = await this.searchTerritories(String(wilayaId));
      const matchByCode = itemsByCode.find((t) => t.code === wilayaId && t.level === "wilaya");
      if (!matchByCode) {
        throw new Error(
          `ZR Express: Could not resolve territory for wilaya ${wilayaId} ("${wilayaName}"). ` +
          `Check that the wilaya name matches ZR Express territory names.`
        );
      }
      this.cityCache.set(wilayaId, matchByCode);
      return matchByCode;
    }

    this.cityCache.set(wilayaId, match);
    return match;
  }

  /**
   * Resolve the ZR district territory UUID for a commune name within a city.
   * For stop-desk deliveries, filters to pickup-point capable territories only.
   */
  private async resolveDistrictId(
    communeName: string,
    cityItem: ZrTerritoryItem,
    isStopDesk = false
  ): Promise<ZrTerritoryItem> {
    const extra: Partial<ZrSearchTerritoriesRequest> = isStopDesk
      ? { deliveryType: { value: "pickup-point" } }
      : {};
    const items = await this.searchTerritories(communeName, extra);

    const match = items.find((t) => t.parentId === cityItem.id);
    if (!match) {
      const fallback = items.find((t) => t.parentId != null) ?? items[0];
      if (!fallback) {
        throw new Error(
          `ZR Express: Could not resolve territory for commune "${communeName}" in ${cityItem.name ?? cityItem.id}.`
        );
      }
      return fallback;
    }
    return match;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Normalize an Algerian phone number to international format.
   * "0551234500" → "+213551234500"
   */
  private normalizePhone(phone: string): string {
    const p = phone.trim().replace(/\s+/g, "");
    if (p.startsWith("+")) return p;
    if (p.startsWith("00")) return `+${p.slice(2)}`;
    if (p.startsWith("0") && p.length === 10) return `+213${p.slice(1)}`;
    return `+${p}`;
  }

  /**
   * Create a customer in ZR Express and return their UUID.
   * ZR requires a customerId UUID when creating a parcel.
   */
  private async createZrCustomer(name: string, phone1: string, phone2?: string): Promise<string> {
    const req: ZrCreateCustomerRequest = {
      name,
      phone: {
        number1: phone1,
        ...(phone2 ? { number2: phone2 } : {}),
      },
    };
    const res = await this.post<ZrCreateCustomerRequest, ZrCreateCustomerResponse>(
      `/api/v${API_VERSION}/customers/individual`,
      req
    );
    if (!res.id) throw new Error("ZR Express: customer creation returned no ID");
    return res.id;
  }

  /**
   * Shared parcel address + customer builder.
   * Returns a parcel payload ready for single or bulk creation.
   */
  private async buildParcelPayload(input: CreateShipmentInput): Promise<ZrSingleParcelCreationRequest> {
    const phone1 = this.normalizePhone(input.phone);
    const phone2 = input.phone2 ? this.normalizePhone(input.phone2) : undefined;

    const zrCustomerId = await this.createZrCustomer(input.customerName, phone1, phone2);

    const wilayaName = input.wilaya ?? input.commune;
    const cityItem = await this.resolveCityId(input.wilayaId, wilayaName);

    let districtId: string;
    if (input.stationCode && UUID_RE.test(input.stationCode)) {
      districtId = input.stationCode;
    } else {
      const districtItem = await this.resolveDistrictId(input.commune, cityItem, input.stopDesk);
      districtId = districtItem.id;
    }

    // For pickup-point parcels ZR rejects the create call with
    // `General.Validation — HubId is required` unless we send the pickup-point
    // territory UUID as `hubId`. The desk we resolved above (districtId, which
    // for stop-desk equals the pickup-point territory UUID) IS the hub.
    const hubId = input.stopDesk ? districtId : null;

    return {
      customer: {
        customerId: zrCustomerId,
        name: input.customerName,
        phone: {
          number1: phone1,
          ...(phone2 ? { number2: phone2 } : {}),
        },
      },
      deliveryAddress: {
        cityTerritoryId: cityItem.id,
        districtTerritoryId: districtId,
        street: input.address || null,
      },
      deliveryType: input.stopDesk ? "pickup-point" : "home",
      amount: input.amount,
      description: input.productDescription,
      externalId: input.reference ?? null,
      orderedProducts: [{
        productName: input.productDescription ?? input.reference ?? "Order",
        unitPrice: input.amount,
        quantity: 1,
        stockType: "none",
      }],
      ...(hubId ? { hubId } : {}),
    };
  }

  // ─── DeliveryProvider interface ────────────────────────────────────────────

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const payload = await this.buildParcelPayload(input);

    const createRes = await this.post<ZrCreateParcelRequest, ZrCreateParcelResponse>(
      `/api/v${API_VERSION}/parcels`,
      payload as ZrCreateParcelRequest
    );

    if (!createRes.id) {
      throw new Error("ZR Express: parcel creation returned no ID");
    }

    // Fetch parcel to get tracking number (single create doesn't return it inline)
    const parcel = await this.get<ZrGetParcelResponse>(
      `/api/v${API_VERSION}/parcels/${createRes.id}`
    );

    if (!parcel.trackingNumber) {
      throw new Error(
        `ZR Express: parcel created (id=${createRes.id}) but tracking number not available yet`
      );
    }

    return {
      trackingNumber: parcel.trackingNumber,
      rawResponse: { 
        createRes, 
        parcel,
        parcelId: parcel.id, // Store parcel ID for future operations (updates, labels, tracking)
      },
    };
  }

  /**
   * Bulk dispatch — POST /v1/parcels/bulk.
   * Builds each parcel (customer create + territory resolve) then sends all in one API call.
   * Bulk response includes trackingNumber inline — no extra GET needed per parcel.
   */
  async createShipmentsBulk(
    inputs: CreateShipmentInput[]
  ): Promise<Array<{ input: CreateShipmentInput; trackingNumber?: string; labelUrl?: string; error?: string }>> {
    if (inputs.length === 0) return [];

    type BuiltEntry = { input: CreateShipmentInput; inputIdx: number; bulkIdx: number; parcel: ZrSingleParcelCreationRequest };
    const buildErrors = new Map<number, string>();
    const builtParcels: BuiltEntry[] = [];

    for (let i = 0; i < inputs.length; i++) {
      try {
        const parcel = await this.buildParcelPayload(inputs[i]);
        builtParcels.push({ input: inputs[i], inputIdx: i, bulkIdx: builtParcels.length, parcel });
      } catch (err) {
        buildErrors.set(i, err instanceof Error ? err.message : String(err));
      }
    }

    if (builtParcels.length === 0) {
      return inputs.map((input, i) => ({ input, error: buildErrors.get(i) ?? "Build error" }));
    }

    const bulkReq: ZrCreateBulkParcelsRequest = {
      parcels: builtParcels.map((e) => e.parcel),
    };

    const res = await this.post<ZrCreateBulkParcelsRequest, ZrCreateBulkParcelsResponse>(
      `/api/v${API_VERSION}/parcels/bulk`,
      bulkReq
    );

    const successByBulkIdx = new Map(
      (res.successes ?? []).map((s) => [s.index, s])
    );
    const failureByBulkIdx = new Map(
      (res.failures ?? []).map((f) => [f.index, f])
    );

    return inputs.map((input, i) => {
      if (buildErrors.has(i)) {
        return { input, error: buildErrors.get(i) };
      }

      const entry = builtParcels.find((e) => e.inputIdx === i);
      if (!entry) return { input, error: "Parcel was not built" };

      const success = successByBulkIdx.get(entry.bulkIdx);
      if (success?.trackingNumber) {
        return { input, trackingNumber: success.trackingNumber };
      }

      const failure = failureByBulkIdx.get(entry.bulkIdx);
      return { input, error: failure?.errorMessage ?? "No result from bulk API" };
    });
  }

  async validateShipment(_trackingNumber: string): Promise<boolean> {
    // ZR Express auto-validates on create — no separate validation step needed.
    return true;
  }

  /**
   * Delete a shipment by tracking number.
   * ZR uses bulk delete endpoint even for single parcels.
   */
  async deleteShipment(trackingNumber: string): Promise<boolean> {
    try {
      const res = await this.post<
        { trackingNumbers: string[] },
        ZrDeleteBulkResponse
      >(`/api/v${API_VERSION}/parcels/bulk/by-tracking-number`, {
        trackingNumbers: [trackingNumber],
      });
      return res.successCount === 1;
    } catch (err) {
      // If parcel doesn't exist or can't be deleted, return false instead of throwing
      console.error(`ZR Express: Failed to delete parcel ${trackingNumber}:`, err);
      return false;
    }
  }

  /**
   * Update shipment information.
   * ZR has separate PATCH endpoints for amount, customer, and address.
   *
   * ⚠️ The first argument MUST be the ZR **parcel UUID**, not the tracking number.
   * The handler resolves it from companyShipments.rawResponse.parcelId.
   *
   * Field coverage from UpdateShipmentInput:
   *   amount       → POST /parcels/:id/amount
   *   customerName → POST /parcels/:id/customer
   *   phone        → POST /parcels/:id/customer
   *   address      → POST /parcels/:id/deliveryAddress (street only)
   *
   * Not yet wired (would require a separate territory-resolution call):
   *   commune, wilayaId — would need cityTerritoryId / districtTerritoryId.
   *   phone2, weight, fragile, remarks — no carrier endpoint exposes these for updates.
   */
  async updateShipment(parcelId: string, input: UpdateShipmentInput): Promise<boolean> {
    try {
      if (input.amount !== undefined) {
        const amountReq: ZrUpdateAmountRequest = { parcelId, amount: input.amount };
        await this.patch(`/api/v${API_VERSION}/parcels/${parcelId}/amount`, amountReq);
      }

      if (input.customerName || input.phone) {
        const customerUpdate: ZrUpdateCustomerRequest = { parcelId };
        if (input.customerName) customerUpdate.name = input.customerName;
        if (input.phone) customerUpdate.phone = this.normalizePhone(input.phone);
        await this.patch(`/api/v${API_VERSION}/parcels/${parcelId}/customer`, customerUpdate);
      }

      if (input.address) {
        const addressUpdate: ZrUpdateDeliveryAddressRequest = {
          parcelId,
          deliveryAddress: { street: input.address },
        };
        await this.patch(`/api/v${API_VERSION}/parcels/${parcelId}/deliveryAddress`, addressUpdate);
      }

      return true;
    } catch (err) {
      console.error(`ZR Express: Failed to update parcel ${parcelId}:`, err);
      return false;
    }
  }

  /**
   * Get tracking information (state history) for a parcel.
   * Returns the parcel's state transition history as TrackingEvent array.
   * 
   * @param trackingNumber - Can be either tracking number or parcel ID (both work with ZR API)
   */
  async getTrackingInfo(trackingNumber: string): Promise<TrackingEvent[]> {
    try {
      const history = await this.get<ZrStateHistoryResponse>(
        `/api/v${API_VERSION}/parcels/${trackingNumber}/state-history`
      );

      return history.map((h) => ({
        activity: h.newState.name,
        description: h.newState.description,
        date: h.createdAt,
      }));
    } catch (err) {
      console.error(`ZR Express: Failed to get tracking info for ${trackingNumber}:`, err);
      return [];
    }
  }

  /**
   * Add a remark to a shipment.
   * 
   * ⚠️ NOT SUPPORTED: ZR Express doesn't have a dedicated remarks/notes endpoint.
   * Remarks would need to be added via the parcel update endpoint (if supported)
   * or stored separately in our system.
   * 
   * This method returns false to indicate the operation is not supported.
   * Consider storing remarks in your local database instead.
   */
  async addRemark(_parcelId: string, _content: string): Promise<boolean> {
    // ZR Express doesn't have a dedicated remarks/notes endpoint
    // Remarks would need to be added via the parcel update endpoint
    // or stored separately in our system
    console.warn("ZR Express: addRemark not supported by provider API");
    return false;
  }

  async getStopDesks(): Promise<StopDesk[]> {
    try {
      const items = await this.searchTerritories("", {
        deliveryType: { value: "pickup-point" },
        pageSize: 200,
      });
      return items
        .filter((t) => t.delivery?.hasPickupPoint)
        .map((t) => {
          // ZR territory `code` is supposed to be the wilaya number for pickup-point
          // territories at the wilaya level, but for sub-district pickup points it
          // can be undefined or a non-1–58 value. Clamp out-of-range to null so the
          // FK to wilayas doesn't break the whole sync batch.
          const wid = typeof t.code === "number" && t.code >= 1 && t.code <= 58 ? t.code : null;
          return {
            code: t.id,            // ZR stop-desk stationCode = territory UUID
            name: t.name ?? t.id,
            wilayaId: wid,
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Get label URL for a parcel by tracking number.
   * 
   * ✅ WORKING: Label generation endpoint tested and working.
   * Returns a temporary SAS URL to download the PDF label.
   * URL expires after ~1 hour.
   * 
   * @param trackingNumber - The tracking number of the parcel
   * @param format - Label format: "a4" (4 labels per page) or "a6" (1 label per page). Default: "a6"
   * @returns PDF URL or null if generation fails
   */
  async getLabelUrl(trackingNumber: string, format: "a4" | "a6" = "a6"): Promise<string | null> {
    try {
      const req: ZrGenerateLabelRequest = {
        trackingNumbers: [trackingNumber],
        format,
      };
      
      const res = await this.post<ZrGenerateLabelRequest, ZrGenerateLabelResponse>(
        `/api/v${API_VERSION}/parcels/labels/individual/pdf`,
        req
      );
      
      // Check if label was generated successfully
      if (res.parcelLabelFiles && res.parcelLabelFiles.length > 0) {
        return res.parcelLabelFiles[0].fileUrl;
      }
      
      // Check if tracking number failed
      if (res.failedTrackingNumbers && res.failedTrackingNumbers.includes(trackingNumber)) {
        console.warn(`ZR Express: Label generation failed for ${trackingNumber}`);
      }
      
      return null;
    } catch (err) {
      console.error(`ZR Express: Failed to get label for ${trackingNumber}:`, err);
      return null;
    }
  }
}

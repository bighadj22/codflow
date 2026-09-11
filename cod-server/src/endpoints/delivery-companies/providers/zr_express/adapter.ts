/**
 * ZR Express Delivery Provider Adapter
 *
 * Implements the DeliveryProvider interface for ZR Express (https://api.zrexpress.app).
 * Auth: X-Api-Key: {secretKey}  +  X-Tenant: {tenantId}
 *
 * Key design points (live-verified 2026-09-10 against the production API):
 *  - ZR uses UUID-based territories (wilaya/commune); its search is ACCENT-SENSITIVE
 *    and its territory DB stores accent-free names — all name searches run stripped.
 *  - Stop desks are HUBS (`POST /hubs/search`, isPickupPoint) — parcel creation and
 *    pickup-point address updates require a real hub id as `hubId`; a territory UUID
 *    answers 404 HubNotFound.
 *  - No separate "validate shipment" step — parcels are active immediately after creation.
 *  - Single create returns a parcel UUID; tracking number comes back in GET /parcels/{id}.
 *    GET /parcels/{trackingNumber} also works, but /state-history only accepts the UUID.
 *  - Bulk create (POST /parcels/bulk) returns trackingNumber directly in the response.
 *  - Deletes go through DELETE /parcels/bulk/by-tracking-number (POST answers 405).
 *  - Territory / hub lookups are cached in-instance.
 *
 * Endpoints used:
 *  createShipment        → POST /v1/customers/individual + territory search + POST /v1/parcels
 *  createShipmentsBulk   → POST /v1/customers/individual (×N) + POST /v1/parcels/bulk
 *  validateShipment      → no-op (ZR auto-activates on creation)
 *  updateShipment        → GET /v1/parcels/{id} + PATCH amount|customer|deliveryAddress
 *  deleteShipment        → DELETE /v1/parcels/bulk/by-tracking-number
 *  getTrackingInfo       → GET /v1/parcels/{trackingNumber} → GET /v1/parcels/{id}/state-history
 *  getStopDesks          → POST /v1/hubs/search (+ territory wilaya map)
 *  getLabelUrl           → POST /v1/parcels/labels/individual/pdf
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
  ZrHubItem,
  ZrPagedListHubs,
} from "./types";
import { stripAccents } from "./text";

const BASE_URL = "https://api.zrexpress.app";
const API_VERSION = "1";

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

  private async delete<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
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
   * Resolve the ZR city (wilaya) territory for a given wilayaId.
   *
   * Strategy (live-verified 2026-09-10 over all 58 wilayas):
   *  1. Search by the accent-stripped wilaya name — resolves 51/58 directly
   *     (ZR stores accent-free names; the raw accented name misses).
   *  2. Fallback: search by the wilaya number as keyword (page size 200 — the
   *     default page of 50 often omits the wilaya row).
   *  3. Otherwise throw. Four wilayas (33 Illizi, 37 Tindouf, 50 Bordj Badji
   *     Mokhtar, 56 Djanet) have NO territory in ZR at all — the carrier does
   *     not serve them, and parcel creation cannot proceed.
   *
   * Results are cached in-instance for the lifetime of this adapter.
   */
  private async resolveCityId(wilayaId: number, wilayaName: string): Promise<ZrTerritoryItem> {
    const cached = this.cityCache.get(wilayaId);
    if (cached) return cached;

    // ZR territory levels: "wilaya" | "commune" (never "state").
    const isTarget = (t: ZrTerritoryItem) => t.code === wilayaId && t.level === "wilaya";

    const byName = await this.searchTerritories(stripAccents(wilayaName));
    const match = byName.find(isTarget);
    if (match) {
      this.cityCache.set(wilayaId, match);
      return match;
    }

    const byCode = await this.searchTerritories(String(wilayaId), { pageSize: 200 });
    const matchByCode = byCode.find(isTarget);
    if (matchByCode) {
      this.cityCache.set(wilayaId, matchByCode);
      return matchByCode;
    }

    throw new Error(
      `ZR Express: no territory for wilaya ${wilayaId} ("${wilayaName}"). ` +
      `The carrier does not serve this wilaya (verified unserved: 33 Illizi, ` +
      `37 Tindouf, 50 Bordj Badji Mokhtar, 56 Djanet), or the name does not ` +
      `match ZR's territory list.`
    );
  }

  /**
   * Resolve the ZR district (commune) territory for a commune name within a city.
   *
   * Strict on purpose: an unmatched commune must FAIL the dispatch, never fall
   * back to an arbitrary commune (the previous `items[0]` fallback could
   * silently deliver to the wrong commune — live-verified that accented names
   * like "Bir Mourad Raïs" return 0 results while "Bir Mourad Rais" matches).
   */
  private async resolveDistrictId(
    communeName: string,
    cityItem: ZrTerritoryItem,
    isStopDesk = false
  ): Promise<ZrTerritoryItem> {
    const extra: Partial<ZrSearchTerritoriesRequest> = isStopDesk
      ? { deliveryType: { value: "pickup-point" } }
      : {};
    const items = await this.searchTerritories(stripAccents(communeName), extra);
    const communes = items.filter((t) => t.level === "commune");

    // 1) Exact: a commune whose parent is the resolved city.
    const byParent = communes.find((t) => t.parentId === cityItem.id);
    if (byParent) return byParent;

    // 2) Accent-insensitive name match among the returned communes.
    const needle = stripAccents(communeName).toLowerCase();
    const byName = communes.find((t) => stripAccents(t.name ?? "").toLowerCase() === needle);
    if (byName) return byName;

    throw new Error(
      `ZR Express: could not resolve commune "${communeName}" in ` +
      `${cityItem.name ?? cityItem.id}. Check the commune name against ZR's ` +
      `territory list (accent-free spellings).`
    );
  }

  // ─── Hub resolution (pickup points) ────────────────────────────────────────

  /** In-instance hub cache, populated lazily by loadHubs(). */
  private hubCache: ZrHubItem[] | null = null;

  /**
   * Fetch all hubs once per adapter instance. Pickup points are hubs with
   * `isPickupPoint: true` — NOT territories. Creating a pickup-point parcel
   * with a territory UUID as `hubId` fails with `HubErrors.HubNotFound`
   * (live-verified); only real hub IDs are accepted.
   */
  private async loadHubs(): Promise<ZrHubItem[]> {
    if (this.hubCache) return this.hubCache;
    const hubs: ZrHubItem[] = [];
    const pageSize = 200;
    for (let page = 1; page <= 10; page++) {
      const res = await this.post<{ pageSize: number; pageNumber: number }, ZrPagedListHubs>(
        `/api/v${API_VERSION}/hubs/search`,
        { pageSize, pageNumber: page }
      );
      const items = res.items ?? [];
      hubs.push(...items);
      const totalPages = res.totalPages ?? 1;
      if (items.length === 0 || page >= totalPages) break;
    }
    this.hubCache = hubs;
    return hubs;
  }

  /**
   * Resolve the hub backing a stop-desk station code.
   *  - New syncs store the **hub id** itself as stationCode.
   *  - Legacy syncs stored the pickup-point **territory UUID**; match it
   *    against `hub.address.districtTerritoryId` so old orders keep working.
   */
  private async resolveHubForStation(stationCode: string): Promise<ZrHubItem> {
    const hubs = await this.loadHubs();
    const byId = hubs.find((h) => h.id === stationCode);
    if (byId) return byId;
    const byDistrict = hubs.find((h) => h.address?.districtTerritoryId === stationCode);
    if (byDistrict) return byDistrict;
    throw new Error(
      `ZR Express: stop desk "${stationCode}" no longer matches any hub. ` +
      `Re-sync the stop desks for this delivery company.`
    );
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

    let cityId: string;
    let districtId: string;
    let hubId: string | null = null;
    if (input.stopDesk) {
      // Pickup-point parcels are delivered to a HUB. ZR rejects the create
      // call with `HubErrors.HubNotFound` when `hubId` is a territory UUID —
      // only real hub IDs (POST /hubs/search, isPickupPoint) are accepted.
      // The hub carries its own district + city territories, so no separate
      // territory search is needed.
      if (!input.stationCode) {
        throw new Error("ZR Express: stop-desk dispatch requires a station code (hub id).");
      }
      const hub = await this.resolveHubForStation(input.stationCode);
      districtId = hub.address?.districtTerritoryId ?? "";
      cityId = hub.address?.cityTerritoryId ?? "";
      hubId = hub.id;
      if (!districtId || !cityId) {
        throw new Error(
          `ZR Express: hub ${hub.id} has no district/city territory — cannot build the delivery address.`
        );
      }
    } else {
      const wilayaName = input.wilaya ?? input.commune;
      const cityItem = await this.resolveCityId(input.wilayaId, wilayaName);
      const districtItem = await this.resolveDistrictId(input.commune, cityItem);
      cityId = cityItem.id;
      districtId = districtItem.id;
    }

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
        cityTerritoryId: cityId,
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
    // A parcel can produce MULTIPLE validation failures for the same index
    // (live-verified: "Name is required" AND "Description is required") —
    // collect them all instead of letting a Map collapse to the last one.
    const failuresByBulkIdx = new Map<number, string[]>();
    for (const f of res.failures ?? []) {
      const message = f.errorMessage ?? f.errorCode ?? "unknown error";
      const list = failuresByBulkIdx.get(f.index) ?? [];
      list.push(message);
      failuresByBulkIdx.set(f.index, list);
    }

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

      const failures = failuresByBulkIdx.get(entry.bulkIdx);
      return { input, error: failures?.join("; ") ?? "No result from bulk API" };
    });
  }

  async validateShipment(_trackingNumber: string): Promise<boolean> {
    // ZR Express auto-validates on create — no separate validation step needed.
    return true;
  }

  /**
   * Delete a shipment by tracking number.
   * ZR uses the bulk endpoint even for single parcels — the documented method
   * is DELETE (`DELETE /api/v1/parcels/bulk/by-tracking-number`). A POST to
   * the same path answers 405 (live-verified), which is what the previous
   * implementation sent, making deletion permanently fail.
   *
   * Throws on carrier-side failure (house convention, cf. EcoTrack) so the
   * caller can surface it instead of silently resetting the order. A parcel
   * that is already gone is treated as success (idempotent cancel).
   */
  async deleteShipment(trackingNumber: string): Promise<boolean> {
    let res: ZrDeleteBulkResponse;
    try {
      res = await this.delete<
        { trackingNumbers: string[] },
        ZrDeleteBulkResponse
      >(`/api/v${API_VERSION}/parcels/bulk/by-tracking-number`, {
        trackingNumbers: [trackingNumber],
      });
    } catch (err) {
      // Parcel already deleted / never existed → cancel goal achieved.
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found/i.test(msg) || /404/.test(msg)) {
        console.warn(`ZR Express: parcel ${trackingNumber} already absent at carrier`);
        return true;
      }
      throw err;
    }

    if (res.successCount === 1) return true;

    const failures = res.failures ?? [];
    const allNotFound = failures.length > 0
      && failures.every((f) => /not found/i.test(f.errorMessage ?? ""));
    if (allNotFound) return true;

    const reason = failures.map((f) => f.errorMessage ?? f.errorCode ?? "unknown").join("; ");
    throw new Error(`ZR Express: failed to delete parcel ${trackingNumber} — ${reason}`);
  }

  /**
   * Update shipment information.
   * ZR exposes separate PATCH endpoints for amount, customer, and address.
   *
   * ⚠️ The first argument MUST be the ZR **parcel UUID**, not the tracking number.
   * The handler resolves it from companyShipments.rawResponse.parcelId.
   *
   * Verified constraints (live 2026-09-10):
   *  - `PATCH /parcels/{id}/deliveryAddress` REQUIRES the full
   *    `DeliveryAddressInputDto` (cityTerritoryId + districtTerritoryId) — a
   *    street-only body answers 400. Pickup-point parcels additionally require
   *    `hubId` (`ParcelUpdateAddressHubIdRequired`), so the hub is resolved
   *    from the parcel's district territory.
   *  - Failures THROW (surface as ExternalApiError) instead of being swallowed
   *    into a silent `false` that the caller ignored.
   */
  async updateShipment(parcelId: string, input: UpdateShipmentInput): Promise<boolean> {
    const parcel = await this.get<ZrGetParcelResponse>(
      `/api/v${API_VERSION}/parcels/${parcelId}`
    );

    // ── amount ────────────────────────────────────────────────────────────
    if (input.amount !== undefined && input.amount !== parcel.amount) {
      const amountReq: ZrUpdateAmountRequest = { parcelId, amount: input.amount };
      await this.patch(`/api/v${API_VERSION}/parcels/${parcelId}/amount`, amountReq);
    }

    // ── customer (name / phone) ───────────────────────────────────────────
    const currentName = parcel.customer?.name ?? null;
    const currentPhone = parcel.customer?.phone?.number1 ?? null;
    const nextName = input.customerName ?? null;
    const nextPhone = input.phone ? this.normalizePhone(input.phone) : null;
    if (
      (nextName !== null && nextName !== currentName)
      || (nextPhone !== null && nextPhone !== currentPhone)
    ) {
      const customerUpdate: ZrUpdateCustomerRequest = { parcelId };
      if (nextName !== null) customerUpdate.name = nextName;
      if (nextPhone !== null) customerUpdate.phone = nextPhone;
      await this.patch(`/api/v${API_VERSION}/parcels/${parcelId}/customer`, customerUpdate);
    }

    // ── delivery address ──────────────────────────────────────────────────
    if (input.address !== undefined) {
      const current = parcel.deliveryAddress ?? {};
      const streetChanged = input.address !== (current.street ?? null)
        && input.address !== (current.street ?? "");

      // Territory change: the caller sends wilayaId + commune together
      // (shipment-operations pre-fills both from the order).
      const wilayaChanged =
        input.wilayaId !== undefined
        && current.cityTerritoryCode !== undefined
        && input.wilayaId !== current.cityTerritoryCode;
      const communeChanged =
        input.commune !== undefined
        && input.commune !== (current.district ?? null);

      if (streetChanged || wilayaChanged || communeChanged) {
        let cityTerritoryId = current.cityTerritoryId ?? null;
        let districtTerritoryId = current.districtTerritoryId ?? null;

        if (wilayaChanged || communeChanged) {
          if (!input.wilayaId || !input.commune) {
            throw new Error(
              "ZR Express: changing the delivery address requires both wilayaId and commune."
            );
          }
          const cityItem = await this.resolveCityId(
            input.wilayaId,
            // UpdateShipmentInput carries no wilaya name; the stripped
            // code-based fallback in resolveCityId resolves it.
            String(input.wilayaId)
          );
          const districtItem = await this.resolveDistrictId(input.commune, cityItem);
          cityTerritoryId = cityItem.id;
          districtTerritoryId = districtItem.id;
        }

        const addressUpdate: ZrUpdateDeliveryAddressRequest = {
          parcelId,
          deliveryAddress: {
            street: input.address,
            cityTerritoryId: cityTerritoryId ?? undefined,
            districtTerritoryId: districtTerritoryId ?? undefined,
          },
        };

        // Pickup-point parcels additionally require the hub on every address
        // update — resolve it from the (possibly new) district territory.
        if (parcel.deliveryType === "pickup-point") {
          if (!districtTerritoryId) {
            throw new Error(
              "ZR Express: cannot update a pickup-point address without a district territory."
            );
          }
          const hubs = await this.loadHubs();
          const hub = hubs.find((h) => h.address?.districtTerritoryId === districtTerritoryId);
          if (!hub) {
            throw new Error(
              `ZR Express: no hub serves district territory ${districtTerritoryId} — ` +
              `cannot update this pickup-point address.`
            );
          }
          addressUpdate.hubId = hub.id;
        }

        await this.patch(`/api/v${API_VERSION}/parcels/${parcelId}/deliveryAddress`, addressUpdate);
      }
    }

    return true;
  }

  /**
   * Get tracking information (state history) for a parcel.
   *
   * `GET /parcels/{id}/state-history` only accepts the parcel **UUID** — the
   * same path with a tracking number answers 404 (live-verified; the swagger
   * path parameter is `{parcelId}`). Resolve the UUID first via
   * `GET /parcels/{trackingNumber}`, then read the history.
   */
  async getTrackingInfo(trackingNumber: string): Promise<TrackingEvent[]> {
    let parcel: ZrGetParcelResponse;
    try {
      parcel = await this.get<ZrGetParcelResponse>(
        `/api/v${API_VERSION}/parcels/${trackingNumber}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Unknown tracking number (deleted/never dispatched at ZR) → no events.
      if (/not found/i.test(msg) || /404/.test(msg)) {
        console.warn(`ZR Express: parcel ${trackingNumber} not found — no tracking events`);
        return [];
      }
      throw err;
    }
    if (!parcel.id) return [];

    const history = await this.get<ZrStateHistoryResponse>(
      `/api/v${API_VERSION}/parcels/${parcel.id}/state-history`
    );

    return (history ?? []).map((h) => ({
      activity: h.newState.name,
      description: h.newState.description,
      date: h.createdAt,
    }));
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

  /**
   * Map of wilaya territory UUID → wilaya number (1–58), built by paging the
   * territory list once per adapter instance and keeping wilaya-level rows.
   */
  private wilayaCodeByTerritory: Map<string, number> | null = null;

  private async loadWilayaCodeMap(): Promise<Map<string, number>> {
    if (this.wilayaCodeByTerritory) return this.wilayaCodeByTerritory;
    const map = new Map<string, number>();
    const pageSize = 1000;
    for (let page = 1; page <= 5; page++) {
      const res = await this.post<ZrSearchTerritoriesRequest, ZrPagedListTerritories>(
        `/api/v${API_VERSION}/territories/search`,
        { keyword: "", pageSize, pageNumber: page }
      );
      const items = res.items ?? [];
      for (const t of items) {
        if (t.level === "wilaya" && typeof t.code === "number") {
          map.set(t.id, t.code);
        }
      }
      const totalPages = res.totalPages ?? 1;
      if (items.length === 0 || page >= totalPages) break;
    }
    this.wilayaCodeByTerritory = map;
    return map;
  }

  /**
   * Stop desks for ZR Express are **hubs** with `isPickupPoint: true`
   * (`POST /hubs/search`) — not pickup-point territories. The hub id is what
   * parcel creation expects as `stationCode` → `hubId`; passing a territory
   * UUID fails with `HubErrors.HubNotFound` (live-verified 2026-09-10).
   * Each hub's wilaya is resolved from `address.cityTerritoryId`.
   */
  async getStopDesks(): Promise<StopDesk[]> {
    try {
      const [hubs, wilayaCodes] = await Promise.all([this.loadHubs(), this.loadWilayaCodeMap()]);
      return hubs
        .filter((h) => h.isPickupPoint)
        .map((h) => ({
          code: h.id,          // ZR stop-desk stationCode = hub UUID
          name: h.name ?? h.id,
          wilayaId: (h.address?.cityTerritoryId
            ? wilayaCodes.get(h.address.cityTerritoryId) ?? null
            : null),
        }));
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

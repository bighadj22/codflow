/**
 * Yalidine Delivery Provider Adapter
 *
 * Implements the DeliveryProvider interface for Yalidine (https://yalidine.app).
 * Auth: X-API-ID header (apiId) + X-API-TOKEN header (apiToken).
 *
 * Key differences from NOEST / ZR Express:
 *  - Create parcel: POST an **array** of parcel objects (not a single object)
 *  - No separate "validate" step — parcels are immediately active after creation
 *  - Wilaya / commune are **name-based strings** (not numeric IDs)
 *  - Tracking format: "yal-XXXXXX"
 *  - Stop desks use center_id (integer) from GET /v1/centers/
 *
 * Endpoints used:
 *  createShipment        → POST   /v1/parcels/         (array body, keyed by order_id)
 *  createShipmentsBulk   → POST   /v1/parcels/         (same endpoint, multiple parcels)
 *  validateShipment      → no-op  (Yalidine auto-validates on creation)
 *  getStopDesks          → GET    /v1/centers/         (paginated)
 */

import type {
  DeliveryProvider,
  CreateShipmentInput,
  CreateShipmentResult,
  StopDesk,
  UpdateShipmentInput,
  TrackingEvent,
} from "../types";
import type {
  YalidineCreateParcelData,
  YalidineCreateParcelResponse,
  YalidineCenterList,
  YalidineUpdateParcelRequest,
  YalidineUpdateParcelResponse,
  YalidineDeleteParcelResponse,
  YalidineHistoryResponse,
} from "./types";

const BASE_URL = "https://api.yalidine.app/v1";

export class YalidineProvider implements DeliveryProvider {
  readonly code = "yalidine";

  private readonly apiToken: string;
  private readonly apiId: string;
  /**
   * Sender's wilaya name (e.g. "Alger").
   * Required by Yalidine as `from_wilaya_name` on every parcel.
   * Configurable via delivery company notes JSON: { "from_wilaya_name": "Oran" }.
   * Defaults to "Alger".
   */
  private readonly fromWilayaName: string;

  constructor(
    apiToken: string,
    apiId: string,
    fromWilayaName = "Alger",
  ) {
    this.apiToken = apiToken;
    this.apiId = apiId;
    this.fromWilayaName = fromWilayaName;
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────────

  private headers(): HeadersInit {
    return {
      "X-API-ID": this.apiId,
      "X-API-TOKEN": this.apiToken,
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
      throw new Error(`Yalidine HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      const j = json as { message?: string; error?: string };
      throw new Error(j.message ?? j.error ?? `Yalidine HTTP ${res.status}`);
    }
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
      throw new Error(`Yalidine HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      const j = json as { message?: string; error?: string };
      throw new Error(j.message ?? j.error ?? `Yalidine HTTP ${res.status}`);
    }
    return json as TRes;
  }

  private async patch<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Yalidine HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      const j = json as { message?: string; error?: string };
      throw new Error(j.message ?? j.error ?? `Yalidine HTTP ${res.status}`);
    }
    return json as TRes;
  }

  private async delete<TRes>(path: string): Promise<TRes> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Yalidine HTTP ${res.status} — response is not valid JSON`);
    }
    if (!res.ok) {
      const j = json as { message?: string; error?: string };
      throw new Error(j.message ?? j.error ?? `Yalidine HTTP ${res.status}`);
    }
    return json as TRes;
  }

  // ─── Shared parcel builder ────────────────────────────────────────────────────

  private buildParcelData(input: CreateShipmentInput): YalidineCreateParcelData {
    // Yalidine requires firstname and familyname separately.
    const parts = input.customerName.trim().split(/\s+/);
    const firstname = parts[0];
    const familyname = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];

    if (!input.wilaya) {
      throw new Error(
        "Yalidine: to_wilaya_name is required — pass the French wilaya name via input.wilaya (e.g. 'Alger')"
      );
    }

    let stopdeskId: number | null = null;
    if (input.stopDesk) {
      if (!input.stationCode) {
        throw new Error(
          "Yalidine: stop-desk delivery requires a stationCode (center_id). " +
          "Select a pickup center from the stop-desks list."
        );
      }
      stopdeskId = parseInt(input.stationCode, 10);
      if (isNaN(stopdeskId)) {
        throw new Error(
          `Yalidine: stationCode "${input.stationCode}" is not a valid center_id (expected integer).`
        );
      }
    }

    return {
      order_id: input.reference ?? input.orderId,
      from_wilaya_name: this.fromWilayaName,
      firstname,
      familyname,
      contact_phone: input.phone,
      address: input.address,
      to_commune_name: input.commune,
      to_wilaya_name: input.wilaya,
      product_list: input.productDescription,
      price: Math.round(input.amount),
      do_insurance: false,
      declared_value: Math.round(input.amount),
      length: 1,
      width: 1,
      height: 1,
      weight: input.weight ?? 1,
      freeshipping: true,
      is_stopdesk: input.stopDesk,
      stopdesk_id: stopdeskId,
      has_exchange: false,
    };
  }

  // ─── DeliveryProvider interface ───────────────────────────────────────────────

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const parcelData = this.buildParcelData(input);
    const orderId = parcelData.order_id;

    const response = await this.post<YalidineCreateParcelData[], YalidineCreateParcelResponse>(
      "/parcels/",
      [parcelData]
    );

    const result = response[orderId] ?? Object.values(response)[0];

    if (!result) {
      throw new Error(`Yalidine: no result in response for order_id "${orderId}"`);
    }
    if (!result.success || !result.tracking) {
      throw new Error(result.message || "Yalidine: parcel creation failed");
    }

    return {
      trackingNumber: result.tracking,
      labelUrl: result.label ?? undefined,
      rawResponse: response,
    };
  }

  /**
   * Yalidine bulk create — same POST /v1/parcels/ endpoint, just more parcels in the array.
   * Response is keyed by order_id (input.reference ?? input.orderId).
   */
  async createShipmentsBulk(
    inputs: CreateShipmentInput[]
  ): Promise<Array<{ input: CreateShipmentInput; trackingNumber?: string; labelUrl?: string; error?: string }>> {
    if (inputs.length === 0) return [];

    const parcels: YalidineCreateParcelData[] = [];
    const errors: Map<string, string> = new Map();

    for (const input of inputs) {
      try {
        parcels.push(this.buildParcelData(input));
      } catch (err) {
        const orderId = input.reference ?? input.orderId;
        errors.set(orderId, err instanceof Error ? err.message : String(err));
      }
    }

    if (parcels.length === 0) {
      return inputs.map((input) => {
        const orderId = input.reference ?? input.orderId;
        return { input, error: errors.get(orderId) ?? "Build error" };
      });
    }

    const response = await this.post<YalidineCreateParcelData[], YalidineCreateParcelResponse>(
      "/parcels/",
      parcels
    );

    return inputs.map((input) => {
      const orderId = input.reference ?? input.orderId;
      if (errors.has(orderId)) {
        return { input, error: errors.get(orderId) };
      }
      const result = response[orderId];
      if (!result) {
        return { input, error: `No result returned for order_id "${orderId}"` };
      }
      if (!result.success || !result.tracking) {
        return { input, error: result.message || "Yalidine: parcel creation failed" };
      }
      return { input, trackingNumber: result.tracking, labelUrl: result.label ?? undefined };
    });
  }

  /**
   * Yalidine auto-validates parcels on creation — no separate validation step needed.
   */
  async validateShipment(_trackingNumber: string): Promise<boolean> {
    return true;
  }

  /**
   * Fetch all Yalidine centers (stop-desk pickup points).
   * GET /v1/centers/ — paginated, auto-paginates until has_more = false.
   * stationCode on orders must match center_id (stored as string).
   */
  async getStopDesks(): Promise<StopDesk[]> {
    const allCenters: YalidineCenterList["data"] = [];
    try {
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await this.get<YalidineCenterList>(`/centers/?page_size=1000&page=${page}`);
        allCenters.push(...(res.data ?? []));
        hasMore = res.has_more && (res.data?.length ?? 0) > 0;
        page++;
        if (page > 10) break;
      }
    } catch {
      // Non-critical — return what we have
    }
    return allCenters.map((c) => ({
      code:     String(c.center_id),
      name:     c.name,
      address:  c.address || undefined,
      wilayaId: c.wilaya_id,
    }));
  }

  /**
   * Update an existing parcel.
   * PATCH /v1/parcels/:tracking
   * 
   * ⚠️ IMPORTANT RESTRICTIONS:
   * - Only works when parcel status is "En préparation"
   * - Response data is MASKED (firstname, familyname, contact_phone, address)
   * - DO NOT use response data to update your database
   * 
   * @param trackingNumber - The parcel tracking number
   * @param input - Fields to update
   * @returns true if update succeeded, false otherwise
   */
  async updateShipment(trackingNumber: string, input: UpdateShipmentInput): Promise<boolean> {
    try {
      const updateData: YalidineUpdateParcelRequest = {};

      // Map customerName to firstname/familyname
      if (input.customerName) {
        const parts = input.customerName.trim().split(/\s+/);
        updateData.firstname = parts[0];
        updateData.familyname = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
      }

      // Map phone
      if (input.phone) {
        updateData.contact_phone = input.phone;
      }

      // Map address
      if (input.address) {
        updateData.address = input.address;
      }

      // Map commune
      if (input.commune) {
        updateData.to_commune_name = input.commune;
      }

      // Map wilayaId - need to convert to name (not supported in update, skip)
      // Yalidine update doesn't support changing wilaya easily without name

      // Map amount
      if (input.amount !== undefined) {
        updateData.price = Math.round(input.amount);
        updateData.declared_value = Math.round(input.amount);
      }

      // Map weight
      if (input.weight !== undefined) {
        updateData.weight = input.weight;
      }

      // Send PATCH request
      await this.patch<YalidineUpdateParcelRequest, YalidineUpdateParcelResponse>(
        `/parcels/${trackingNumber}`,
        updateData
      );

      return true;
    } catch (err) {
      console.error(`Yalidine: Failed to update parcel ${trackingNumber}:`, err);
      return false;
    }
  }

  /**
   * Delete/cancel a parcel.
   * DELETE /v1/parcels/:tracking
   * 
   * ⚠️ IMPORTANT RESTRICTIONS:
   * - Only works when parcel status is "En préparation"
   * - Returns HTTP 200 even on failure (check 'deleted' field)
   * - deleted: true = successfully deleted
   * - deleted: false = already deleted, doesn't exist, or wrong status
   * 
   * @param trackingNumber - The parcel tracking number
   * @returns true if deletion succeeded, false otherwise
   */
  async deleteShipment(trackingNumber: string): Promise<boolean> {
    try {
      const response = await this.delete<YalidineDeleteParcelResponse>(
        `/parcels/${trackingNumber}`
      );

      // Response is always an array, even for single delete
      // Check if deletion was successful
      return response[0]?.deleted === true;
    } catch (err) {
      console.error(`Yalidine: Failed to delete parcel ${trackingNumber}:`, err);
      return false;
    }
  }

  /**
   * Get tracking history for a parcel.
   * GET /v1/histories/:tracking
   * 
   * Returns chronological list of status changes with dates, reasons, and locations.
   * 
   * @param trackingNumber - The parcel tracking number
   * @returns Array of tracking events
   */
  async getTrackingInfo(trackingNumber: string): Promise<TrackingEvent[]> {
    try {
      const response = await this.get<YalidineHistoryResponse>(
        `/histories/${trackingNumber}`
      );

      return response.data.map((h) => ({
        activity: h.status,
        description: h.reason || undefined,
        date: h.date_status,
      }));
    } catch (err) {
      console.error(`Yalidine: Failed to get tracking info for ${trackingNumber}:`, err);
      return [];
    }
  }

  /**
   * Add a remark/note to a parcel.
   * 
   * ⚠️ NOT SUPPORTED: Yalidine API does not have a dedicated remarks endpoint.
   * Remarks should be stored in your local database instead.
   * 
   * @param _trackingNumber - The parcel tracking number (unused)
   * @param _content - The remark content (unused)
   * @returns false (not supported)
   */
  async addRemark(_trackingNumber: string, _content: string): Promise<boolean> {
    // Yalidine doesn't have a dedicated remarks/notes endpoint
    // Store remarks in local database instead
    return false;
  }
}

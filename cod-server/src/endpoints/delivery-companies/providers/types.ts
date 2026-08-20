/**
 * Delivery Provider — Shared Interface
 *
 * Every delivery company adapter must implement this interface.
 * The registry returns the correct adapter based on company.code.
 */

// ─── Shared input / output shapes ─────────────────────────────────────────────

export interface CreateShipmentInput {
  /** Internal order ID (for logging). */
  orderId: string;
  /** Customer full name. */
  customerName: string;
  /** Customer primary phone number. */
  phone: string;
  /** Optional secondary phone number. */
  phone2?: string;
  /** Delivery address string. */
  address: string;
  /** Algeria wilaya ID (1–58). */
  wilayaId: number;
  /** Commune / municipality name. */
  commune: string;
  /** Order total amount (DZD) — used as COD. */
  amount: number;
  /** Product description / reference. */
  productDescription: string;
  /** Home delivery (false) or stop-desk pickup (true). */
  stopDesk: boolean;
  /** Stop-desk station code — required when stopDesk=true. */
  stationCode?: string;
  /** Internal order reference (optional). */
  reference?: string;
  /** Wilaya name in French/English (e.g. "Alger"). Used by providers that need name-based territory lookup. */
  wilaya?: string;
  /** Additional remarks for the courier. */
  remarks?: string;
  /** Whether the package can be opened on receipt. */
  canOpen?: boolean;
  /** Parcel weight in kg (optional — sent only when the order has it set). */
  weight?: number;
  /** Whether the parcel contains fragile items (optional). */
  fragile?: boolean;
}

export interface CreateShipmentResult {
  /** Tracking number assigned by the company. */
  trackingNumber: string;
  /** URL of the printable label PDF, if the API returned one. */
  labelUrl?: string;
  /** Raw API response for audit storage. */
  rawResponse: unknown;
}

export interface StopDesk {
  code: string;
  name: string;
  /** `null` when the provider does not publish a distinct commune (e.g. EcoTrack, where the desk IS the commune). */
  commune?: string | null;
  address?: string | null;
  phones?: string[];
  /**
   * Algerian wilaya 1–58. `null` when the carrier's territory data doesn't map cleanly
   * (e.g. ZR pickup-point territories whose `code` isn't a wilaya number). Desks with
   * null wilayaId are still synced and visible in admin lists, but the dispatch dialog's
   * stop-desk picker (which filters by `order.wilayaId`) will hide them.
   */
  wilayaId: number | null;
}

export interface UpdateShipmentInput {
  customerName?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  commune?: string;
  wilayaId?: number;
  amount?: number;
  remarks?: string;
  fragile?: boolean;
  weight?: number;
}

export interface ShipmentRemark {
  id?: string | number;
  content: string;
  type?: string;
  createdAt?: string;
}

export interface TrackingEvent {
  activity: string;
  description?: string;
  date?: string;
}

// ─── Provider interface ────────────────────────────────────────────────────────

export interface DeliveryProvider {
  /** Unique short code matching delivery_companies.code (e.g. "noest"). */
  readonly code: string;

  /** Create a shipment via the company API and return tracking info. */
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;

  /**
   * Validate a created (but not yet validated) shipment.
   * Returns true on success; throws on failure.
   * Providers that auto-validate on creation (Yalidine, ZR Express) return true immediately.
   */
  validateShipment(trackingNumber: string): Promise<boolean>;

  /**
   * Fetch the list of stop-desk stations.
   * Used to populate station_code when creating stop-desk shipments.
   */
  getStopDesks(): Promise<StopDesk[]>;

  /**
   * Update an existing shipment at the carrier API.
   * Only supported before validation — after validation the order is locked.
   * Not all providers support this — check before calling.
   */
  updateShipment?(trackingNumber: string, input: UpdateShipmentInput): Promise<boolean>;

  /**
   * Delete/cancel a shipment at the carrier API.
   * Only works before validation.
   * Not all providers support this — check before calling.
   */
  deleteShipment?(trackingNumber: string): Promise<boolean>;

  /**
   * Add a remark/note to a shipment at the carrier.
   * Available at any time after dispatch (before or after validation).
   * Not all providers support this — check before calling.
   */
  addRemark?(trackingNumber: string, content: string): Promise<boolean>;

  /**
   * Fetch the list of remarks added to a shipment (by sender or courier).
   * Not all providers support this — check before calling.
   */
  getRemarks?(trackingNumber: string): Promise<ShipmentRemark[]>;

  /**
   * Fetch the full tracking history for a shipment.
   * Returns chronological activity events from the carrier.
   * Not all providers support this — check before calling.
   */
  getTrackingInfo?(trackingNumber: string): Promise<TrackingEvent[]>;
}

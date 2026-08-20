// Delivery system types

/** Algeria's official wilaya (province). Integer ID matches official numbering 1–58. */
export interface Wilaya {
  id: number;
  name: string;   // "Alger"
  nameAr: string; // "الجزائر"
}

/** Commune (municipality) within a wilayaa. */
export interface Commune {
  id: string;
  wilayaId: number;
  name: string;
  nameAr: string;
  postalCode: string | null;
}

/** Third-party delivery company (Yalidine, NOEST, ZR Express, etc.). */
export interface DeliveryCompany {
  id: string;
  name: string;
  nameAr: string;
  /** Short unique code, e.g. "yalidine", "noest", "zr_express". */
  code: string;
  website: string | null;
  active: boolean;

  // API integration
  apiEndpoint: string | null;
  /** True when API credentials are stored — credentials themselves are never returned by the API. */
  isConnected: boolean;

  // Capabilities
  supportsHomeDelivery: boolean;
  supportsStopDesk: boolean;
  supportsTracking: boolean;

  /**
   * When true, a successful `createShipment` is immediately followed by
   * `validateShipment` — the order is locked at the carrier (no edits/deletes).
   * When false, the team must manually confirm each order before it ships.
   * Defaults: false for EcoTrack-family providers, true for the rest.
   */
  autoValidate: boolean;

  notes: string | null;

  // Webhook integration
  /** ZR: "whsec_xxx" Svix secret. Yalidine: secret from dashboard. null = no verification. */
  webhookSecret: string | null;
  /** ZR only: registered endpoint UUID. null = not registered. */
  webhookEndpointId: string | null;
  /** ZR only: custom state name → our status mapping as JSON string. null = code defaults only. */
  webhookStatusMapping: string | null;

  createdAt: string;
  updatedAt: string;
}

export type DeliveryType = "home" | "stop_desk";

/**
 * A shipment created via a third-party delivery company API.
 * Created when an order is dispatched via POST /orders/:id/dispatch.
 *
 * No status column — the order's status is the single source of truth for the
 * lifecycle. This record only carries the carrier-side handle.
 */
export interface CompanyShipment {
  id: string;
  orderId: string;
  companyId: string;
  trackingNumber: string;
  validated: boolean;
  labelUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A stop desk / pickup point returned by GET /api/delivery-companies/:id/stop-desks. */
export interface StopDesk {
  id: string;
  companyId: string;
  code: string;
  name: string;
  wilayaId: number | null;
  address: string | null;
  commune: string | null;
  phones: string[];
  active: boolean;
  syncedAt: string;
}

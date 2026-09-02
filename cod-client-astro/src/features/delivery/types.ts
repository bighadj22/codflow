import type { OrderStatus } from "@/features/orders/types";

export type DriverStatus = "available" | "busy" | "inactive";
export type VehicleType = "motorcycle" | "car" | "van";
export type DriverPaymentType = "cod_remittance" | "fee_payment" | "net_settlement";

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string | null;
  vehicleType?: VehicleType | null;
  status: DriverStatus;
  compensationWilayaCount?: number;
  totalDelivered: number;
  totalEarnings: number;
  pendingCash: number;
  totalPaid: number;
  notes?: string | null;
  recentOrders?: DriverOrder[];
  createdAt: string;
  updatedAt: string;
}

export interface DriverOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  wilaya: string | null;
  wilayaId: number | null;
  price: number;
  status: OrderStatus;
  deliveryMethod: "unassigned" | "driver" | "company";
  driverId: string | null;
  deliveryFee: number;
  driverFee: number;
  codAmount: number | null;
  codPaymentId?: string | null;
  feePaymentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverCompensation {
  wilayaId: number;
  wilayaName?: string;
  wilayaNameAr?: string;
  feePerDelivery: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverPayment {
  id: string;
  driverId: string;
  type: DriverPaymentType;
  amount: number;
  orderCount: number;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface Wilaya {
  id: number;
  name: string;
  nameAr: string;
}

export interface DriverFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  phone2: string;
  vehicleType: string;
  notes: string;
}

// ─── Delivery Company Types ───────────────────────────────────────────────────

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

/** Provider configuration registry entry. */
export interface ProviderConfig {
  code: string;
  name: string;
  nameAr: string;
  website: string;
  apiEndpoint: string;
  supportsHomeDelivery: boolean;
  supportsStopDesk: boolean;
  supportsTracking: boolean;
  requiresUserGuid: boolean;
  guidLabel?: string;
  guidHint?: string;
  tokenLabel?: string;
  tokenHint?: string;
  requiresFromWilaya?: boolean;
  requiresEndpoint?: boolean;
  endpointLabel?: string;
  endpointHint?: string;
  endpointDefault?: string;
}

// ─── Shipping Profile Types ──────────────────────────────────────────────────

import { ECOTRACK_COURIERS, ecotrackCompanyCode } from "../../../../cod-shared/lib/ecotrack-couriers";

/** Per-wilaya rate within a shipping profile. */
export interface ShippingRule {
  id: string;
  profileId: string;
  wilayaId: number;
  wilayaName: string;
  wilayaNameAr: string;
  homePrice: number;
  stopDeskPrice: number;
  homeEnabled: boolean;
  stopDeskEnabled: boolean;
  createdAt: string;
}

/**
 * A customer-facing shipping profile (rate card).
 * Profiles only describe what customers pay — driver payroll lives in
 * driver_compensations and is no longer linked to profiles.
 */
export interface ShippingProfile {
  id: string;
  name: string;
  isDefault: boolean;
  notes: string | null;
  ruleCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingProfileWithRules
  extends Omit<ShippingProfile, "ruleCount"> {
  rules: ShippingRule[];
}

/** Commune-level override (price + availability) for a wilaya rule. */
export interface CommuneOverride {
  communeId: string;
  communeName: string;
  communeNameAr: string;
  postalCode: string | null;
  homeEnabled: boolean | null;
  stopDeskEnabled: boolean | null;
  homePrice: number | null;
  stopDeskPrice: number | null;
  effectiveHomeEnabled: boolean;
  effectiveStopDeskEnabled: boolean;
  effectiveHomePrice: number;
  effectiveStopDeskPrice: number;
  hasOverride: boolean;
}

/** Per-wilaya rate editor state inside the shipping profile form. */
export interface ShippingRateEntry {
  homePrice: number;
  stopDeskPrice: number;
  homeEnabled: boolean;
  stopDeskEnabled: boolean;
}

export type ShippingRateMap = Record<number, ShippingRateEntry>;

/** Form values for creating/editing delivery companies. */
export interface DeliveryCompanyFormValues {
  name: string;
  nameAr: string;
  code: string;
  website: string;
  active: boolean;
  apiToken: string;
  apiUserGuid: string;
  apiEndpoint: string;
  fromWilayaName: string;
}

/**
 * Provider configuration registry.
 *
 * NOTE (2026-09-01): EcoTrack entries are GENERATED from the shared courier
 * catalog (cod-shared/lib/ecotrack-couriers.ts — the same source the
 * cod-server seed uses). Do NOT hand-edit EcoTrack entries here; fix the
 * catalog instead. TODO(later): render the company list from
 * delivery_companies DB rows (seeded by cod-server's
 * seed-ecotrack-companies script) instead of this static registry, so new
 * couriers appear without a dashboard release.
 */
const ECOTRACK_PROVIDER_ENTRIES: Record<string, ProviderConfig> = Object.fromEntries(
  ECOTRACK_COURIERS.map((courier) => [
    ecotrackCompanyCode(courier.key),
    {
      code: ecotrackCompanyCode(courier.key),
      name: courier.name,
      nameAr: courier.nameAr,
      website: courier.baseUrl,
      apiEndpoint: courier.baseUrl,
      supportsHomeDelivery: true,
      supportsStopDesk: true,
      supportsTracking: true,
      requiresUserGuid: false,
      requiresEndpoint: true,
      endpointDefault: courier.baseUrl,
    } satisfies ProviderConfig,
  ]),
);

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  noest: {
    code: "noest",
    name: "NOEST",
    nameAr: "نوست",
    website: "https://app.noest-dz.com",
    apiEndpoint: "https://app.noest-dz.com",
    supportsHomeDelivery: true,
    supportsStopDesk: true,
    supportsTracking: true,
    requiresUserGuid: true,
  },
  zr_express: {
    code: "zr_express",
    name: "ZR Express",
    nameAr: "ZR إكسبريس",
    website: "https://zrexpress.app",
    apiEndpoint: "https://api.zrexpress.app",
    supportsHomeDelivery: true,
    supportsStopDesk: true,
    supportsTracking: true,
    requiresUserGuid: true,
  },
  yalidine: {
    code: "yalidine",
    name: "Yalidine",
    nameAr: "ياليدين",
    website: "https://yalidine.app",
    apiEndpoint: "https://api.yalidine.app/v1",
    supportsHomeDelivery: true,
    supportsStopDesk: true,
    supportsTracking: true,
    requiresUserGuid: true,
    tokenLabel: "X-API-TOKEN",
    tokenHint: "Your Yalidine API token — found in dashboard → API settings",
    guidLabel: "X-API-ID",
    guidHint: "Your Yalidine API ID (numeric) — found in dashboard → API settings",
    requiresFromWilaya: true,
  },
  ...ECOTRACK_PROVIDER_ENTRIES,
};

/**
 * Returns the ProviderConfig for a company code.
 */
export function getProviderConfig(code: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[code];
}

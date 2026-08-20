/**
 * Provider Capabilities Registry
 * 
 * Central registry for all delivery provider capabilities.
 * Capabilities are extracted from test data and API documentation.
 * 
 * Usage:
 *   import { getProviderCapabilities } from './capabilities';
 *   const caps = getProviderCapabilities('yalidine');
 *   if (caps?.canStopDesk) { ... }
 */

import { ZR_EXPRESS_CAPABILITIES } from "./zr_express/capabilities";
import { YALIDINE_CAPABILITIES } from "./yalidine/capabilities";
import { NOEST_CAPABILITIES } from "./noest/capabilities";
import { ECOTRACK_CAPABILITIES } from "./ecotrack/capabilities";
import { isEcotrackCompany } from "./registry";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProviderCapabilities {
  // ─── Delivery Types ───────────────────────────────────────────────────
  /** Supports home delivery */
  canHomeDelivery: boolean;
  
  /** Supports stop-desk/pickup-point delivery */
  canStopDesk: boolean;
  
  // ─── Lifecycle ────────────────────────────────────────────────────────
  /** Auto-validates on creation (no separate validate step needed) */
  autoValidates: boolean;
  
  /** Can update shipment before validation */
  canUpdateBeforeValidation: boolean;
  
  /** Can update shipment after validation */
  canUpdateAfterValidation: boolean;
  
  /** Can delete shipment before validation */
  canDeleteBeforeValidation: boolean;
  
  /** Can delete shipment after validation */
  canDeleteAfterValidation: boolean;
  
  // ─── Package Options ──────────────────────────────────────────────────
  /** Customer can open package before payment */
  canOpenPackage: boolean;
  
  /** Supports exchange on delivery */
  canExchange: boolean;
  
  /** Supports partial delivery */
  canPartialDelivery: boolean;
  
  /** Supports marking package as fragile */
  supportsFragileFlag: boolean;
  
  // ─── Tracking & Communication ─────────────────────────────────────────
  /** Can get tracking history */
  canTrack: boolean;
  
  /** Can add remarks/notes to shipment */
  canAddRemarks: boolean;
  
  /** Can get remarks/notes from shipment */
  canGetRemarks: boolean;
  
  /** Label URL provided in create response */
  providesLabelOnCreate: boolean;
  
  /** Label URL expires (temporary SAS token) */
  labelUrlExpires: boolean;
  
  // ─── Limits ───────────────────────────────────────────────────────────
  /** Maximum weight in kg (null = no limit) */
  maxWeightKg: number | null;
  
  /** Maximum orders per bulk create call */
  maxBulkCreate: number;
  
  /** Maximum orders per bulk validate call */
  maxBulkValidate: number;
  
  /** Supported currencies */
  supportedCurrencies: string[];
  
  // ─── Territory ────────────────────────────────────────────────────────
  /** Territory identification system */
  territorySystem: "wilaya_id" | "wilaya_name" | "uuid";
  
  /** Requires customer creation before shipment */
  requiresCustomerCreation: boolean;
  
  // ─── Webhooks ─────────────────────────────────────────────────────────
  /** Supports webhooks */
  supportsWebhooks: boolean;
  
  /** Webhook registration type */
  webhookRegistrationType: "api" | "manual" | null;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Capability Registry - Maps provider codes to their capabilities.
 * This is the "brain" of the logistics engine.
 */
const CAPABILITY_REGISTRY: Record<string, ProviderCapabilities> = {
  zr_express: ZR_EXPRESS_CAPABILITIES,
  yalidine: YALIDINE_CAPABILITIES,
  noest: NOEST_CAPABILITIES,
  ecotrack: ECOTRACK_CAPABILITIES,
  // EcoTrack platform companies inherit base capabilities
  packers_ecotrack: ECOTRACK_CAPABILITIES,
  tnt_ecotrack: ECOTRACK_CAPABILITIES,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get capabilities for a delivery company by code.
 * Returns null if the provider is not registered.
 * 
 * @example
 * const caps = getProviderCapabilities("yalidine");
 * if (caps?.canOpenPackage) {
 *   // Show "Allow customer to open package" checkbox
 * }
 */
export function getProviderCapabilities(code: string): ProviderCapabilities | null {
  // Handle EcoTrack platform companies
  if (isEcotrackCompany(code)) {
    return ECOTRACK_CAPABILITIES;
  }
  
  return CAPABILITY_REGISTRY[code] ?? null;
}

/**
 * Check if a provider supports a specific capability.
 * Returns false if provider not found or capability is false.
 * 
 * @example
 * if (hasCapability("yalidine", "canStopDesk")) {
 *   // Yalidine supports stop-desk delivery
 * }
 */
export function hasCapability(
  code: string,
  capability: keyof ProviderCapabilities
): boolean {
  const caps = getProviderCapabilities(code);
  if (!caps) return false;
  
  const value = caps[capability];
  // Handle boolean, number, and array capabilities
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  return !!value;
}

/**
 * Get all providers that support a specific capability.
 * Useful for intelligent routing.
 * 
 * @example
 * const stopDeskProviders = getProvidersByCapability("canStopDesk");
 * // ["yalidine", "zr_express", "noest", "ecotrack"]
 */
export function getProvidersByCapability(
  capability: keyof ProviderCapabilities,
  value: boolean | string | number = true
): string[] {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([_, caps]) => {
      const capValue = caps[capability];
      if (typeof value === "boolean") return capValue === value;
      if (typeof value === "string") {
        if (Array.isArray(capValue)) return capValue.includes(value);
        return capValue === value;
      }
      if (typeof value === "number") {
        return typeof capValue === "number" && capValue >= value;
      }
      return false;
    })
    .map(([code]) => code);
}

/**
 * Compare capabilities of multiple providers.
 * Returns a matrix for easy comparison.
 * 
 * @example
 * const matrix = compareProviders(["yalidine", "zr_express"], [
 *   "canStopDesk",
 *   "canUpdateAfterValidation",
 *   "maxWeightKg"
 * ]);
 */
export function compareProviders(
  codes: string[],
  capabilities?: Array<keyof ProviderCapabilities>
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  
  const capsToCompare = capabilities || Object.keys(ZR_EXPRESS_CAPABILITIES) as Array<keyof ProviderCapabilities>;
  
  for (const code of codes) {
    const caps = getProviderCapabilities(code);
    if (!caps) continue;
    
    result[code] = {};
    for (const cap of capsToCompare) {
      result[code][cap] = caps[cap];
    }
  }
  
  return result;
}

/**
 * Validate that an adapter's implementation matches its declared capabilities.
 * Throws if there's a mismatch (e.g. canAddRemarks=true but no addRemark method).
 */
export function validateAdapterCapabilities(
  adapter: { code: string; updateShipment?: unknown; deleteShipment?: unknown; addRemark?: unknown; getRemarks?: unknown; getTrackingInfo?: unknown },
  capabilities: ProviderCapabilities
): void {
  if (capabilities.canAddRemarks && !adapter.addRemark) {
    throw new Error(
      `${adapter.code}: canAddRemarks=true but addRemark() method not implemented`
    );
  }
  
  if (capabilities.canGetRemarks && !adapter.getRemarks) {
    throw new Error(
      `${adapter.code}: canGetRemarks=true but getRemarks() method not implemented`
    );
  }
  
  if (capabilities.canTrack && !adapter.getTrackingInfo) {
    throw new Error(
      `${adapter.code}: canTrack=true but getTrackingInfo() method not implemented`
    );
  }
  
  if ((capabilities.canUpdateBeforeValidation || capabilities.canUpdateAfterValidation) && !adapter.updateShipment) {
    throw new Error(
      `${adapter.code}: canUpdate*=true but updateShipment() method not implemented`
    );
  }
  
  if ((capabilities.canDeleteBeforeValidation || capabilities.canDeleteAfterValidation) && !adapter.deleteShipment) {
    throw new Error(
      `${adapter.code}: canDelete*=true but deleteShipment() method not implemented`
    );
  }
}

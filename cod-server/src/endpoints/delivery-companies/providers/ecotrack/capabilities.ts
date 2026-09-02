/**
 * EcoTrack Provider Capabilities
 *
 * Describes the EcoTrack ADAPTER integration (what our code can drive), not
 * the raw carrier API surface. Living source of truth for behavior:
 * adapter.test.ts (characterization tests against the official Postman
 * contract) and ../../../../../.agents/skills/Ecotrack/CONFORMANCE.md.
 *
 * Platform notes the flags below encode:
 *   - update after validation is a silent no-op at the carrier (answers
 *     success=true, ignores changes) — the handler blocks it client-side,
 *     so the adapter integration does not support it
 *   - order types 2/3/4 (Échange/PICKUP/Recouvrement) exist in the platform
 *     API but the integration always dispatches type=1 (Livraison)
 */

import type { ProviderCapabilities } from "../capabilities";

export const ECOTRACK_CAPABILITIES: ProviderCapabilities = {
  // ─── Delivery Types ───────────────────────────────────────────────────
  // Source: Default (assumed supported)
  // Source: Test script payload includes stop_desk
  canHomeDelivery: true,
  
  // Source: Default (assumed supported)
  // Source: Test script payload includes stop_desk (0/1)
  canStopDesk: true,
  
  // ─── Lifecycle ────────────────────────────────────────────────────────
  // Source: Test script HAS validate test
  // Source: Test "Validate Parcel"
  autoValidates: false,
  
  // Source: Test "Update Parcel BEFORE Validation"
  canUpdateBeforeValidation: true,
  
  // Source: Test "Try Update AFTER Validation - Should FAIL"
  // Carrier silently ignores updates on validated orders (success=true, no change).
  canUpdateAfterValidation: false,
  
  // Source: Test "Delete Parcel BEFORE Validation - Should WORK"
  canDeleteBeforeValidation: true,
  
  // Source: Test "Try Delete AFTER Validation - Should FAIL"
  canDeleteAfterValidation: false,
  
  // ─── Package Options ──────────────────────────────────────────────────
  // Source: Not in API
  canOpenPackage: false,
  
  // Source: Not supported
  canExchange: false,
  
  // Source: Not supported
  canPartialDelivery: false,
  
  // Source: Test script payload includes fragile (0/1)
  supportsFragileFlag: true,
  
  // ─── Tracking & Communication ─────────────────────────────────────────
  // Source: Test "Get Tracking Info BEFORE Validation"
  // Source: Test "Get Tracking Info AFTER Validation"
  canTrack: true,
  
  // Source: Test "Add Remark BEFORE Validation"
  // Source: Test "Add Remark AFTER Validation"
  // ✅ Works at any time (before or after validation)
  canAddRemarks: true,
  
  // Source: Test "Get Remarks"
  // ✅ Unique feature - only EcoTrack supports getting remarks
  canGetRemarks: true,
  
  // Source: Separate label endpoint
  providesLabelOnCreate: false,
  
  // Source: Permanent URL
  labelUrlExpires: false,
  
  // ─── Limits ───────────────────────────────────────────────────────────
  // Source: No documented limit
  maxWeightKg: null,
  
  // Source: Tested limit
  maxBulkCreate: 100,
  
  // Source: No bulk validate endpoint
  maxBulkValidate: 0,
  
  // Source: Algerian market
  supportedCurrencies: ["DZD"],
  
  // ─── Territory ────────────────────────────────────────────────────────
  // Source: Test script payload uses code_wilaya (integer)
  territorySystem: "wilaya_id",
  
  // Source: Test script has no customer creation test
  requiresCustomerCreation: false,
  
  // ─── Webhooks ─────────────────────────────────────────────────────────
  // Source: No webhook support
  supportsWebhooks: false,
  
  // Source: No webhook support
  webhookRegistrationType: null,
};

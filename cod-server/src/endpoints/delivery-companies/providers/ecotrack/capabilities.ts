/**
 * EcoTrack Provider Capabilities
 * 
 * Auto-generated from test data analysis
 * Source: scripts/extract-capabilities.ts
 * 
 * Test Results: 12/13 passed (92%)
 * Confidence: 7 high, 3 medium, 1 low
 * 
 * Note: Update after validation WORKS (documentation was wrong!)
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
  
  // Source: Test "Try Update AFTER Validation"
  // ✅ WORKS! Documentation said it doesn't, but test proved it does
  canUpdateAfterValidation: true,
  
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

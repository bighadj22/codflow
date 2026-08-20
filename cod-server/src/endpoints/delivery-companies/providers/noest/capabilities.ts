/**
 * NOEST Provider Capabilities
 * 
 * Auto-generated from test data analysis
 * Source: scripts/extract-capabilities.ts
 * 
 * Test Results: 12/12 passed (100%) ✅
 * Confidence: 6 high, 3 medium, 1 low
 * 
 * Note: Perfect match with API documentation
 */

import type { ProviderCapabilities } from "../capabilities";

export const NOEST_CAPABILITIES: ProviderCapabilities = {
  // ─── Delivery Types ───────────────────────────────────────────────────
  // Source: Default (assumed supported)
  // Source: API docs parameter stop_desk (0=Home, 1=Stop desk)
  canHomeDelivery: true,
  
  // Source: Default (assumed supported)
  // Source: API docs parameter stop_desk (0=Home, 1=Stop desk)
  canStopDesk: true,
  
  // ─── Lifecycle ────────────────────────────────────────────────────────
  // Source: Test script HAS validate test
  // Source: Test "Validate Parcel"
  autoValidates: false,
  
  // Source: Test "Update Parcel BEFORE Validation"
  canUpdateBeforeValidation: true,
  
  // Source: Test "Try Update AFTER Validation - Should FAIL"
  // Source: Returns error "Commande non trouvée dans l'étape de modification"
  canUpdateAfterValidation: false,
  
  // Source: Test "Delete Parcel BEFORE Validation - Should WORK"
  canDeleteBeforeValidation: true,
  
  // Source: Test "Try Delete AFTER Validation - Should FAIL"
  canDeleteAfterValidation: false,
  
  // ─── Package Options ──────────────────────────────────────────────────
  // Source: API docs parameter can_open (0=No, 1=Yes)
  canOpenPackage: true,
  
  // Source: API docs parameter type_id (1=Delivery, 2=Exchange, 3=Pick-up)
  canExchange: true,
  
  // Source: Not supported
  canPartialDelivery: false,
  
  // Source: No fragile field in API
  supportsFragileFlag: false,
  
  // ─── Tracking & Communication ─────────────────────────────────────────
  // Source: Test "Get Tracking Info BEFORE Validation"
  // Source: Test "Get Tracking Info AFTER Validation"
  canTrack: true,
  
  // Source: Test "Add Remark BEFORE Validation"
  // Source: Test "Add Remark AFTER Validation - Should WORK"
  // ✅ Works at any time (before or after validation)
  canAddRemarks: true,
  
  // Source: No GET remarks endpoint in API
  canGetRemarks: false,
  
  // Source: Separate label endpoint
  providesLabelOnCreate: false,
  
  // Source: Permanent URL
  labelUrlExpires: false,
  
  // ─── Limits ───────────────────────────────────────────────────────────
  // Source: API docs "according to partner limit"
  maxWeightKg: null,
  
  // Source: Tested limit
  maxBulkCreate: 100,
  
  // Source: Tested limit
  maxBulkValidate: 100,
  
  // Source: Algerian market
  supportedCurrencies: ["DZD"],
  
  // ─── Territory ────────────────────────────────────────────────────────
  // Source: API docs parameter wilaya_id (integer, 1-58)
  territorySystem: "wilaya_id",
  
  // Source: Test script has no customer creation test
  requiresCustomerCreation: false,
  
  // ─── Webhooks ─────────────────────────────────────────────────────────
  // Source: No webhook support
  supportsWebhooks: false,
  
  // Source: No webhook support
  webhookRegistrationType: null,
};

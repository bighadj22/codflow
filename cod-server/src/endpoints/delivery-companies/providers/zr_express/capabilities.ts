/**
 * ZR Express Provider Capabilities
 * 
 * Auto-generated from test data analysis
 * Source: scripts/extract-capabilities.ts
 * 
 * Test Results: 9/10 passed (90%)
 * Confidence: 8 high, 3 medium, 1 low
 */

import type { ProviderCapabilities } from "../capabilities";

export const ZR_EXPRESS_CAPABILITIES: ProviderCapabilities = {
  // ─── Delivery Types ───────────────────────────────────────────────────
  // Source: Default (assumed supported)
  canHomeDelivery: true,
  
  // Source: Default (assumed supported)
  canStopDesk: true,
  
  // ─── Lifecycle ────────────────────────────────────────────────────────
  // Source: Test script has no validate test
  // Source: Note "ZR Express auto-validates on creation"
  autoValidates: true,
  
  // Source: Test "Update Parcel Amount"
  // Source: Test "Update Parcel Customer"
  // Source: Test "Update Parcel Address"
  canUpdateBeforeValidation: true,
  
  // Source: No rejection in tests, flexible update system
  canUpdateAfterValidation: true,
  
  // Source: Test "Delete Parcel"
  // ⚠️ Test returned HTTP 405 - endpoint not working
  canDeleteBeforeValidation: false,
  
  // Source: Delete doesn't work at all
  canDeleteAfterValidation: false,
  
  // ─── Package Options ──────────────────────────────────────────────────
  // Source: Not in API
  canOpenPackage: false,
  
  // Source: Not supported
  canExchange: false,
  
  // Source: Not supported
  canPartialDelivery: false,
  
  // Source: No fragile field in API
  supportsFragileFlag: false,
  
  // ─── Tracking & Communication ─────────────────────────────────────────
  // Source: Test "Get Tracking History"
  canTrack: true,
  
  // Source: No remarks endpoint
  canAddRemarks: false,
  
  // Source: No remarks endpoint
  canGetRemarks: false,
  
  // Source: API response has no label field in create
  providesLabelOnCreate: false,
  
  // Source: Note "Label URLs are temporary (expire ~1 hour)"
  // Source: API response contains SAS token in label URL
  labelUrlExpires: true,
  
  // ─── Limits ───────────────────────────────────────────────────────────
  // Source: No documented limit
  maxWeightKg: null,
  
  // Source: Tested limit
  maxBulkCreate: 100,
  
  // Source: No bulk validate (auto-validates)
  maxBulkValidate: 0,
  
  // Source: Algerian market
  supportedCurrencies: ["DZD"],
  
  // ─── Territory ────────────────────────────────────────────────────────
  // Source: Note "Uses UUID-based territory IDs"
  // Source: API response has UUID format ID
  territorySystem: "uuid",
  
  // Source: Test "Create Customer"
  requiresCustomerCreation: true,
  
  // ─── Webhooks ─────────────────────────────────────────────────────────
  // Source: ZR Express supports webhooks
  supportsWebhooks: true,
  
  // Source: API-based registration via /webhooks/endpoints
  webhookRegistrationType: "api",
};

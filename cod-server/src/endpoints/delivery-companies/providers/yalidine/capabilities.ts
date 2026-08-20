/**
 * Yalidine Provider Capabilities
 * 
 * Auto-generated from test data analysis
 * Source: scripts/extract-capabilities.ts
 * 
 * Test Results: 8/9 passed (89%)
 * Confidence: 5 high, 3 medium, 1 low
 */

import type { ProviderCapabilities } from "../capabilities";

export const YALIDINE_CAPABILITIES: ProviderCapabilities = {
  // ─── Delivery Types ───────────────────────────────────────────────────
  // Source: Default (assumed supported)
  canHomeDelivery: true,
  
  // Source: Default (assumed supported)
  // Source: Test script payload includes is_stopdesk
  canStopDesk: true,
  
  // ─── Lifecycle ────────────────────────────────────────────────────────
  // Source: Test script has no validate test
  // Source: Note "Yalidine auto-validates on creation"
  autoValidates: true,
  
  // Source: Test "Update Parcel"
  // Source: Works when status is "En préparation"
  canUpdateBeforeValidation: true,
  
  // Source: Test "Try Update After Status Change"
  // Source: Rejected after status changes
  // ⚠️ Also fails if label has been printed
  canUpdateAfterValidation: false,
  
  // Source: Test "Delete Parcel"
  // Source: Works when status is "En préparation"
  canDeleteBeforeValidation: true,
  
  // Source: Test "Try Delete Already Deleted Parcel"
  // Source: Rejected after status changes
  canDeleteAfterValidation: false,
  
  // ─── Package Options ──────────────────────────────────────────────────
  // Source: Not in API
  canOpenPackage: false,
  
  // Source: Test script payload includes has_exchange
  canExchange: true,
  
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
  
  // Source: API response includes label field in create
  providesLabelOnCreate: true,
  
  // Source: Permanent URL (no SAS token)
  labelUrlExpires: false,
  
  // ─── Limits ───────────────────────────────────────────────────────────
  // Source: Documented limit
  maxWeightKg: 30,
  
  // Source: Tested limit
  maxBulkCreate: 100,
  
  // Source: No bulk validate (auto-validates)
  maxBulkValidate: 0,
  
  // Source: Algerian market
  supportedCurrencies: ["DZD"],
  
  // ─── Territory ────────────────────────────────────────────────────────
  // Source: Test script payload uses from_wilaya_name, to_wilaya_name
  territorySystem: "wilaya_name",
  
  // Source: Test script has no customer creation test
  requiresCustomerCreation: false,
  
  // ─── Webhooks ─────────────────────────────────────────────────────────
  // Source: Yalidine supports webhooks
  supportsWebhooks: true,
  
  // Source: Manual setup in Yalidine dashboard
  webhookRegistrationType: "manual",
};

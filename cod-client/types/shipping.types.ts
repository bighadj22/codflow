/** Per-wilaya rate within a shipping profile. */
export interface ShippingRule {
  id: string;
  profileId: string;
  wilayaId: number;
  wilayaName: string;    // "Alger"
  wilayaNameAr: string;  // "الجزائر"
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
  /** How many products override the store default with this profile. */
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingProfileWithRules extends Omit<ShippingProfile, "ruleCount"> {
  rules: ShippingRule[];
}

/** Commune-level override (price + availability) for a wilaya rule. */
export interface CommuneOverride {
  communeId: string;
  communeName: string;
  communeNameAr: string;
  postalCode: string | null;
  /** null = inherited from wilaya rule */
  homeEnabled: boolean | null;
  /** null = inherited from wilaya rule */
  stopDeskEnabled: boolean | null;
  /** null = inherited from wilaya rule */
  homePrice: number | null;
  /** null = inherited from wilaya rule */
  stopDeskPrice: number | null;
  effectiveHomeEnabled: boolean;
  effectiveStopDeskEnabled: boolean;
  effectiveHomePrice: number;
  effectiveStopDeskPrice: number;
  hasOverride: boolean;
}

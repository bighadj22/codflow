/**
 * Delivery Provider Registry
 *
 * Returns the correct DeliveryProvider adapter for a given company.
 * Add new adapters here as new companies are onboarded.
 *
 * Supported: noest | zr_express | yalidine | ecotrack (used by Packers and other EcoTrack-platform companies)
 */

import type { DeliveryProvider } from "./types";
import { NoestProvider } from "./noest/adapter";
import { ZrExpressProvider } from "./zr_express/adapter";
import { YalidineProvider } from "./yalidine/adapter";
import { EcotrackProvider } from "./ecotrack/adapter";

export interface ProviderCompany {
  code: string;
  apiToken: string | null;
  apiUserGuid: string | null;
  apiEndpoint: string | null;
  /** Optional JSON string for provider-specific config (e.g. from_wilaya_name for Yalidine). */
  notes?: string | null;
}

/**
 * Returns true for any company running on the EcoTrack platform.
 * Matches the plain "ecotrack" code (legacy direct account) and the
 * multi-company pattern "packers_ecotrack", "tnt_ecotrack", etc.
 * Use this instead of `=== "ecotrack"` everywhere so renaming a company
 * never silently breaks adapter selection or feature guards.
 */
export function isEcotrackCompany(code: string): boolean {
  return code === "ecotrack" || code.endsWith("_ecotrack");
}

/**
 * Get the provider adapter for a delivery company.
 * Throws if the code is unsupported or required credentials are missing.
 */
export function getProvider(company: ProviderCompany): DeliveryProvider {
  switch (company.code) {
    case "noest": {
      if (!company.apiToken) throw new Error("NOEST: api_token is required");
      if (!company.apiUserGuid) throw new Error("NOEST: api_user_guid is required");
      return new NoestProvider(company.apiToken, company.apiUserGuid);
    }

    case "zr_express": {
      if (!company.apiToken) throw new Error("ZR Express: api_token is required");
      if (!company.apiUserGuid) throw new Error("ZR Express: tenant_id (apiUserGuid) is required");
      return new ZrExpressProvider(company.apiToken, company.apiUserGuid);
    }

    case "yalidine": {
      if (!company.apiToken) throw new Error("Yalidine: X-API-TOKEN (apiToken) is required");
      if (!company.apiUserGuid) throw new Error("Yalidine: X-API-ID (apiUserGuid) is required");
      // Parse optional from_wilaya_name from notes JSON (sender wilaya on every parcel)
      let fromWilayaName = "Alger";
      if (company.notes) {
        try {
          const notesJson = JSON.parse(company.notes) as { from_wilaya_name?: string };
          if (notesJson.from_wilaya_name) fromWilayaName = notesJson.from_wilaya_name;
        } catch {
          // Invalid JSON in notes — ignore and use default
        }
      }
      return new YalidineProvider(company.apiToken, company.apiUserGuid, fromWilayaName);
    }

    default:
      // "ecotrack" is a platform used by multiple delivery companies.
      // Each company gets a unique code: "packers_ecotrack", "tnt_ecotrack", etc.
      // The plain "ecotrack" code is also valid (legacy / direct EcoTrack account).
      if (company.code === "ecotrack" || company.code.endsWith("_ecotrack")) {
        if (!company.apiToken)    throw new Error("EcoTrack: api_token is required");
        if (!company.apiEndpoint) throw new Error("EcoTrack: api_endpoint (base URL) is required");
        return new EcotrackProvider(company.apiToken, company.apiEndpoint);
      }
      throw new Error(`No provider adapter for company code: "${company.code}"`);
  }
}

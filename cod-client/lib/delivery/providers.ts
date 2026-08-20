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

/**
 * Returns the ProviderConfig for a company code.
 */
export function getProviderConfig(code: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[code];
}

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
  packers_ecotrack: {
    code: "packers_ecotrack",
    name: "Packers",
    nameAr: "باكرز",
    website: "https://ecotrack.dz",
    apiEndpoint: "https://ecotrack.dz",
    supportsHomeDelivery: true,
    supportsStopDesk: true,
    supportsTracking: true,
    requiresUserGuid: false,
    requiresEndpoint: true,
    endpointDefault: "https://ecotrack.dz",
  },
};

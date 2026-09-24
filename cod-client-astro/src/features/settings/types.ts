export type StoreLang = "ar" | "en" | "fr";
export type StoreStatus = "active" | "inactive";

/** The single tenant's configuration as returned by the stores API. */
export interface StoreConfig {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  themeId: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  fontFamily: string;
  fontUrl: string | null;
  lang: StoreLang;
  currency: string;
  currencySymbol: string;
  contentJson: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  announcementBar: string | null;
  reviewsEnabled: boolean;
  /** Shopping cart opt-in. False keeps the storefront exactly as it is. */
  cartEnabled: boolean;
  /** Order subtotal (DZD) at or above which delivery is free. null = off. */
  freeShippingThreshold: number | null;
  /** Which rate a basket spanning several shipping profiles pays. */
  cartShippingMode: "highest" | "default_profile";
  status: StoreStatus;
  storeApiKey: string | null;
}

export type UpdateStoreData = Partial<
  Pick<
    StoreConfig,
    | "name"
    | "domain"
    | "logoUrl"
    | "primaryColor"
    | "accentColor"
    | "bgColor"
    | "fontFamily"
    | "fontUrl"
    | "lang"
    | "currencySymbol"
    | "contentJson"
    | "metaTitle"
    | "metaDescription"
    | "ogImage"
    | "announcementBar"
    | "reviewsEnabled"
    | "cartEnabled"
    | "freeShippingThreshold"
    | "cartShippingMode"
    | "status"
  >
>;

/** Meta pixel tracking configuration. Absent until first saved. */
export interface PixelConfig {
  id: string;
  storeId: string;
  pixelId: string;
  adAccountName: string | null;
  accessTokenMasked: string;
  testEventCode: string | null;
  conversionEvent: "Purchase" | "Purchase_Confirmed" | "Purchase_Delivered" | "Lead";
  testMode: boolean;
  enabled: boolean;
  /** Master switch for per-landing-page pixels — off means every page uses this one. */
  perPageTrackingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavePixelConfigData {
  pixelId: string;
  adAccountName?: string | null;
  accessToken?: string;
  testEventCode?: string | null;
  conversionEvent: "Purchase" | "Purchase_Confirmed" | "Purchase_Delivered" | "Lead";
  testMode?: boolean;
  enabled?: boolean;
  /** Omitted keeps the stored value — an unrelated edit must not reset it. */
  perPageTrackingEnabled?: boolean;
}

/** WhatsApp OTP verification configuration (dzverify). Absent until first saved — null = disabled. */
export interface OtpConfig {
  language: "en" | "fr" | "ar";
  enabled: boolean;
  apiKeyMasked: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveOtpConfigData {
  apiKey?: string;
  language?: "en" | "fr" | "ar";
  enabled?: boolean;
}

export interface OtpConnectionCheck {
  ok: boolean;
  reason?: string;
  message?: string;
  balanceDa?: number;
  otpEstimate?: number;
  plan?: string;
  outOfCredits?: boolean;
}

/** Cloudflare Turnstile checkout bot-protection configuration. Absent until first saved — null = disabled. */
export interface TurnstileConfig {
  siteKey: string;
  enabled: boolean;
  secretKeyMasked: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTurnstileConfigData {
  siteKey?: string;
  secretKey?: string;
  enabled?: boolean;
}

/** Sendili transactional email configuration. Absent until first saved — null = disabled. */
export interface EmailConfig {
  fromEmail: string;
  fromName: string | null;
  enabled: boolean;
  apiKeyMasked: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveEmailConfigData {
  apiKey?: string;
  fromEmail: string;
  fromName?: string | null;
  enabled?: boolean;
}

export interface EmailConnectionCheck {
  ok: boolean;
  reason?: string;
  message?: string;
  domains?: string[];
  outOfCredits?: boolean;
}

export type StoreLang = "ar" | "en";
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
  status: StoreStatus;
  storeApiKey: string | null;
}

export type UpdateStoreData = Partial<
  Pick<
    StoreConfig,
    | "name"
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
    | "status"
  >
>;

/** Meta pixel tracking configuration. Absent until first saved. */
export interface PixelConfig {
  id: string;
  storeId: string;
  pixelId: string;
  accessToken: string;
  testEventCode: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavePixelConfigData {
  pixelId: string;
  accessToken?: string;
  testEventCode?: string | null;
  enabled?: boolean;
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

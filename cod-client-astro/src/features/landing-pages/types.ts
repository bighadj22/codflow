/**
 * The part of a page's tracking that a list row or a badge needs — everything
 * except the credential. Widened by `LandingPageTracking` for the edit dialog.
 */
export interface LandingPageTrackingSummary {
  pixelId: string;
  conversionEvent: "Lead" | "Purchase" | "Purchase_Confirmed" | "Purchase_Delivered";
  enabled: boolean;
  testMode: boolean;
}

export interface LandingPageImage {
  id: string;
  landingPageId: string;
  r2Key: string;
  src: string;
  altText: string | null;
  source: "upload" | "ai";
  position: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export type LandingPageStatus = "draft" | "published" | "archived";

export interface LandingPageStats {
  views: number;
  orders: number;
  revenue: number;
}

export interface LandingPageProductRef {
  id: string;
  name: string;
  handle: string;
  price: number;
}

export interface LandingPage {
  id: string;
  slug: string;
  name: string;
  productId: string;
  status: LandingPageStatus;
  imageGap: number;
  metaTitle: string | null;
  metaDescription: string | null;
  views: number;
  /** Server-resolved shareable URL (store domain or deployment fallback). */
  publicUrl: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: LandingPageImage[];
  product: LandingPageProductRef | null;
  stats: LandingPageStats;
}

export interface LandingPageListItem {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "published" | "archived";
  productId: string;
  productName: string | null;
  productHandle: string | null;
  imageCount: number;
  views: number;
  orders: number;
  revenue: number;
  publicUrl: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** This page's own pixel, or null when it inherits the store's. Never the token. */
  tracking: LandingPageTrackingSummary | null;
}

export interface CreateLandingPageInput {
  name: string;
  slug?: string;
  productId: string;
}

export interface UpdateLandingPageInput {
  name?: string;
  slug?: string;
  imageGap?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface SaveLandingPageImageInput {
  key: string;
  src: string;
  altText?: string | null;
  /** Intrinsic pixel size, measured in the browser before upload — the
   *  storefront renders width/height from these so the page doesn't shift
   *  while images load. Omitted when measurement fails (fail-open). */
  width?: number;
  height?: number;
}

/**
 * A landing page's own Meta Pixel + Conversions API configuration, which
 * REPLACES the store's for that page. Absent (null) for a page that inherits
 * the store pixel — the default for every page.
 */
export interface LandingPageTracking extends LandingPageTrackingSummary {
  id: string;
  landingPageId: string;
  adAccountName: string | null;
  /** Last four characters only — the token itself never leaves the server. */
  accessTokenMasked: string;
  testEventCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveLandingPageTrackingInput {
  pixelId: string;
  /** Required when creating; empty on an update keeps the stored token. */
  accessToken?: string;
  adAccountName?: string | null;
  testEventCode?: string | null;
  conversionEvent: "Purchase" | "Purchase_Confirmed" | "Purchase_Delivered" | "Lead";
  testMode?: boolean;
  enabled?: boolean;
}

/**
 * The most recent Conversions API attempt for an order this page produced.
 * Proof that a campaign is reporting — including Meta's own message when it
 * is not.
 */
export interface LandingPageTrackingActivity {
  eventName: string;
  stage: string;
  status: string;
  pixelId: string | null;
  error: string | null;
  sentAt: string;
}

/** What the tracking panel reads: the configuration and the proof. */
export interface LandingPageTrackingState {
  config: LandingPageTracking | null;
  lastEvent: LandingPageTrackingActivity | null;
}

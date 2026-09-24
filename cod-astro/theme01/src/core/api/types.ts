import { z } from "astro/zod";
import { 
  ProductSchema, 
  CategorySchema, 
  ProductImageSchema, 
  ProductVariantSchema,
  OfferSchema
} from "./validation";

export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type ProductImage = z.infer<typeof ProductImageSchema>;
export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type Offer = z.infer<typeof OfferSchema>;

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
  lang: "ar" | "en" | "fr";
  currency: string;
  currencySymbol: string;
  contentJson: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  announcementBar: string | null;
  reviewsEnabled: boolean;
  /** When true the storefront renders the cart alongside the direct order form. */
  cartEnabled: boolean;
  /** Subtotal (DZD) at or above which delivery is free. null = no threshold. */
  freeShippingThreshold: number | null;
  otpEnabled: boolean;
  /** Cloudflare Turnstile — true only when a store_turnstile_config row exists AND is enabled. */
  turnstileEnabled: boolean;
  /** Public widget site key; null when Turnstile is disabled. The secret never leaves cod-server. */
  turnstileSiteKey: string | null;
  status: "active" | "inactive";
  pixelId?: string | null;
  conversionEvent?: "Purchase" | "Purchase_Confirmed" | "Purchase_Delivered" | "Lead" | null;
  /**
   * Published pages that opt into the footer, titled in the store's own
   * language, ordered for display. The checkout consent line resolves Terms/
   * Refund from here by `kind` — never a hardcoded slug, since a merchant may
   * rename any page's slug freely.
   */
  pages: StorePageLink[];
  /**
   * The public subset of the store's legal profile. Null until the merchant
   * saves one from the dashboard (Settings → Store Pages) — RC/NIF are never
   * exposed here, only inside the legal documents themselves.
   */
  legalContact: StoreLegalContact | null;
}

export interface StorePageLink {
  id: string;
  kind: "terms" | "privacy" | "refund" | "shipping" | "custom";
  slug: string;
  title: string;
  position: number;
}

export interface StoreLegalContact {
  contactEmail: string | null;
  contactPhone: string | null;
  deliveryMinDays: number;
  deliveryMaxDays: number;
}

/** A resolved store page — GET /store/pages/{slug}. */
export interface StorePagePublic {
  id: string;
  kind: "terms" | "privacy" | "refund" | "shipping" | "custom";
  slug: string;
  locale: "ar" | "en" | "fr";
  title: string;
  /** Sanitised HTML. Render with set:html and never re-sanitise. */
  bodyHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface ShippingRates {
  [wilayaId: string]: { home: number; stopDesk: number };
}

export interface Wilaya {
  id: number;
  name: string;
  nameAr: string;
}

export interface Commune {
  id: string;
  name: string;
  nameAr: string;
}

export interface Review {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
}

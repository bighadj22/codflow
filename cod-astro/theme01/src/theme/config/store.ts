// ╔══════════════════════════════════════════════════════════════════════╗
// ║  CUSTOMIZE HERE (Custom mode) — DEFAULT_CONFIG only                  ║
// ║  Edit DEFAULT_CONFIG to change fallback colors/font/meta when the    ║
// ║  API is unreachable. All other code in this file is core engine.     ║
// ╚══════════════════════════════════════════════════════════════════════╝
/**
 * Per-request store data helpers.
 * Call once per page — pass the returned config to StoreLayout to avoid
 * duplicate API fetches.
 */
import { fetchStoreConfig } from "@/core/api/client";
import { resolveContent } from "@/theme/content";
import type { StoreConfig } from "@/core/api/types";
import type { StoreFrontContent } from "@/theme/content";

export const DEFAULT_CONFIG: StoreConfig = {
  id: "",
  name: "متجري",
  domain: null,
  logoUrl: null,
  themeId: "theme01",
  primaryColor: "#7c3aed",
  accentColor: "#f59e0b",
  bgColor: "#f8f8f8",
  fontFamily: "Cairo, sans-serif",
  fontUrl: null,
  lang: "ar",
  currency: "DZD",
  currencySymbol: "دج",
  contentJson: null,
  metaTitle: null,
  metaDescription: null,
  ogImage: null,
  announcementBar: null,
  reviewsEnabled: true,
  otpEnabled: false,
  status: "active",
  pixelId: null,
};

export interface StoreContext {
  config: StoreConfig;
  content: StoreFrontContent;
  isRTL: boolean;
}

export async function getStoreContext(): Promise<StoreContext> {
  const config = (await fetchStoreConfig()) ?? DEFAULT_CONFIG;
  const content = resolveContent(config.lang, config.contentJson);
  const isRTL = config.lang === "ar";
  return { config, content, isRTL };
}

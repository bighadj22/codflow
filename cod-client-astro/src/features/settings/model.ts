import { BarChart2, Key, Palette, Search, ShieldCheck, Star, Store, type LucideIcon } from "lucide-react";

export type CategoryId = "general" | "branding" | "seo" | "reviews" | "analytics" | "verification" | "api";

export interface SettingsCategory {
  id: CategoryId;
  icon: LucideIcon;
  /** Dot-path into the settings `store` namespace. */
  labelKey: string;
}

/** The settings categories, in sidebar order. */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: "general", icon: Store, labelKey: "general_title" },
  { id: "branding", icon: Palette, labelKey: "branding_title" },
  { id: "seo", icon: Search, labelKey: "seo_title" },
  { id: "reviews", icon: Star, labelKey: "reviews_title" },
  { id: "analytics", icon: BarChart2, labelKey: "tracking_title" },
  { id: "verification", icon: ShieldCheck, labelKey: "otp_title" },
  { id: "api", icon: Key, labelKey: "api_key_title" },
];

export function settingsErrorMessage(_cause: unknown, t: (key: string) => string) {
  return t("store.save_error");
}

"use client";

import { useLanguage } from "@/lib/i18n-context";
import type { Locale } from "./mapper";

/**
 * Returns the current UI locale for use in error messages.
 * Registry entries with no `fr` field fall back to English automatically in mapError.
 */
export function useErrorLocale(): Locale {
  const { locale } = useLanguage();
  return locale as Locale;
}

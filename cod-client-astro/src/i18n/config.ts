export const LOCALES = ["ar", "en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

const STORAGE_KEY = "locale"; // same key the legacy dashboard used

function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** localStorage → cookie → default. Mirrors the legacy dashboard contract. */
export function detectLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${STORAGE_KEY}=`))
      ?.split("=")[1];
    if (isLocale(cookie)) return cookie;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LOCALE;
}

/** Persist choice everywhere the app reads it, sync <html> attrs, notify listeners. */
export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.cookie = `${STORAGE_KEY}=${locale};max-age=${365 * 24 * 60 * 60};path=/`;
  } catch {
    /* storage unavailable */
  }
  applyDocumentLocale(locale);
  window.dispatchEvent(new CustomEvent("codflow:locale", { detail: locale }));
}

/** Pre-paint sync of <html lang/dir> — called by the inline boot script too. */
export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

import { useEffect, useMemo, useState } from "react";
import { detectLocale, persistLocale, applyDocumentLocale, type Locale } from "./config";
import { getDict, type Namespace } from "./dictionaries";
import { makeT as buildT } from "./core";

/** Current locale, read once per island mount (client-only islands only). */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    const sync = () => setLocale(detectLocale());
    window.addEventListener("codflow:locale", sync);
    return () => window.removeEventListener("codflow:locale", sync);
  }, []);

  return locale;
}

/** Translator for a namespace. Synchronous — dictionaries are bundled. */
export function useT(ns: Namespace): (key: string) => string {
  const locale = useLocale();
  return useMemo(() => buildT(getDict(locale, ns), getDict("en", ns)), [locale, ns]);
}

export function switchLocale(locale: Locale): void {
  persistLocale(locale);
  applyDocumentLocale(locale);
  // Dictionaries are bundled per locale — a reload swaps every string at once.
  window.location.reload();
}

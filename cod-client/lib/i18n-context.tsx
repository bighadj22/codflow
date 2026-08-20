"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Locale = "ar" | "en" | "fr";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "rtl" | "ltr";
  isHydrated: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Get initial locale from localStorage (client-side only)
function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ar"; // SSR default
  
  try {
    const saved = localStorage.getItem("locale");
    return (saved === "en" || saved === "ar" || saved === "fr") ? saved as Locale : "ar";
  } catch {
    return "ar";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start with "ar" to match the SSR default — localStorage sync happens after hydration
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [isHydrated, setIsHydrated] = useState(false);

  // After hydration, sync with localStorage preference and mirror to cookie
  useEffect(() => {
    setIsHydrated(true);
    const savedLocale = getInitialLocale();
    if (savedLocale !== locale) {
      setLocaleState(savedLocale);
    }
    // Ensure cookie is in sync so server actions can read locale
    try {
      document.cookie = `locale=${savedLocale};max-age=${365 * 24 * 60 * 60};path=/`;
    } catch {
      // ignore
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);

    try {
      localStorage.setItem("locale", newLocale);
      // Mirror to cookie so server actions (error messages) can read the locale
      document.cookie = `locale=${newLocale};max-age=${365 * 24 * 60 * 60};path=/`;
    } catch {
      // Handle storage errors gracefully
    }
    
    // Update document attributes immediately
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLocale;
      document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
    }
  };

  const dir = locale === "ar" ? "rtl" : "ltr";

  // Apply attributes on mount/change (only after hydration)
  useEffect(() => {
    if (isHydrated && typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir, isHydrated]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, dir, isHydrated }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

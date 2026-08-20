import { cookies } from "next/headers";

/**
 * Supported locales for error messages (matches the UI i18n system)
 */
export type Locale = "en" | "ar" | "fr";

/**
 * Get the user's locale preference for error messages
 * 
 * Priority order:
 * 1. Check "locale" cookie
 * 2. Check browser Accept-Language header
 * 3. Default to "en"
 * 
 * @returns The user's locale preference ("en" or "ar")
 */
export async function getLocale(): Promise<Locale> {
  // 1. Check user preference in cookies
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale");
  
  if (localeCookie?.value === "ar" || localeCookie?.value === "en" || localeCookie?.value === "fr") {
    return localeCookie.value;
  }
  
  // 2. Check browser Accept-Language header
  // Note: In Next.js server components, we can't directly access Accept-Language
  // but we can check if it was stored in a cookie by middleware
  const acceptLanguage = cookieStore.get("accept-language")?.value;
  if (acceptLanguage?.includes("ar")) return "ar";
  if (acceptLanguage?.includes("fr")) return "fr";

  // 3. Default to English
  return "en";
}

/**
 * Set the user's locale preference
 * 
 * @param locale - The locale to set ("en" or "ar")
 */
export async function setLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  });
}

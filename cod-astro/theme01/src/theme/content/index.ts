/**
 * Content Loader
 * 
 * Loads and resolves content based on language and dashboard overrides.
 * 
 * @example
 * ```typescript
 * import { resolveContent } from "@/theme/content";
 * 
 * const content = resolveContent("ar", dashboardContentJson);
 * ```
 */

import { ar } from "./ar";
import { en } from "./en";
import { fr } from "./fr";
import type { StoreFrontContent } from "./types";

/**
 * Language registry
 * Add new languages here as they become available
 */
const languages = {
  ar,
  en,
  fr,
} as const;

export type SupportedLanguage = keyof typeof languages;

/**
 * Resolve content for a given language with optional dashboard overrides
 * 
 * @param lang - Language code ("ar" or "en")
 * @param contentJson - Optional JSON string from dashboard with content overrides
 * @returns Complete StoreFrontContent object with all required keys
 * 
 * @example
 * ```typescript
 * // Use default Arabic content
 * const content = resolveContent("ar");
 * 
 * // Use Arabic with dashboard overrides
 * const content = resolveContent("ar", '{"heroTitle": "Custom Title"}');
 * ```
 */
export function resolveContent(
  lang: SupportedLanguage,
  contentJson?: string | null
): StoreFrontContent {
  // Get default content for language
  const defaults = languages[lang] || languages.ar;

  // No overrides - return defaults
  if (!contentJson) {
    return defaults;
  }

  // Parse and merge overrides
  try {
    const overrides = JSON.parse(contentJson) as Partial<StoreFrontContent>;
    return { ...defaults, ...overrides };
  } catch (error) {
    // Invalid JSON - return defaults
    console.warn("Failed to parse content JSON, using defaults:", error);
    return defaults;
  }
}

/**
 * Get list of supported languages
 * 
 * @returns Array of language codes
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return Object.keys(languages) as SupportedLanguage[];
}

/**
 * Check if a language is supported
 * 
 * @param lang - Language code to check
 * @returns true if language is supported
 */
export function isLanguageSupported(lang: string): lang is SupportedLanguage {
  return lang in languages;
}

// Re-export types for convenience
export type { StoreFrontContent } from "./types";

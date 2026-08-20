/**
 * @deprecated This file is kept for backward compatibility only.
 * 
 * Content has been moved to src/theme/content/ for better organization:
 * - src/theme/content/types.ts - Interface definition
 * - src/theme/content/ar.ts - Arabic content
 * - src/theme/content/en.ts - English content
 * - src/theme/content/index.ts - Content loader
 * 
 * Please update your imports to use:
 * ```typescript
 * import { resolveContent, type StoreFrontContent } from "@/theme/content";
 * ```
 */

// Re-export everything from the new location
export { resolveContent, getSupportedLanguages, isLanguageSupported } from "@/theme/content";
export type { StoreFrontContent, SupportedLanguage } from "@/theme/content";

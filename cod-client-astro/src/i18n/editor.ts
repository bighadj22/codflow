import { detectLocale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { makeT } from "@/i18n/core";
import type { Namespace } from "@/i18n/dictionaries";

/**
 * Translator for the Tiptap UI components under `src/components/tiptap-*`.
 *
 * Those components are vendored source (the Tiptap CLI copies them in), and many
 * of their user-visible labels live in module-level maps — accordion options,
 * mark labels, highlight colours — where a React hook cannot run. A plain
 * function is therefore the only shape that works in both places.
 *
 * Reading the locale at call time is safe here by design: `switchLocale`
 * reloads the page and every island remounts with the new dictionary
 * (see cod-client-astro/CONTEXT.md, "Language switching").
 */
export function editorT(key: string, ns: Namespace = "products"): string {
  const locale = detectLocale();
  return makeT(getDict(locale, ns), getDict("en", ns))(key);
}

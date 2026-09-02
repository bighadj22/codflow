import type { Dict } from "./dictionaries";

/** Resolve a dot-path ("table.total") inside a nested dictionary. */
export function resolve(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Dict)) {
      node = (node as Dict)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Translator with en fallback: locale dict → english dict → raw key.
 * Missing keys return the key itself so gaps are visible, never blank UI.
 */
export function makeT(
  localeDict: Dict,
  englishDict: Dict
): (key: string) => string {
  return (key: string) => resolve(localeDict, key) ?? resolve(englishDict, key) ?? key;
}

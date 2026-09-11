/**
 * ZR Express text normalization helpers.
 *
 * ZR's territory DB and workflow states store accent-free text ("Bechar",
 * "Setif", "MSila", "livre") while our reference data and ZR's display text
 * use accented French ("Béchar", "Sétif", "Livré"). ZR's keyword search is
 * accent-sensitive, so every comparison/search must run on the stripped form
 * (live-verified 2026-09-10: "Béchar" → 0 results, "Bechar" → wilaya 8).
 */
export function stripAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "");
}
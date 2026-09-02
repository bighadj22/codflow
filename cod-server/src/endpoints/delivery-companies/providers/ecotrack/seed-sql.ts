/**
 * EcoTrack Company Seed — SQL Builders
 *
 * Pure functions generating the idempotent upserts that seed the 82 EcoTrack
 * couriers into delivery_companies. Consumed by scripts/seed-ecotrack-
 * companies.mjs (via Node native TS stripping) and unit-tested here — hence
 * NO runtime imports in this module (type-only), and the company-code rule
 * is cross-checked against catalog.ts by seed-sql.test.ts.
 *
 * Contract:
 *   - INSERT with code={key}_ecotrack, catalog names, pattern baseUrl,
 *     active=0 (inactive until a merchant adds a token), NO token,
 *     auto_validate=0 (mirrors the API-layer default for the EcoTrack family)
 *   - ON CONFLICT(code) refreshes ONLY name / name_ar / api_endpoint /
 *     updated_at — merchant-owned state (api_token, auto_validate, active,
 *     notes) is NEVER touched on re-runs
 */

import type { EcotrackCourier } from "../../../../../../cod-shared/lib/ecotrack-couriers";

/** Deterministic row id — stable across runs and fresh databases. */
export function ecotrackCompanyId(key: string): string {
  return `ecotrack-${key}`;
}

/** Mirrors catalog.ecotrackCompanyCode — kept local so this module has no runtime imports. */
function companyCode(key: string): string {
  return `${key}_ecotrack`;
}

function sqlString(value: string | null): string {
  if (value === null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

/** Columns written on INSERT but protected from the conflict UPDATE. */
const PROTECTED_COLUMNS = ["api_token", "auto_validate", "active", "notes"] as const;

export function buildEcotrackCompanyUpsert(courier: EcotrackCourier, timestamp: string): string {
  const id = ecotrackCompanyId(courier.key);
  const code = companyCode(courier.key);

  const columns =
    "(id, name, name_ar, code, website, active, api_endpoint, api_token, api_user_guid, supports_home_delivery, supports_stop_desk, supports_tracking, webhook_secret, webhook_endpoint_id, webhook_status_mapping, auto_validate, notes, created_at, updated_at)";
  const values = [
    sqlString(id),
    sqlString(courier.name),
    sqlString(courier.nameAr),
    sqlString(code),
    "NULL",
    "0",
    sqlString(courier.baseUrl),
    "NULL",
    "NULL",
    "1",
    "1",
    "1",
    "NULL",
    "NULL",
    "NULL",
    "0",
    "NULL",
    sqlString(timestamp),
    sqlString(timestamp),
  ].join(", ");

  return [
    `INSERT INTO delivery_companies ${columns} VALUES (${values})`,
    `ON CONFLICT(code) DO UPDATE SET`,
    `  name = excluded.name,`,
    `  name_ar = excluded.name_ar,`,
    `  api_endpoint = excluded.api_endpoint,`,
    `  updated_at = excluded.updated_at;`,
  ].join("\n");
}

export function buildAllEcotrackCompanyUpserts(
  couriers: readonly EcotrackCourier[],
  timestamp: string = new Date().toISOString()
): string[] {
  return couriers.map((c) => buildEcotrackCompanyUpsert(c, timestamp));
}

/** True when no protected column appears in the conflict UPDATE clause. */
export function updateClauseIsSafe(statement: string): boolean {
  const updateClause = statement.split("DO UPDATE SET")[1] ?? "";
  return !PROTECTED_COLUMNS.some((col) =>
    new RegExp(`(^|[^a-z_])${col}([^a-z_]|$)`).test(updateClause)
  );
}

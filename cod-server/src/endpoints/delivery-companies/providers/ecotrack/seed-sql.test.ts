/**
 * EcoTrack Company Seed — SQL Builder Tests
 *
 * Locks the idempotency + no-clobber contract of the 82-company upserts
 * before a single statement reaches D1.
 */

import { describe, it, expect } from "vitest";
import {
  buildEcotrackCompanyUpsert,
  buildAllEcotrackCompanyUpserts,
  ecotrackCompanyId,
  updateClauseIsSafe,
} from "./seed-sql";
import {
  ECOTRACK_COURIERS,
  ecotrackCompanyCode,
} from "../../../../../../cod-shared/lib/ecotrack-couriers";

const TS = "2026-09-01T00:00:00.000Z";

describe("ecotrackCompanyId", () => {
  it("is deterministic and readable", () => {
    expect(ecotrackCompanyId("dhd")).toBe("ecotrack-dhd");
    expect(ecotrackCompanyId("e48hrlivraison")).toBe("ecotrack-e48hrlivraison");
  });
});

describe("buildEcotrackCompanyUpsert", () => {
  const dhd = ECOTRACK_COURIERS.find((c) => c.key === "dhd")!;
  const stmt = buildEcotrackCompanyUpsert(dhd, TS);

  it("inserts the catalog identity with the _ecotrack company code", () => {
    expect(stmt).toContain(`'${ecotrackCompanyId("dhd")}'`);
    expect(stmt).toContain(`'DHD Livraison'`);
    expect(stmt).toContain(`'دي إتش دي للتوصيل'`);
    expect(stmt).toContain(`'${ecotrackCompanyCode("dhd")}'`);
    expect(stmt).toContain(`'https://dhd.ecotrack.dz'`);
  });

  it("seeds inactive with no token and manual validation", () => {
    expect(stmt).toMatch(/,\s*0,/);
    expect(stmt).toContain("auto_validate");
    expect(stmt).toMatch(/NULL,\s*NULL,\s*1,\s*1,\s*1,/);
  });

  it("conflict-updates ONLY catalog fields — merchant state is never clobbered", () => {
    const updateClause = stmt.split("DO UPDATE SET")[1];
    expect(updateClause).toContain("name = excluded.name");
    expect(updateClause).toContain("name_ar = excluded.name_ar");
    expect(updateClause).toContain("api_endpoint = excluded.api_endpoint");
    expect(updateClause).toContain("updated_at = excluded.updated_at");
    expect(updateClauseIsSafe(stmt)).toBe(true);
  });

  it("escapes single quotes in names", () => {
    const statement = buildEcotrackCompanyUpsert(
      { key: "test", name: "L'Express", nameAr: "ل'توصيل", baseUrl: "https://test.ecotrack.dz" },
      TS
    );
    expect(statement).toContain("'L''Express'");
  });
});

describe("buildAllEcotrackCompanyUpserts", () => {
  it("produces one upsert per catalog courier", () => {
    const statements = buildAllEcotrackCompanyUpserts(ECOTRACK_COURIERS, TS);
    expect(statements).toHaveLength(82);
    for (const stmt of statements) {
      expect(stmt).toMatch(/^INSERT INTO delivery_companies/);
      expect(stmt).toMatch(/ON CONFLICT\(code\) DO UPDATE SET/);
      expect(updateClauseIsSafe(stmt)).toBe(true);
    }
  });

  it("company codes in SQL match catalog.ecotrackCompanyCode exactly (no drift)", () => {
    const statements = buildAllEcotrackCompanyUpserts(ECOTRACK_COURIERS, TS);
    const sqlCodes = statements.map((s) => s.match(/'([a-z0-9_]+_ecotrack)'/)![1]);
    const catalogCodes = ECOTRACK_COURIERS.map((c) => ecotrackCompanyCode(c.key));
    expect(sqlCodes).toEqual(catalogCodes);
  });

  it("covers every company code exactly once", () => {
    const statements = buildAllEcotrackCompanyUpserts(ECOTRACK_COURIERS);
    const codes = statements.map((s) => s.match(/([a-z0-9_]+_ecotrack)/)![1]);
    expect(new Set(codes).size).toBe(82);
    expect(codes).toContain("dhd_ecotrack");
    expect(codes).toContain("packers_ecotrack");
    expect(codes).toContain("zinyatec_ecotrack");
  });
});

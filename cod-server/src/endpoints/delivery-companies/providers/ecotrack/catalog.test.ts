/**
 * EcoTrack Tenant Catalog — Contract Tests
 *
 * The catalog is frozen reference data feeding the 82-company seed:
 *   - exactly the 82 couriers from about.md, keys never drifting
 *   - every key yields a valid, unique, adapter-routable company code
 *   - every baseUrl follows the *.ecotrack.dz tenant pattern
 *   - the generic "ecotrack" fallback stays OUT of the catalog
 */

import { describe, it, expect } from "vitest";
import {
  ECOTRACK_COURIERS,
  findEcotrackCourier,
  ecotrackCompanyCode,
} from "../../../../../../cod-shared/lib/ecotrack-couriers";
import { isEcotrackCompany } from "../registry";

const KEY_PATTERN = /^[a-z0-9]+$/;
const CODE_PATTERN = /^[a-z0-9_]+$/;
const URL_PATTERN = /^https:\/\/[a-z0-9]+\.ecotrack\.dz$/;

describe("ECOTRACK_COURIERS", () => {
  it("contains exactly the 82 dzship couriers", () => {
    expect(ECOTRACK_COURIERS).toHaveLength(82);
  });

  it("has unique keys", () => {
    const keys = ECOTRACK_COURIERS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has unique company codes", () => {
    const codes = ECOTRACK_COURIERS.map((c) => ecotrackCompanyCode(c.key));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every entry has non-empty names in both scripts", () => {
    for (const c of ECOTRACK_COURIERS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.nameAr.length).toBeGreaterThan(0);
    }
  });

  it("every key is lowercase alphanumeric and not the generic fallback", () => {
    for (const c of ECOTRACK_COURIERS) {
      expect(c.key).toMatch(KEY_PATTERN);
      expect(c.key).not.toBe("ecotrack");
    }
  });

  it("every company code is schema-valid and routes to the EcoTrack adapter", () => {
    for (const c of ECOTRACK_COURIERS) {
      const code = ecotrackCompanyCode(c.key);
      expect(code).toMatch(CODE_PATTERN);
      expect(isEcotrackCompany(code)).toBe(true);
    }
  });

  it("every baseUrl follows the *.ecotrack.dz tenant pattern", () => {
    for (const c of ECOTRACK_COURIERS) {
      expect(c.baseUrl).toMatch(URL_PATTERN);
      expect(c.baseUrl).toBe(`https://${c.key}.ecotrack.dz`);
    }
  });

  it("contains the reference couriers from about.md", () => {
    for (const key of ["dhd", "conexlog", "msmgo", "worldexpress", "packers", "zinyatec"]) {
      expect(findEcotrackCourier(key)).toBeDefined();
    }
  });
});

describe("findEcotrackCourier", () => {
  it("finds by exact key", () => {
    const dhd = findEcotrackCourier("dhd");
    expect(dhd?.name).toBe("DHD Livraison");
    expect(dhd?.baseUrl).toBe("https://dhd.ecotrack.dz");
  });

  it("returns undefined for unknown keys", () => {
    expect(findEcotrackCourier("unknown")).toBeUndefined();
    expect(findEcotrackCourier("ecotrack")).toBeUndefined();
    expect(findEcotrackCourier("DHD")).toBeUndefined();
  });
});

describe("ecotrackCompanyCode", () => {
  it("appends the load-bearing _ecotrack suffix", () => {
    expect(ecotrackCompanyCode("dhd")).toBe("dhd_ecotrack");
    expect(ecotrackCompanyCode("e48hrlivraison")).toBe("e48hrlivraison_ecotrack");
  });
});

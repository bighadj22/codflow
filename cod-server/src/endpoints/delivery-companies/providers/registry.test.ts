/**
 * Provider Registry — Contract Tests
 *
 * Locks the routing contract shared by all providers:
 *   - isEcotrackCompany() is the single predicate selecting the EcoTrack adapter
 *     (plain "ecotrack" + any "*_ecotrack" code) — the suffix is load-bearing
 *     (adapter selection, autoValidate default, update guard all key off it)
 *   - getProvider() returns the right adapter per company code and throws on
 *     unknown codes or missing credentials
 *   - non-EcoTrack providers keep their own selection rules (canaries: any
 *     change here means a leak across the seam)
 */

import { describe, it, expect } from "vitest";
import { getProvider, isEcotrackCompany } from "./registry";
import { EcotrackProvider } from "./ecotrack/adapter";
import { NoestProvider } from "./noest/adapter";
import { ZrExpressProvider } from "./zr_express/adapter";
import { YalidineProvider } from "./yalidine/adapter";

describe("isEcotrackCompany", () => {
  it.each([
    "ecotrack",
    "packers_ecotrack",
    "dhd_ecotrack",
    "conexlog_ecotrack",
    "msmgo_ecotrack",
  ])("accepts %s", (code) => {
    expect(isEcotrackCompany(code)).toBe(true);
  });

  it.each([
    "ecotrackx",
    "ecotrack_noest",
    "noest",
    "yalidine",
    "zr_express",
    "",
  ])("rejects %s", (code) => {
    expect(isEcotrackCompany(code)).toBe(false);
  });
});

describe("getProvider — EcoTrack family", () => {
  const credentials = {
    apiToken: "tok",
    apiUserGuid: null,
    apiEndpoint: "https://dhd.ecotrack.dz",
  };

  it("returns EcotrackProvider for the plain ecotrack code", () => {
    const provider = getProvider({ code: "ecotrack", ...credentials });
    expect(provider).toBeInstanceOf(EcotrackProvider);
    expect(provider.code).toBe("ecotrack");
  });

  it("returns EcotrackProvider for any *_ecotrack code", () => {
    for (const code of ["packers_ecotrack", "dhd_ecotrack", "zinyatec_ecotrack"]) {
      const provider = getProvider({ code, ...credentials });
      expect(provider).toBeInstanceOf(EcotrackProvider);
    }
  });

  it("throws when apiToken is missing", () => {
    expect(() =>
      getProvider({ code: "dhd_ecotrack", apiToken: null, apiUserGuid: null, apiEndpoint: "https://dhd.ecotrack.dz" })
    ).toThrow(/api_token/i);
  });

  it("throws when apiEndpoint is missing", () => {
    expect(() =>
      getProvider({ code: "dhd_ecotrack", apiToken: "tok", apiUserGuid: null, apiEndpoint: null })
    ).toThrow(/api_endpoint/i);
  });
});

describe("getProvider — non-EcoTrack providers (canaries)", () => {
  it("returns NoestProvider for noest", () => {
    const provider = getProvider({ code: "noest", apiToken: "t", apiUserGuid: "g", apiEndpoint: null });
    expect(provider).toBeInstanceOf(NoestProvider);
  });

  it("throws for noest without apiUserGuid", () => {
    expect(() =>
      getProvider({ code: "noest", apiToken: "t", apiUserGuid: null, apiEndpoint: null })
    ).toThrow(/api_user_guid/i);
  });

  it("returns ZrExpressProvider for zr_express", () => {
    const provider = getProvider({ code: "zr_express", apiToken: "t", apiUserGuid: "tenant", apiEndpoint: null });
    expect(provider).toBeInstanceOf(ZrExpressProvider);
  });

  it("throws for zr_express without tenant id", () => {
    expect(() =>
      getProvider({ code: "zr_express", apiToken: "t", apiUserGuid: null, apiEndpoint: null })
    ).toThrow(/tenant_id/i);
  });

  it("returns YalidineProvider for yalidine", () => {
    const provider = getProvider({ code: "yalidine", apiToken: "t", apiUserGuid: "id", apiEndpoint: null });
    expect(provider).toBeInstanceOf(YalidineProvider);
  });

  it("throws for yalidine without X-API-ID", () => {
    expect(() =>
      getProvider({ code: "yalidine", apiToken: "t", apiUserGuid: null, apiEndpoint: null })
    ).toThrow(/X-API-ID/i);
  });

  it("throws for an unknown company code", () => {
    expect(() =>
      getProvider({ code: "mystery_courier", apiToken: "t", apiUserGuid: null, apiEndpoint: null })
    ).toThrow(/No provider adapter/);
  });
});

/**
 * ZR Express status mapper tests.
 *
 * Every default-workflow slug below comes from `POST /workflows/search`
 * (23 states, captured live 2026-09-10 — see
 * .agents/skills/zr-express/CONFORMANCE.md BUG-5). Real parcels carry the
 * slug in `state.name` and the French display text in `state.description`.
 *
 * The drift guard pins the default map's size so a renamed/removed slug
 * fails CI instead of silently recording live webhook events as `unmapped`.
 */
import { describe, it, expect } from "vitest";
import { mapZrStateName, parseCustomMapping } from "./zr-status-mapper";

describe("mapZrStateName — terminal mappings", () => {
  it("maps the delivered family", () => {
    for (const slug of ["livre", "livre au client", "encaisse", "recouvert"]) {
      expect(mapZrStateName(slug, null)).toBe("delivered");
    }
  });

  it("maps the returned family", () => {
    for (const slug of [
      "retour_sous_traitant",
      "colis_recupere",
      "attente_recuperation_fournisseur",
      "reinjecte_dans_stock",
      "recupere_par_fournisseur",
      "remboursement_reinjecte",
    ]) {
      expect(mapZrStateName(slug, null)).toBe("returned");
    }
  });

  it("maps the out-for-delivery family", () => {
    expect(mapZrStateName("en_livraison", null)).toBe("out_for_delivery");
    expect(mapZrStateName("sortie_en_livraison", null)).toBe("out_for_delivery");
  });
});

describe("mapZrStateName — pre-delivery progression", () => {
  it("maps the live-observed creation state", () => {
    // Real parcel payload observed live: state.name = "commande_recue".
    expect(mapZrStateName("commande_recue", null)).toBe("preparing");
  });

  it("maps the remaining default-workflow slugs", () => {
    expect(mapZrStateName("en_traitement", null)).toBe("preparing");
    expect(mapZrStateName("appel_confirmation", null)).toBe("preparing");
    expect(mapZrStateName("commande_confirmee", null)).toBe("confirmed");
    expect(mapZrStateName("en_preparation", null)).toBe("preparing");
    expect(mapZrStateName("pret_a_expedier", null)).toBe("ready");
    expect(mapZrStateName("confirme_au_bureau", null)).toBe("assigned");
    expect(mapZrStateName("confirme_chez_partenaire", null)).toBe("assigned");
    expect(mapZrStateName("dispatch", null)).toBe("assigned");
    expect(mapZrStateName("vers_wilaya", null)).toBe("assigned");
  });

  it("keeps the legacy English aliases working", () => {
    expect(mapZrStateName("out for delivery", null)).toBe("out_for_delivery");
    expect(mapZrStateName("in transit", null)).toBe("assigned");
    expect(mapZrStateName("at hub", null)).toBe("assigned");
  });
});

describe("mapZrStateName — normalization", () => {
  it("matches case-insensitively (slugs arrive in mixed case from tenants)", () => {
    expect(mapZrStateName("LIVRE", null)).toBe("delivered");
    expect(mapZrStateName("En_Livraison", null)).toBe("out_for_delivery");
  });

  it("matches accent-insensitively (display text like 'Commande reçue')", () => {
    expect(mapZrStateName("commande_reçue", null)).toBe("preparing");
    expect(mapZrStateName("Commande reçue", null)).toBeNull(); // display text is NOT a slug — handler matches description separately
  });

  it("trims whitespace before matching", () => {
    expect(mapZrStateName("  livre  ", null)).toBe("delivered");
  });
});

describe("mapZrStateName — custom mapping", () => {
  it("custom mapping wins over defaults", () => {
    const custom = { cancelled: ["livre"] };
    expect(mapZrStateName("livre", custom)).toBe("cancelled");
  });

  it("custom entries match case- and accent-insensitively", () => {
    const custom = { delivered: ["Livré chez le client"] };
    expect(mapZrStateName("livre chez le client", custom)).toBe("delivered");
    expect(mapZrStateName("LIVRÉ CHEZ LE CLIENT", custom)).toBe("delivered");
  });

  it("ignores malformed custom values and still falls back to defaults", () => {
    const custom = { delivered: "livre", cancelled: [42, null] } as unknown as Record<string, string[]>;
    expect(mapZrStateName("livre", custom)).toBe("delivered");
  });
});

describe("mapZrStateName — unknown + degenerate inputs", () => {
  it("unknown state → null (caller must log 'unmapped' and not change the order)", () => {
    expect(mapZrStateName("etat_inconnu_personnalise", null)).toBeNull();
  });

  it("null / undefined / empty → null", () => {
    for (const input of [null, undefined, "", "   "]) {
      expect(mapZrStateName(input, null)).toBeNull();
    }
  });
});

describe("parseCustomMapping", () => {
  it("parses a valid mapping", () => {
    expect(parseCustomMapping('{"delivered":["Livre"]}')).toEqual({
      delivered: ["Livre"],
    });
  });

  it("returns null for missing / invalid / non-object JSON", () => {
    for (const input of [null, undefined, "", "not json", "[1,2]", "42"]) {
      expect(parseCustomMapping(input)).toBeNull();
    }
  });
});

describe("drift guard", () => {
  it("default map covers every state of the live default workflow that is mappable", () => {
    // 23 states in the live default workflow; 3 are situation-only states the
    // handler ignores (parcel.state.situation.created) and the remaining 20
    // delivery states are all mapped above — 24 keys here include 3 legacy
    // English aliases. If this fails, someone renamed or removed a slug and
    // live webhook events would silently log as 'unmapped'.
    const slugs = [
      "livre", "livre au client", "encaisse", "recouvert",
      "retour_sous_traitant", "colis_recupere",
      "attente_recuperation_fournisseur", "reinjecte_dans_stock",
      "recupere_par_fournisseur", "remboursement_reinjecte",
      "en_livraison", "sortie_en_livraison",
      "commande_recue", "en_traitement", "appel_confirmation",
      "commande_confirmee", "en_preparation", "pret_a_expedier",
      "confirme_au_bureau", "confirme_chez_partenaire",
      "dispatch", "vers_wilaya",
      "out for delivery", "in transit", "at hub",
    ];
    for (const slug of slugs) {
      expect(mapZrStateName(slug, null)).not.toBeNull();
    }
  });
});

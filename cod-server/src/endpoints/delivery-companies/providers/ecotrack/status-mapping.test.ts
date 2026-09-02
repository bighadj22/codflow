/**
 * EcoTrack Status Mapping — Contract Tests
 *
 * Locks the authoritative table from CONFORMANCE.md (Slice 11):
 *   - every documented status enum key maps to the exact our-status
 *   - every documented activity key maps (or is a known non-status: null)
 *   - unknown values are undefined — surfaced raw, NEVER guessed
 */

import { describe, it, expect } from "vitest";
import { mapEcotrackStatus, mapEcotrackActivity } from "./status-mapping";
import type { OrderStatus } from "../../../../../../cod-shared/db/schema";

describe("mapEcotrackStatus", () => {
  const expected: Record<string, OrderStatus> = {
    prete_a_expedier: "dispatched",
    prete_a_preparer: "dispatched",
    en_preparation_stock: "dispatched",
    en_ramassage: "dispatched",
    vers_hub: "dispatched",
    en_hub: "dispatched",
    vers_wilaya: "dispatched",
    en_preparation: "dispatched",
    en_livraison: "out_for_delivery",
    livre_non_encaisse: "delivered",
    encaisse_non_paye: "delivered",
    paiements_prets: "delivered",
    paye_et_archive: "delivered",
    suspendu: "unreachable",
    retour_chez_livreur: "returned",
    retour_transit_entrepot: "returned",
    retour_en_traitement: "returned",
    retour_recu: "returned",
    retour_archive: "returned",
    annule: "cancelled",
  };

  it.each(Object.entries(expected))("maps %s → %s", (key, status) => {
    expect(mapEcotrackStatus(key)).toBe(status);
  });

  it("covers all 20 documented status keys", () => {
    expect(Object.keys(expected)).toHaveLength(20);
  });

  it("returns undefined for unknown keys — never guesses", () => {
    expect(mapEcotrackStatus("all")).toBeUndefined();
    expect(mapEcotrackStatus("En livraison")).toBeUndefined();
    expect(mapEcotrackStatus("SOMETHING_NEW")).toBeUndefined();
    expect(mapEcotrackStatus("")).toBeUndefined();
  });
});

describe("mapEcotrackActivity", () => {
  const expected: Record<string, OrderStatus | null> = {
    order_information_received_by_carrier: "dispatched",
    notification_on_order: null,
    picked: "dispatched",
    accepted_by_carrier: "dispatched",
    dispatched_to_driver: "out_for_delivery",
    attempt_delivery: "out_for_delivery",
    return_asked: "returned",
    return_in_transit: "returned",
    Return_received: "returned",
    livred: "delivered",
    encaissed: "delivered",
    payed: "delivered",
  };

  it.each(Object.entries(expected))("maps %s → %s", (key, status) => {
    expect(mapEcotrackActivity(key)).toBe(status);
  });

  it("covers all 12 documented activity keys", () => {
    expect(Object.keys(expected)).toHaveLength(12);
  });

  it("distinguishes unknown (undefined) from known non-status (null)", () => {
    expect(mapEcotrackActivity("notification_on_order")).toBeNull();
    expect(mapEcotrackActivity("mystery_event")).toBeUndefined();
  });

  it("preserves the documented capital-R Return_received spelling", () => {
    expect(mapEcotrackActivity("Return_received")).toBe("returned");
    expect(mapEcotrackActivity("return_received")).toBeUndefined();
  });
});

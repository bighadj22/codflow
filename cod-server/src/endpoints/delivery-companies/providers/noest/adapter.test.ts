/**
 * NOEST Provider Adapter — Unit Tests
 *
 * Mocks global.fetch and asserts that:
 *   - the right URL/method is hit
 *   - the right payload is built from CreateShipmentInput / UpdateShipmentInput
 *   - the response is parsed correctly
 *
 * These tests are the canary for "frontend sends X but the carrier expects Y" bugs:
 * if the unified input shape ever drifts from what NOEST actually accepts,
 * one of these assertions will fail.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NoestProvider } from "./adapter";
import type { CreateShipmentInput } from "../types";

const TOKEN = "token-abc";
const GUID = "guid-123";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const baseInput: CreateShipmentInput = {
  orderId: "ord-1",
  customerName: "Fatima Zahra",
  phone: "0551234567",
  address: "Rue 1, Alger",
  wilayaId: 16,
  commune: "Alger Centre",
  amount: 4500,
  productDescription: "T-shirt",
  stopDesk: false,
};

describe("NoestProvider.createShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("POSTs to /api/public/create/order with bearer auth and required fields", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, tracking: "LHA-19D-1" }));

    const provider = new NoestProvider(TOKEN, GUID);
    const result = await provider.createShipment(baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.noest-dz.com/api/public/create/order");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      user_guid: GUID,
      client: "Fatima Zahra",
      phone: "0551234567",
      adresse: "Rue 1, Alger",
      wilaya_id: 16,
      commune: "Alger Centre",
      montant: 4500,
      produit: "T-shirt",
      type_id: 1,
      stop_desk: 0,
      poids: 0,
    });

    expect(result.trackingNumber).toBe("LHA-19D-1");
    expect(result.labelUrl).toBe(
      "https://app.noest-dz.com/api/public/get/order/label?tracking=LHA-19D-1"
    );
  });

  it("forwards optional fields when provided (weight, fragile-not-mapped, phone2, station, remarks, canOpen)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, tracking: "LHA-19D-2" }));

    const provider = new NoestProvider(TOKEN, GUID);
    await provider.createShipment({
      ...baseInput,
      stopDesk: true,
      stationCode: "16A",
      phone2: "0660000000",
      reference: "ORD-001",
      remarks: "Call before arrival",
      canOpen: true,
      weight: 2.5,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stop_desk).toBe(1);
    expect(body.station_code).toBe("16A");
    expect(body.phone_2).toBe("0660000000");
    expect(body.reference).toBe("ORD-001");
    expect(body.remarque).toBe("Call before arrival");
    expect(body.can_open).toBe(1);
    // Regression: NOEST adapter previously hardcoded poids=0 ignoring input.weight.
    expect(body.poids).toBe(2.5);
  });

  it("throws when API responds with no tracking number, surfacing the error bag", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, errors: { phone: ["invalid"] } })
    );
    const provider = new NoestProvider(TOKEN, GUID);
    await expect(provider.createShipment(baseInput)).rejects.toThrow(/invalid/);
  });

  it("throws on non-OK HTTP status with the API's message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));
    const provider = new NoestProvider(TOKEN, GUID);
    await expect(provider.createShipment(baseInput)).rejects.toThrow("Forbidden");
  });
});

describe("NoestProvider.validateShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("POSTs to /api/public/valid/order with tracking + user_guid", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    const provider = new NoestProvider(TOKEN, GUID);
    const ok = await provider.validateShipment("LHA-19D-1");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ user_guid: GUID, tracking: "LHA-19D-1" });
    expect(ok).toBe(true);
  });

  it("throws when API returns success=false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, message: "Already validated" })
    );
    const provider = new NoestProvider(TOKEN, GUID);
    await expect(provider.validateShipment("X")).rejects.toThrow("Already validated");
  });
});

describe("NoestProvider.updateShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("uses NOEST field names (tel, wilaya, montant) — distinct from create", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    const provider = new NoestProvider(TOKEN, GUID);
    await provider.updateShipment("LHA-19D-1", {
      customerName: "Karim",
      phone: "0552222222",
      address: "Rue 2",
      commune: "Bab El Oued",
      wilayaId: 16,
      amount: 5000,
      weight: 1.2,
      remarks: "Updated",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://app.noest-dz.com/api/public/update/order");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      tracking: "LHA-19D-1",
      client: "Karim",
      tel: "0552222222",
      adresse: "Rue 2",
      commune: "Bab El Oued",
      wilaya: 16,
      montant: 5000,
      poids: 1.2,
      remarque: "Updated",
    });
  });

  it("throws on success=false (e.g. order already validated)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: false,
        message: "Commande non trouvée dans l'étape de modification",
      })
    );
    const provider = new NoestProvider(TOKEN, GUID);
    await expect(
      provider.updateShipment("LHA-19D-1", { amount: 100 })
    ).rejects.toThrow(/Commande non trouvée/);
  });
});

describe("NoestProvider.deleteShipment", () => {
  it("throws when carrier returns success=false (already validated)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ success: false }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new NoestProvider(TOKEN, GUID);
    await expect(provider.deleteShipment("LHA-19D-1")).rejects.toThrow(/may already be validated/i);
  });

  it("returns true on success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ success: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new NoestProvider(TOKEN, GUID);
    expect(await provider.deleteShipment("LHA-19D-1")).toBe(true);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ user_guid: GUID, tracking: "LHA-19D-1" });
  });
});

describe("NoestProvider.addRemark", () => {
  it("POSTs tracking + content to /api/public/add/maj", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ success: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new NoestProvider(TOKEN, GUID);
    expect(await provider.addRemark("LHA-19D-1", "Hello")).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://app.noest-dz.com/api/public/add/maj");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      tracking: "LHA-19D-1",
      content: "Hello",
    });
  });
});

describe("NoestProvider.getStopDesks", () => {
  it("infers wilayaId from the numeric prefix of code", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        a: { code: "16A", name: "Alger Hub", commune: "Alger", address: "x", phones: { p1: "021" } },
        b: { code: "01B", name: "Adrar Hub", commune: "Adrar", address: "y", phones: null },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new NoestProvider(TOKEN, GUID);
    const desks = await provider.getStopDesks();

    expect(desks).toHaveLength(2);
    expect(desks[0]).toMatchObject({ code: "16A", wilayaId: 16, commune: "Alger" });
    expect(desks[1]).toMatchObject({ code: "01B", wilayaId: 1 });
  });
});

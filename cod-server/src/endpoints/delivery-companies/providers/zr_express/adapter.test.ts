/**
 * ZR Express Provider Adapter — Unit Tests
 *
 * Verifies that:
 *   - X-Api-Key + X-Tenant headers are sent
 *   - createShipment goes through customer creation → territory resolve → parcel
 *   - parcelId comes back in rawResponse (so the handler can use it for updates)
 *   - phone numbers are normalized to +213 format
 *   - stop-desk parcels send a real hub id (not a territory UUID) as hubId
 *   - updateShipment treats the first arg as parcelId UUID, GETs the parcel
 *     first, and PATCHes the per-field endpoints with parcelId in the body
 *   - deleteShipment sends DELETE (POST answers 405) and throws on failure
 *   - getTrackingInfo resolves the parcel UUID first (state-history 404s on
 *     tracking numbers), then maps rows to {activity, description, date}
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ZrExpressProvider } from "./adapter";
import type { CreateShipmentInput } from "../types";

const TOKEN = "zr-secret";
const TENANT = "zr-tenant";
const PARCEL_UUID = "11111111-2222-3333-4444-555555555555";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const baseInput: CreateShipmentInput = {
  orderId: "ord-1",
  reference: "ORD-001",
  customerName: "Karim Benali",
  phone: "0551234567",
  address: "Rue 1, Alger",
  wilayaId: 16,
  wilaya: "Alger",
  commune: "Alger Centre",
  amount: 4500,
  productDescription: "T-shirt",
  stopDesk: false,
};

describe("ZrExpressProvider.createShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("creates customer → resolves territory → creates parcel → fetches tracking", async () => {
    const cityItem = { id: "city-uuid", level: "wilaya", code: 16, name: "Alger" };
    const districtItem = {
      id: "district-uuid",
      level: "commune",
      parentId: "city-uuid",
      name: "Alger Centre",
    };
    fetchMock
      // 1) POST /v1/customers/individual
      .mockResolvedValueOnce(jsonResponse({ id: "cust-uuid" }))
      // 2) POST /v1/territories/search (city, by accent-stripped name "Alger")
      .mockResolvedValueOnce(jsonResponse({ items: [cityItem] }))
      // 3) POST /v1/territories/search (district — parent must match city)
      .mockResolvedValueOnce(jsonResponse({ items: [districtItem] }))
      // 4) POST /v1/parcels
      .mockResolvedValueOnce(jsonResponse({ id: PARCEL_UUID }))
      // 5) GET /v1/parcels/:id
      .mockResolvedValueOnce(
        jsonResponse({ id: PARCEL_UUID, trackingNumber: "16-ABCDEF-ZR" })
      );

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    const result = await provider.createShipment(baseInput);

    // Assert auth headers on the very first call
    const customerCallHeaders = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(customerCallHeaders["X-Api-Key"]).toBe(TOKEN);
    expect(customerCallHeaders["X-Tenant"]).toBe(TENANT);

    // Customer creation: phone normalized to +213
    const customerBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(customerBody).toMatchObject({
      name: "Karim Benali",
      phone: { number1: "+213551234567" },
    });

    // Parcel creation: territory IDs threaded through
    const parcelBody = JSON.parse(fetchMock.mock.calls[3][1].body as string);
    expect(parcelBody).toMatchObject({
      customer: { customerId: "cust-uuid", name: "Karim Benali" },
      deliveryAddress: {
        cityTerritoryId: "city-uuid",
        districtTerritoryId: "district-uuid",
        street: "Rue 1, Alger",
      },
      deliveryType: "home",
      amount: 4500,
      description: "T-shirt",
      externalId: "ORD-001",
    });

    // Result: tracking number from GET, parcelId tucked into rawResponse for updates
    expect(result.trackingNumber).toBe("16-ABCDEF-ZR");
    const raw = result.rawResponse as { parcelId?: string };
    expect(raw.parcelId).toBe(PARCEL_UUID);
  });

  it("sends hub id as hubId", async () => {
    const HUB_ID = "hub-uuid-1";
    const hub = {
      id: HUB_ID,
      isPickupPoint: true,
      address: { districtTerritoryId: "hub-district-uuid", cityTerritoryId: "hub-city-uuid" },
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "cust-uuid" }))
      .mockResolvedValueOnce(jsonResponse({ items: [hub], totalPages: 1 }))
      .mockResolvedValueOnce(jsonResponse({ id: PARCEL_UUID }))
      .mockResolvedValueOnce(
        jsonResponse({ id: PARCEL_UUID, trackingNumber: "16-PP-ZR" })
      );

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    const result = await provider.createShipment({
      ...baseInput,
      stopDesk: true,
      stationCode: HUB_ID,
    });

    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.zrexpress.app/api/v1/hubs/search"
    );

    const parcelBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(parcelBody.deliveryType).toBe("pickup-point");
    expect(parcelBody.hubId).toBe(HUB_ID);
    expect(parcelBody.deliveryAddress.districtTerritoryId).toBe("hub-district-uuid");
    expect(parcelBody.deliveryAddress.cityTerritoryId).toBe("hub-city-uuid");
    expect(result.trackingNumber).toBe("16-PP-ZR");
  });

  it("throws if no wilaya territory matches", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "cust-uuid" }))
      // city search by name — no match
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      // city search by code (fallback) — also no match
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    await expect(provider.createShipment(baseInput)).rejects.toThrow(/territory/i);
  });
});

describe("ZrExpressProvider.validateShipment (auto-validate)", () => {
  it("is a no-op that returns true without making any HTTP call", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.validateShipment("any")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ZrExpressProvider.updateShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("gets parcel then patches", async () => {
    const snap = {
      id: PARCEL_UUID,
      amount: 4500,
      customer: { name: "Karim Benali", phone: { number1: "+213551234567" } },
      deliveryAddress: {
        street: "Rue 1, Alger",
        cityTerritoryId: "city-uuid",
        districtTerritoryId: "district-uuid",
      },
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(snap))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "city-uuid", level: "wilaya", code: 16 }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "district-uuid", level: "commune", parentId: "city-uuid" }] }))
      .mockResolvedValueOnce(jsonResponse({}));

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    const ok = await provider.updateShipment(PARCEL_UUID, {
      amount: 5000,
      customerName: "Karim Updated",
      phone: "0552222222",
      address: "Rue 2, Alger",
      commune: "Alger Centre",
      wilayaId: 16,
    });

    expect(fetchMock).toHaveBeenCalledTimes(6);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}`
    );

    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}/amount`
    );
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      parcelId: PARCEL_UUID,
      amount: 5000,
    });

    expect(fetchMock.mock.calls[2][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}/customer`
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
      parcelId: PARCEL_UUID,
      name: "Karim Updated",
      phone: "+213552222222",
    });

    expect(fetchMock.mock.calls[3][0]).toBe(
      "https://api.zrexpress.app/api/v1/territories/search"
    );
    expect(fetchMock.mock.calls[5][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}/deliveryAddress`
    );
    const addrBody = JSON.parse(fetchMock.mock.calls[5][1].body as string);
    expect(addrBody.parcelId).toBe(PARCEL_UUID);
    expect(addrBody.deliveryAddress.cityTerritoryId).toBe("city-uuid");
    expect(addrBody.deliveryAddress.districtTerritoryId).toBe("district-uuid");

    expect(ok).toBe(true);
  });

  it("skips unchanged fields", async () => {
    const snap = {
      id: PARCEL_UUID,
      amount: 4500,
      customer: { name: "Karim Benali", phone: { number1: "+213551234567" } },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(snap));

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    await provider.updateShipment(PARCEL_UUID, {
      amount: 4500,
      customerName: "Karim Benali",
      phone: "+213551234567",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when carrier rejects an update", async () => {
    const snap = { id: PARCEL_UUID, amount: 4500 };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(snap))
      .mockResolvedValueOnce(jsonResponse({ detail: "Locked" }, 400));
    const provider = new ZrExpressProvider(TOKEN, TENANT);
    await expect(provider.updateShipment(PARCEL_UUID, { amount: 1 })).rejects.toThrow();
  });
});

describe("ZrExpressProvider.deleteShipment", () => {
  it("sends DELETE and returns true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ successCount: 1, failures: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.deleteShipment("16-ABCDEF-ZR")).toBe(true);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.zrexpress.app/api/v1/parcels/bulk/by-tracking-number"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      trackingNumbers: ["16-ABCDEF-ZR"],
    });
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("treats not-found as success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ successCount: 0, failures: [{ errorMessage: "Parcel not found" }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.deleteShipment("16-ABCDEF-ZR")).toBe(true);
  });

  it("throws on carrier failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ successCount: 0, failures: [{ errorMessage: "Already delivered" }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    await expect(provider.deleteShipment("16-ABCDEF-ZR")).rejects.toThrow(/failed to delete/);
  });
});

describe("ZrExpressProvider.getTrackingInfo", () => {
  it("resolves uuid then reads history", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: PARCEL_UUID, trackingNumber: "16-ABCDEF-ZR" }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            newState: { name: "commande_recue", description: "Commande recue" },
            createdAt: "2026-04-25T10:00:00Z",
          },
          {
            newState: { name: "livre", description: "Livre au client" },
            createdAt: "2026-04-26T14:00:00Z",
          },
        ])
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    const events = await provider.getTrackingInfo("16-ABCDEF-ZR");

    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}/state-history`
    );
    expect(events).toEqual([
      { activity: "commande_recue", description: "Commande recue", date: "2026-04-25T10:00:00Z" },
      { activity: "livre", description: "Livre au client", date: "2026-04-26T14:00:00Z" },
    ]);
  });

  it("returns empty for unknown tracking", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ title: "Not Found" }, 404)
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.getTrackingInfo("16-NOPE-ZR")).toEqual([]);
  });
});

describe("ZrExpressProvider.addRemark (unsupported)", () => {
  it("returns false without calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.addRemark(PARCEL_UUID, "x")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ZrExpressProvider.getLabelUrl", () => {
  it("returns the SAS fileUrl from the label-generation endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        parcelLabelFiles: [{ fileUrl: "https://blob.example/label.pdf?sas=xxx" }],
        failedTrackingNumbers: [],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    const url = await provider.getLabelUrl("16-ABCDEF-ZR");
    expect(url).toBe("https://blob.example/label.pdf?sas=xxx");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.zrexpress.app/api/v1/parcels/labels/individual/pdf"
    );
  });

  it("returns null when the carrier cannot produce a label", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ parcelLabelFiles: [], failedTrackingNumbers: ["16-ABCDEF-ZR"] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.getLabelUrl("16-ABCDEF-ZR")).toBeNull();
  });
});

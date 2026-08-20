/**
 * ZR Express Provider Adapter — Unit Tests
 *
 * Verifies that:
 *   - X-Api-Key + X-Tenant headers are sent
 *   - createShipment goes through customer creation → territory resolve → parcel
 *   - parcelId comes back in rawResponse (so the handler can use it for updates)
 *   - phone numbers are normalized to +213 format
 *   - updateShipment treats the first arg as parcelId UUID and posts to the right
 *     per-field endpoints with parcelId in the body
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
    fetchMock
      // 1) POST /v1/customers/individual
      .mockResolvedValueOnce(jsonResponse({ id: "cust-uuid" }))
      // 2) POST /v1/territories/search (city, by name "Alger")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: "city-uuid", level: "wilaya", code: 16, name: "Alger" }],
        })
      )
      // 3) POST /v1/territories/search (district, by commune)
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: "district-uuid", parentId: "city-uuid", name: "Alger Centre" }],
        })
      )
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

  it("uses the stationCode UUID as districtTerritoryId for stop-desk orders", async () => {
    const STOP_DESK_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "cust-uuid" }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: "city-uuid", level: "wilaya", code: 16, name: "Alger" }],
        })
      )
      // 4) POST /v1/parcels — district lookup is skipped because stationCode is a UUID
      .mockResolvedValueOnce(jsonResponse({ id: PARCEL_UUID }))
      .mockResolvedValueOnce(
        jsonResponse({ id: PARCEL_UUID, trackingNumber: "16-XYZ-ZR" })
      );

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    await provider.createShipment({
      ...baseInput,
      stopDesk: true,
      stationCode: STOP_DESK_UUID,
    });

    const parcelBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(parcelBody.deliveryType).toBe("pickup-point");
    expect(parcelBody.deliveryAddress.districtTerritoryId).toBe(STOP_DESK_UUID);
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

  it("treats the first arg as parcelId UUID — calls /amount, /customer, /deliveryAddress", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}))  // amount
      .mockResolvedValueOnce(jsonResponse({}))  // customer
      .mockResolvedValueOnce(jsonResponse({})); // deliveryAddress

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    const ok = await provider.updateShipment(PARCEL_UUID, {
      amount: 5000,
      customerName: "Karim Updated",
      phone: "0552222222",
      address: "Rue 2",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}/amount`
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      parcelId: PARCEL_UUID,
      amount: 5000,
    });

    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}/customer`
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      parcelId: PARCEL_UUID,
      name: "Karim Updated",
      phone: "+213552222222",
    });

    expect(fetchMock.mock.calls[2][0]).toBe(
      `https://api.zrexpress.app/api/v1/parcels/${PARCEL_UUID}/deliveryAddress`
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
      parcelId: PARCEL_UUID,
      deliveryAddress: { street: "Rue 2" },
    });

    expect(ok).toBe(true);
  });

  it("only hits the endpoints whose fields are provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    await provider.updateShipment(PARCEL_UUID, { amount: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/amount$/);
  });

  it("returns false (does not throw) when carrier rejects an update", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Locked" }, 400));
    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.updateShipment(PARCEL_UUID, { amount: 1 })).toBe(false);
  });
});

describe("ZrExpressProvider.deleteShipment", () => {
  it("POSTs trackingNumber to /parcels/bulk/by-tracking-number", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ successCount: 1, failureCount: 0 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.deleteShipment("16-ABCDEF-ZR")).toBe(true);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.zrexpress.app/api/v1/parcels/bulk/by-tracking-number"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      trackingNumbers: ["16-ABCDEF-ZR"],
    });
  });

  it("returns false on the documented HTTP 405 (carrier-side delete is broken)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ message: "Not allowed" }, 405));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    expect(await provider.deleteShipment("16-ABCDEF-ZR")).toBe(false);
  });
});

describe("ZrExpressProvider.getTrackingInfo", () => {
  it("maps state-history rows to {activity, description, date}", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          newState: { name: "PickupStarted", description: "Picked up by courier" },
          createdAt: "2026-04-25T10:00:00Z",
        },
        {
          newState: { name: "Delivered", description: "Delivered to customer" },
          createdAt: "2026-04-26T14:00:00Z",
        },
      ])
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new ZrExpressProvider(TOKEN, TENANT);
    const events = await provider.getTrackingInfo("16-ABCDEF-ZR");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.zrexpress.app/api/v1/parcels/16-ABCDEF-ZR/state-history"
    );
    expect(events).toEqual([
      { activity: "PickupStarted", description: "Picked up by courier", date: "2026-04-25T10:00:00Z" },
      { activity: "Delivered", description: "Delivered to customer", date: "2026-04-26T14:00:00Z" },
    ]);
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

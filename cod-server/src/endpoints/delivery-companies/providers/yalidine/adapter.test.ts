/**
 * Yalidine Provider Adapter — Unit Tests
 *
 * Verifies that:
 *   - parcels are POSTed as a single-element array (Yalidine quirk)
 *   - X-API-ID + X-API-TOKEN headers are sent
 *   - to_wilaya_name comes from input.wilaya, NOT input.wilayaId (Yalidine is name-based)
 *   - input.weight is forwarded (regression: was hardcoded to 1)
 *   - response is keyed by order_id and unwrapped correctly
 *   - update / delete / tracking endpoints follow REST conventions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { YalidineProvider } from "./adapter";
import type { CreateShipmentInput } from "../types";

const TOKEN = "yal-token";
const ID = "yal-id";

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

describe("YalidineProvider.createShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("POSTs an ARRAY of parcel objects to /v1/parcels/", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ "ORD-001": { success: true, tracking: "yal-AAA111" } })
    );

    const provider = new YalidineProvider(TOKEN, ID, "Alger");
    const result = await provider.createShipment(baseInput);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.yalidine.app/v1/parcels/");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-API-ID"]).toBe(ID);
    expect((init.headers as Record<string, string>)["X-API-TOKEN"]).toBe(TOKEN);

    const body = JSON.parse(init.body as string);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      order_id: "ORD-001",
      from_wilaya_name: "Alger",
      firstname: "Karim",
      familyname: "Benali",
      contact_phone: "0551234567",
      address: "Rue 1, Alger",
      to_commune_name: "Alger Centre",
      to_wilaya_name: "Alger", // ✅ name, not ID
      product_list: "T-shirt",
      price: 4500,
      is_stopdesk: false,
      stopdesk_id: null,
      weight: 1,
    });

    expect(result.trackingNumber).toBe("yal-AAA111");
  });

  it("forwards input.weight when set (regression test)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ "ORD-001": { success: true, tracking: "yal-AAA111" } })
    );

    const provider = new YalidineProvider(TOKEN, ID);
    await provider.createShipment({ ...baseInput, weight: 3.5 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body[0].weight).toBe(3.5);
  });

  it("requires input.wilaya — throws if missing", async () => {
    const provider = new YalidineProvider(TOKEN, ID);
    await expect(
      provider.createShipment({ ...baseInput, wilaya: undefined })
    ).rejects.toThrow(/wilaya/i);
  });

  it("requires stationCode for stop-desk; sets stopdesk_id from it", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ "ORD-001": { success: true, tracking: "yal-AAA222" } })
    );

    const provider = new YalidineProvider(TOKEN, ID);
    await provider.createShipment({ ...baseInput, stopDesk: true, stationCode: "42" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body[0].is_stopdesk).toBe(true);
    expect(body[0].stopdesk_id).toBe(42);
  });

  it("rejects non-numeric stationCode for stop-desk", async () => {
    // Note: a "leading-numeric" code like "16A" will pass parseInt (16) and not
    // throw — that lax behavior is a separate adapter bug worth fixing.
    // Here we use a fully non-numeric value to exercise the documented branch.
    const provider = new YalidineProvider(TOKEN, ID);
    await expect(
      provider.createShipment({ ...baseInput, stopDesk: true, stationCode: "abc" })
    ).rejects.toThrow(/center_id/);
  });

  it("rejects stop-desk without stationCode", async () => {
    const provider = new YalidineProvider(TOKEN, ID);
    await expect(
      provider.createShipment({ ...baseInput, stopDesk: true })
    ).rejects.toThrow(/stop-desk/);
  });

  it("throws when API result has success=false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ "ORD-001": { success: false, message: "Phone invalid" } })
    );
    const provider = new YalidineProvider(TOKEN, ID);
    await expect(provider.createShipment(baseInput)).rejects.toThrow("Phone invalid");
  });
});

describe("YalidineProvider.validateShipment (auto-validate)", () => {
  it("is a no-op that returns true without making any HTTP call", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new YalidineProvider(TOKEN, ID);
    expect(await provider.validateShipment("yal-AAA111")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("YalidineProvider.updateShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("PATCHes /v1/parcels/:tracking with mapped field names", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    const provider = new YalidineProvider(TOKEN, ID);
    const ok = await provider.updateShipment("yal-AAA111", {
      customerName: "Karim Benali",
      phone: "0552222222",
      address: "Rue 2",
      commune: "Bab El Oued",
      amount: 5000,
      weight: 2.5,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.yalidine.app/v1/parcels/yal-AAA111");
    expect(init.method).toBe("PATCH");

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      firstname: "Karim",
      familyname: "Benali",
      contact_phone: "0552222222",
      address: "Rue 2",
      to_commune_name: "Bab El Oued",
      price: 5000,
      declared_value: 5000,
      weight: 2.5,
    });
    expect(ok).toBe(true);
  });

  it("returns false (not throw) on HTTP error to keep the UI tolerant", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "label printed" }, 400));
    const provider = new YalidineProvider(TOKEN, ID);
    const ok = await provider.updateShipment("yal-AAA111", { amount: 100 });
    expect(ok).toBe(false);
  });
});

describe("YalidineProvider.deleteShipment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("DELETEs /v1/parcels/:tracking and reads array[0].deleted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ deleted: true }]));

    const provider = new YalidineProvider(TOKEN, ID);
    expect(await provider.deleteShipment("yal-AAA111")).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.yalidine.app/v1/parcels/yal-AAA111");
    expect(init.method).toBe("DELETE");
  });

  it("returns false when carrier reports deleted=false (wrong status / already deleted)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ deleted: false }]));
    const provider = new YalidineProvider(TOKEN, ID);
    expect(await provider.deleteShipment("yal-AAA111")).toBe(false);
  });
});

describe("YalidineProvider.getTrackingInfo", () => {
  it("maps history rows to {activity, description, date}", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [
          { status: "En préparation", reason: null, date_status: "2026-04-25 10:00:00" },
          { status: "Livré", reason: "OK", date_status: "2026-04-26 14:00:00" },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new YalidineProvider(TOKEN, ID);
    const events = await provider.getTrackingInfo("yal-AAA111");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.yalidine.app/v1/histories/yal-AAA111"
    );
    expect(events).toEqual([
      { activity: "En préparation", description: undefined, date: "2026-04-25 10:00:00" },
      { activity: "Livré", description: "OK", date: "2026-04-26 14:00:00" },
    ]);
  });
});

describe("YalidineProvider.addRemark (unsupported)", () => {
  it("returns false without calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new YalidineProvider(TOKEN, ID);
    expect(await provider.addRemark("yal-AAA111", "x")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

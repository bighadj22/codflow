/**
 * EcoTrack Provider Adapter — Characterization Tests
 *
 * Drives the REAL adapter end-to-end through the EcoTrack mock server
 * (test/mock-server.ts, built from the official Postman collection).
 * Pins the adapter's current contract: exact query params, param renames
 * on update, response-shape parsing, error surfacing, and bulk semantics.
 *
 * Any failing expectation here is a FINDING — fix the test only if the
 * adapter matches API-REFERENCE.md; otherwise fix the adapter and record
 * the divergence in CONFORMANCE.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EcotrackProvider } from "./adapter";
import type { CreateShipmentInput } from "../types";
import { createEcotrackMockServer, type EcotrackMockServer } from "./test/mock-server";
import { EcoTrackApiError } from "./errors";

const TOKEN = "ecotrack-test-token";

const baseInput: CreateShipmentInput = {
  orderId: "ord-1",
  reference: "ORD-2026-0001",
  customerName: "Karim Benali",
  phone: "0551234567",
  phone2: "0661234567",
  address: "Rue 1, Alger",
  wilayaId: 16,
  commune: "Alger Centre",
  amount: 4500,
  productDescription: "T-shirt",
  stopDesk: false,
  remarks: "Livraison avant 17h",
  weight: 2,
  fragile: true,
};

describe("EcotrackProvider.createShipment", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends all fields as QUERY params (no request body) with French snake_case names", async () => {
    const result = await provider.createShipment(baseInput);

    const call = server.callsFor("/api/v1/create/order")[0];
    expect(call).toBeDefined();
    expect(call.method).toBe("POST");
    expect(call.body).toBeUndefined();
    expect(call.headers["authorization"]).toBe(`Bearer ${TOKEN}`);

    expect(call.searchParams.get("nom_client")).toBe("Karim Benali");
    expect(call.searchParams.get("telephone")).toBe("0551234567");
    expect(call.searchParams.get("telephone_2")).toBe("0661234567");
    expect(call.searchParams.get("adresse")).toBe("Rue 1, Alger");
    expect(call.searchParams.get("code_wilaya")).toBe("16");
    expect(call.searchParams.get("commune")).toBe("Alger Centre");
    expect(call.searchParams.get("montant")).toBe("4500");
    expect(call.searchParams.get("type")).toBe("1");
    expect(call.searchParams.get("reference")).toBe("ORD-2026-0001");
    expect(call.searchParams.get("produit")).toBe("T-shirt");
    expect(call.searchParams.get("remarque")).toBe("Livraison avant 17h");
    expect(call.searchParams.get("weight")).toBe("2");
    expect(call.searchParams.get("fragile")).toBe("1");

    expect(result.trackingNumber).toMatch(/^ECMOCK\d{10}$/);
    expect(result.labelUrl).toBe(
      `${server.baseUrl}/api/v1/get/order/label?tracking=${result.trackingNumber}`
    );
    expect((result.rawResponse as { success: boolean }).success).toBe(true);
  });

  it("maps stop-desk delivery to stop_desk=1 and stationCode to code_postal", async () => {
    await provider.createShipment({
      ...baseInput,
      stopDesk: true,
      stationCode: "16001",
    });

    const call = server.callsFor("/api/v1/create/order")[0];
    expect(call.searchParams.get("stop_desk")).toBe("1");
    expect(call.searchParams.get("code_postal")).toBe("16001");
  });

  it("sends stop_desk=0 for home delivery", async () => {
    await provider.createShipment({ ...baseInput, stopDesk: false });

    expect(server.callsFor("/api/v1/create/order")[0].searchParams.get("stop_desk")).toBe("0");
  });

  it("NEVER maps canOpen to fragile — canOpen is ignored, fragile maps on its own", async () => {
    await provider.createShipment({ ...baseInput, canOpen: true, fragile: false });

    const params = server.callsFor("/api/v1/create/order")[0].searchParams;
    expect(params.get("fragile")).toBe("0");
    expect(params.has("canOpen")).toBe(false);
    expect([...params.keys()].some((k) => k.toLowerCase().includes("open"))).toBe(false);
  });

  it("omits optional params entirely when unset", async () => {
    const input: CreateShipmentInput = {
      orderId: "ord-2",
      customerName: "Nadia",
      phone: "0551234567",
      address: "Rue 2",
      wilayaId: 16,
      commune: "Alger Centre",
      amount: 1000,
      productDescription: "Produit",
      stopDesk: false,
    };
    await provider.createShipment(input);

    const params = server.callsFor("/api/v1/create/order")[0].searchParams;
    for (const absent of [
      "telephone_2",
      "reference",
      "code_postal",
      "remarque",
      "weight",
      "fragile",
    ]) {
      expect(params.has(absent)).toBe(false);
    }
  });

  it("throws the carrier message when the wilaya is not served (error 10002, HTTP 200)", async () => {
    await expect(
      provider.createShipment({ ...baseInput, wilayaId: 12, commune: "Tbessa" })
    ).rejects.toThrow(/Pas de livraison pour la wilaya sélectionnée/);
  });

  it("surfaces the 422 message (field-level details are currently dropped — pinned, see CONFORMANCE)", async () => {
    await expect(
      provider.createShipment({ ...baseInput, customerName: "" })
    ).rejects.toThrow("The given data was invalid.");
  });
});

describe("EcotrackProvider.validateShipment", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs valid/order with tracking and ask_collection", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);

    const ok = await provider.validateShipment(trackingNumber, true);
    expect(ok).toBe(true);

    const call = server.callsFor("/api/v1/valid/order")[0];
    expect(call.method).toBe("POST");
    expect(call.body).toBeUndefined();
    expect(call.searchParams.get("tracking")).toBe(trackingNumber);
    expect(call.searchParams.get("ask_collection")).toBe("1");
    expect(server.parcel(trackingNumber)!.validated).toBe(true);
  });

  it("omits ask_collection when not provided", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    await provider.validateShipment(trackingNumber);

    expect(server.callsFor("/api/v1/valid/order")[0].searchParams.has("ask_collection")).toBe(false);
  });

  it("throws when the carrier reports failure", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    server.override("/api/v1/valid/order", () =>
      new Response(JSON.stringify({ success: false, message: "Commande non modifiable" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(provider.validateShipment(trackingNumber)).rejects.toThrow(/Commande non modifiable/);
  });
});

describe("EcotrackProvider.updateShipment", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uses UPDATE param names (client/tel/tel2 — NOT the create names) and always sends type=1", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);

    const ok = await provider.updateShipment(trackingNumber, {
      customerName: "Karim B.",
      phone: "0770000000",
      phone2: "0550000000",
      address: "Rue 9",
      commune: "Bab Ezzouar",
      wilayaId: 16,
      amount: 5000,
      remarks: "Nouvelle remarque",
      fragile: false,
      weight: 3,
    });
    expect(ok).toBe(true);

    const call = server.callsFor("/api/v1/update/order")[0];
    expect(call.method).toBe("POST");
    expect(call.body).toBeUndefined();
    expect(call.searchParams.get("tracking")).toBe(trackingNumber);
    expect(call.searchParams.get("type")).toBe("1");
    expect(call.searchParams.get("client")).toBe("Karim B.");
    expect(call.searchParams.get("tel")).toBe("0770000000");
    expect(call.searchParams.get("tel2")).toBe("0550000000");
    expect(call.searchParams.get("adresse")).toBe("Rue 9");
    expect(call.searchParams.get("commune")).toBe("Bab Ezzouar");
    expect(call.searchParams.get("wilaya")).toBe("16");
    expect(call.searchParams.get("montant")).toBe("5000");
    expect(call.searchParams.get("remarque")).toBe("Nouvelle remarque");
    expect(call.searchParams.get("fragile")).toBe("0");
    expect(call.searchParams.has("weight")).toBe(false);
  });

  it("throws error 10001's message when updating a validated order", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    await provider.validateShipment(trackingNumber);

    await expect(
      provider.updateShipment(trackingNumber, { amount: 9999 })
    ).rejects.toThrow("Commande non modifiable");
  });

  it("throws on an unknown tracking (422)", async () => {
    await expect(
      provider.updateShipment("ECUNKNOWN123", { amount: 100 })
    ).rejects.toThrow("The given data was invalid.");
  });
});

describe("EcotrackProvider.deleteShipment", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("DELETEs before validation and returns true", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);

    const ok = await provider.deleteShipment(trackingNumber);
    expect(ok).toBe(true);

    const call = server.callsFor("/api/v1/delete/order")[0];
    expect(call.method).toBe("DELETE");
    expect(call.searchParams.get("tracking")).toBe(trackingNumber);
    expect(server.parcel(trackingNumber)).toBeUndefined();
  });

  it("throws on the legacy {delete:'fail'} response shape", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    server.override("/api/v1/delete/order", () =>
      new Response(JSON.stringify({ delete: "fail" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(provider.deleteShipment(trackingNumber)).rejects.toThrow();
  });

  it("throws the 10001 message for a validated order", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    await provider.validateShipment(trackingNumber);

    await expect(provider.deleteShipment(trackingNumber)).rejects.toThrow("Commande non modifiable");
  });
});

describe("EcotrackProvider remarks", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("addRemark POSTs tracking + content as query params", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);

    const ok = await provider.addRemark(trackingNumber, "Appeler avant livraison");
    expect(ok).toBe(true);

    const call = server.callsFor("/api/v1/add/maj")[0];
    expect(call.method).toBe("POST");
    expect(call.body).toBeUndefined();
    expect(call.searchParams.get("tracking")).toBe(trackingNumber);
    expect(call.searchParams.get("content")).toBe("Appeler avant livraison");
  });

  it("getRemarks parses the plain JSON array (NOT wrapped in data)", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    await provider.addRemark(trackingNumber, "Appeler avant livraison");

    const remarks = await provider.getRemarks(trackingNumber);

    expect(remarks).toHaveLength(1);
    expect(remarks[0].content).toBe("Test Shop : Appeler avant livraison");
    expect(remarks[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("getRemarks handles carrier-side entries with Arabic content", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);

    const remarks = await provider.getRemarks(trackingNumber);

    expect(remarks).toHaveLength(3);
    expect(remarks[2].content).toBe("لا يرد على الإتصال");
    expect(remarks[2].createdAt).toBe("2021-03-05 11:16:27");
  });
});

describe("EcotrackProvider.getTrackingInfo", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses the activity object and combines date + time", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);

    const events = await provider.getTrackingInfo(trackingNumber);

    expect(events).toHaveLength(1);
    expect(events[0].activity).toBe("order_information_received_by_carrier");
    expect(events[0].date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("includes events added by validation (picked) and remarks (notification_on_order)", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    await provider.validateShipment(trackingNumber);
    await provider.addRemark(trackingNumber, "remarque");

    const events = await provider.getTrackingInfo(trackingNumber);

    expect(events.map((e) => e.activity)).toEqual([
      "order_information_received_by_carrier",
      "picked",
      "notification_on_order",
    ]);
  });

  it("throws on an unknown tracking (422)", async () => {
    await expect(provider.getTrackingInfo("ECUNKNOWN123")).rejects.toThrow(
      "The given data was invalid."
    );
  });
});

describe("EcotrackProvider.getStopDesks", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses the index-keyed communes object and keeps only has_stop_desk=1", async () => {
    const desks = await provider.getStopDesks();

    expect(desks).toHaveLength(4);
    expect(desks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "16001", name: "Alger Centre", commune: null, wilayaId: 16 }),
        expect.objectContaining({ code: "16100", name: "Bab Ezzouar", commune: null, wilayaId: 16 }),
        expect.objectContaining({ code: "25001", name: "Constantine", commune: null, wilayaId: 25 }),
        expect.objectContaining({ code: "31001", name: "Oran", commune: null, wilayaId: 31 }),
      ])
    );

    const call = server.callsFor("/api/v1/get/communes")[0];
    expect(call.method).toBe("GET");
  });
});

describe("EcotrackProvider.createShipmentsBulk", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs an object-keyed orders body (NOT an array) and maps results by reference", async () => {
    const results = await provider.createShipmentsBulk([
      { ...baseInput, reference: "REF-A" },
      { ...baseInput, reference: "REF-B", customerName: "Client B" },
    ]);

    const call = server.callsFor("/api/v1/create/orders")[0];
    expect(call.method).toBe("POST");
    expect(call.headers["authorization"]).toBe(`Bearer ${TOKEN}`);

    const body = JSON.parse(call.body!) as { orders: Record<string, Record<string, unknown>> };
    expect(body.orders).toBeInstanceOf(Object);
    expect(Array.isArray(body.orders)).toBe(false);
    expect(body.orders["0"].nom_client).toBe("Karim Benali");
    expect(body.orders["0"].montant).toBe("4500");
    expect(body.orders["0"].type).toBe("1");
    expect(body.orders["1"].nom_client).toBe("Client B");

    expect(results).toHaveLength(2);
    expect(results[0].trackingNumber).toMatch(/^ECMOCK\d{10}$/);
    expect(results[0].error).toBeUndefined();
    expect(results[1].trackingNumber).toMatch(/^ECMOCK\d{10}$/);
    expect(results[1].labelUrl).toBe(
      `${server.baseUrl}/api/v1/get/order/label?tracking=${results[1].trackingNumber}`
    );
  });

  it("falls back to index keys when an order has no reference", async () => {
    const results = await provider.createShipmentsBulk([
      { ...baseInput, reference: undefined },
    ]);

    expect(results[0].trackingNumber).toMatch(/^ECMOCK\d{10}$/);
    expect(results[0].error).toBeUndefined();
  });

  it("returns per-order errors from the reference-keyed error bag", async () => {
    const results = await provider.createShipmentsBulk([
      { ...baseInput, reference: "REF-OK" },
      { ...baseInput, reference: "REF-BAD", phone: "" },
    ]);

    expect(results[0].trackingNumber).toBeDefined();
    expect(results[0].error).toBeUndefined();

    expect(results[1].trackingNumber).toBeUndefined();
    expect(results[1].error).toContain("Le champ téléphone est obligatoire.");
  });

  it("rejects more than 100 orders without calling the API", async () => {
    const inputs = Array.from({ length: 101 }, (_, i) => ({
      ...baseInput,
      reference: `REF-${i}`,
    }));

    await expect(provider.createShipmentsBulk(inputs)).rejects.toThrow(/limit is 100/);
    expect(server.callsFor("/api/v1/create/orders")).toHaveLength(0);
  });

  it("returns an empty array for an empty input", async () => {
    const results = await provider.createShipmentsBulk([]);
    expect(results).toEqual([]);
    expect(server.requests).toHaveLength(0);
  });
});

describe("EcotrackProvider.getTrackingsBulk", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function createTwoParcels(): Promise<[string, string]> {
    const a = await provider.createShipment(baseInput);
    const b = await provider.createShipment({ ...baseInput, customerName: "Client B" });
    return [a.trackingNumber, b.trackingNumber];
  }

  it("requests repeated trackings[] params and matches entries by exact tracking", async () => {
    const [a, b] = await createTwoParcels();

    const entries = await provider.getTrackingsBulk([a, b]);

    const call = server.callsFor("/api/v1/get/trackings/info")[0];
    expect(call.method).toBe("GET");
    expect(call.headers["authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(call.searchParams.getAll("trackings[]")).toEqual([a, b]);

    expect(entries).toHaveLength(2);
    const ids = entries.map((e) => e.tracking).sort();
    expect(ids).toEqual([a, b].sort());
    for (const entry of entries) {
      expect(typeof entry.status).toBe("string");
      expect(Array.isArray(entry.activity)).toBe(true);
    }
  });

  it("parses the array shape (rows carrying a tracking field) — UNVERIFIED shape tolerance", async () => {
    const [a, b] = await createTwoParcels();

    server.override("/api/v1/get/trackings/info", () =>
      new Response(
        JSON.stringify([
          { tracking: b, status: "En livraison", activity: [{ date: "2026-09-01", time: "10:00:00", status: "picked" }] },
          { tracking: "ECNOTREQUESTED", status: "Autre colis" },
          { tracking: a, status: "Prêt à expédier", activity: [] },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const entries = await provider.getTrackingsBulk([a, b]);

    expect(entries).toHaveLength(2);
    const byTracking = Object.fromEntries(entries.map((e) => [e.tracking, e]));
    expect(byTracking[a].status).toBe("Prêt à expédier");
    expect(byTracking[b].status).toBe("En livraison");
    expect(entries.some((e) => e.tracking === "ECNOTREQUESTED")).toBe(false);
  });

  it("never attaches an unrequested tracking's entry (dzship first-row trap)", async () => {
    const [a] = await createTwoParcels();

    server.override("/api/v1/get/trackings/info", () =>
      new Response(
        JSON.stringify([
          { tracking: "ECSOMEBODYELSE", status: "Livre" },
          { tracking: a, status: "En livraison" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const entries = await provider.getTrackingsBulk([a]);

    expect(entries).toHaveLength(1);
    expect(entries[0].tracking).toBe(a);
    expect(entries[0].status).toBe("En livraison");
  });

  it("rejects more than 100 trackings without calling the API", async () => {
    const trackings = Array.from({ length: 101 }, (_, i) => `EC${i}`);
    await expect(provider.getTrackingsBulk(trackings)).rejects.toThrow(/limit is 100/);
    expect(server.callsFor("/api/v1/get/trackings/info")).toHaveLength(0);
  });

  it("returns an empty array for empty input without calling the API", async () => {
    const entries = await provider.getTrackingsBulk([]);
    expect(entries).toEqual([]);
    expect(server.requests).toHaveLength(0);
  });
});

describe("EcotrackProvider.getOrders", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses the Laravel pagination shape", async () => {
    const page = await provider.getOrders();

    const call = server.callsFor("/api/v1/get/orders")[0];
    expect(call.method).toBe("GET");
    expect(call.headers["authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(call.searchParams.get("page")).toBeNull();

    expect(page.per_page).toBe(40);
    expect(Array.isArray(page.data)).toBe(true);
    expect(page.total).toBeGreaterThan(0);
    expect(page.data[0]).toMatchObject({
      tracking: expect.any(String),
      status: expect.any(String),
      wilaya_id: expect.any(Number),
    });
  });

  it("forwards page, date window, and single-tracking lookup params", async () => {
    await provider.getOrders({
      page: 2,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      tracking: "ECG4SU2112195902",
    });

    const params = server.callsFor("/api/v1/get/orders")[0].searchParams;
    expect(params.get("page")).toBe("2");
    expect(params.get("start_date")).toBe("2026-08-01");
    expect(params.get("end_date")).toBe("2026-08-31");
    expect(params.get("tracking")).toBe("ECG4SU2112195902");
  });

  it("returns the created parcel via the tracking lookup", async () => {
    const created = await provider.createShipment(baseInput);
    const page = await provider.getOrders({ tracking: created.trackingNumber });

    expect(page.data).toHaveLength(1);
    expect(page.data[0].tracking).toBe(created.trackingNumber);
    expect(page.data[0].status).toBe("prete_a_expedier");
  });
});

describe("EcotrackProvider.getOrdersStatus", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("authenticates with the api_token QUERY PARAM (not Bearer alone)", async () => {
    const created = await provider.createShipment(baseInput);
    const data = await provider.getOrdersStatus([created.trackingNumber]);

    const call = server.callsFor("/api/v1/get/orders/status")[0];
    expect(call.searchParams.get("api_token")).toBe(TOKEN);
    expect(call.searchParams.get("trackings")).toBe(created.trackingNumber);
    expect(call.searchParams.get("status")).toBe("all");

    expect(data[created.trackingNumber]).toBeDefined();
    expect(data[created.trackingNumber].status).toBe("prete_a_expedier");
  });

  it("sends comma-separated custom statuses", async () => {
    await provider.getOrdersStatus(["EC1", "EC2"], ["en_livraison", "retour_recu"]);

    const params = server.callsFor("/api/v1/get/orders/status")[0].searchParams;
    expect(params.get("trackings")).toBe("EC1,EC2");
    expect(params.get("status")).toBe("en_livraison,retour_recu");
  });

  it("rejects more than 100 trackings without calling the API", async () => {
    const trackings = Array.from({ length: 101 }, (_, i) => `EC${i}`);
    await expect(provider.getOrdersStatus(trackings)).rejects.toThrow(/limit is 100/);
    expect(server.callsFor("/api/v1/get/orders/status")).toHaveLength(0);
  });

  it("returns an empty object for empty input without calling the API", async () => {
    const data = await provider.getOrdersStatus([]);
    expect(data).toEqual({});
    expect(server.requests).toHaveLength(0);
  });
});

describe("EcotrackProvider.getDesks", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses the {my_desk, other_desks} shape with full contact data", async () => {
    const { myDesk, otherDesks } = await provider.getDesks();

    const call = server.callsFor("/api/v1/get/desks")[0];
    expect(call.method).toBe("GET");
    expect(call.headers["authorization"]).toBe(`Bearer ${TOKEN}`);

    expect(myDesk).toBeDefined();
    expect(myDesk!.hub_name).toBe("Station Batna");
    expect(myDesk!.location!.phone).toBe("0660000000");
    expect(myDesk!.location!.map).toMatch(/^https:\/\//);
    expect(myDesk!.working_hours).toHaveLength(2);

    expect(otherDesks.length).toBeGreaterThan(0);
    const adrar = otherDesks.find((d) => d.wilaya === "Adrar");
    expect(adrar).toBeDefined();
    expect(adrar!.phone).toBe("05555555");
    expect(adrar!.adresse).toBe("أدرار");
  });

  it("tolerates null-heavy entries and missing sections", async () => {
    server.override("/api/v1/get/desks", () =>
      new Response(
        JSON.stringify({
          other_desks: [
            { name: "station chlef", phone: null, phone2: null, code_wilaya: "2", wilaya: "Chlef", commune: "Chlef", adresse: null, map: null },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { myDesk, otherDesks } = await provider.getDesks();

    expect(myDesk).toBeNull();
    expect(otherDesks).toHaveLength(1);
    expect(otherDesks[0].phone).toBeNull();
    expect(otherDesks[0].adresse).toBeNull();
    expect(otherDesks[0].name).toBe("station chlef");
  });

  it("defaults to empty when the response has no recognizable sections", async () => {
    server.override("/api/v1/get/desks", () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const { myDesk, otherDesks } = await provider.getDesks();
    expect(myDesk).toBeNull();
    expect(otherDesks).toEqual([]);
  });
});

describe("EcotrackProvider.askReturn", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs the request with query params and returns true for a parcel in delivery", async () => {
    const created = await provider.createShipment(baseInput);
    await provider.validateShipment(created.trackingNumber);

    const ok = await provider.askReturn(created.trackingNumber);
    expect(ok).toBe(true);

    const call = server.callsFor("/api/v1/ask/for/order/return")[0];
    expect(call.method).toBe("POST");
    expect(call.body).toBeUndefined();
    expect(call.searchParams.get("tracking")).toBe(created.trackingNumber);
    expect(server.parcel(created.trackingNumber)!.returnAsked).toBe(true);
  });

  it("throws EcoTrackApiError with code 10003 when the parcel is not returnable", async () => {
    const created = await provider.createShipment(baseInput);

    const err = await provider.askReturn(created.trackingNumber).catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).errorCode).toBe(10003);
    expect((err as EcoTrackApiError).message).toMatch(/retour ne peut pas etre demandé/i);
  });
});

describe("EcotrackProvider.validateReturns", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs a JSON body {trackings} and returns true on returned:success", async () => {
    const created = await provider.createShipment(baseInput);

    const ok = await provider.validateReturns([created.trackingNumber]);
    expect(ok).toBe(true);

    const call = server.callsFor("/api/v1/valid/returns")[0];
    expect(call.method).toBe("POST");
    expect(call.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(call.body!)).toEqual({ trackings: [created.trackingNumber] });
  });

  it("returns false on returned:fail (nothing eligible)", async () => {
    const ok = await provider.validateReturns(["ECUNKNOWN123"]);
    expect(ok).toBe(false);
  });

  it("returns false for an empty list without calling the API", async () => {
    const ok = await provider.validateReturns([]);
    expect(ok).toBe(false);
    expect(server.requests).toHaveLength(0);
  });
});

describe("EcotrackProvider.verifyConnection", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("authenticates with the token as a QUERY PARAM (not the Bearer header)", async () => {
    const result = await provider.verifyConnection();

    const call = server.callsFor("/api/v1/validate/token")[0];
    expect(call).toBeDefined();
    expect(call.searchParams.get("api_token")).toBe(TOKEN);

    expect(result.ok).toBe(true);
    expect(result.code).toBe("valid");
  });

  it("enriches a valid check with served wilaya ids", async () => {
    const result = await provider.verifyConnection();

    expect(result.ok).toBe(true);
    expect(result.details).toBeDefined();
    expect(Array.isArray(result.details!.servedWilayaIds)).toBe(true);
    expect((result.details!.servedWilayaIds as number[]).length).toBeGreaterThan(0);
    expect(typeof result.details!.servedWilayaCount).toBe("number");
  });

  it("reports an invalid token as a negative check (not a throw)", async () => {
    const badProvider = new EcotrackProvider("wrong-token", server.baseUrl);
    const result = await badProvider.verifyConnection();

    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid_token");
  });

  it("maps TOKEN_NOT_ALLOWED to the not_allowed outcome", async () => {
    server.override("/api/v1/validate/token", () =>
      new Response(
        JSON.stringify({ success: false, message: "TOKEN_NOT_ALLOWED" }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await provider.verifyConnection();

    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_allowed");
    expect(result.message).toMatch(/disabled for this account/i);
  });

  it("a territory failure never fails a valid check (best-effort enrichment)", async () => {
    server.override("/api/v1/get/wilayas", () =>
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    const result = await provider.verifyConnection();

    expect(result.ok).toBe(true);
    expect(result.details).toBeUndefined();
  });

  it("throws EcoTrackApiError only on transport failure", async () => {
    server.override("/api/v1/validate/token", () =>
      new Response(JSON.stringify({ message: "Too Many Attempts." }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const err = await provider.verifyConnection().catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).isRateLimit).toBe(true);
  });
});

describe("EcotrackProvider.getWilayas", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the plain array of served wilayas with Bearer auth", async () => {
    const wilayas = await provider.getWilayas();

    expect(Array.isArray(wilayas)).toBe(true);
    expect(wilayas.length).toBeGreaterThan(0);
    expect(wilayas[0]).toMatchObject({ wilaya_id: expect.any(Number), wilaya_name: expect.any(String) });
    expect(wilayas.some((w) => w.wilaya_id === 12)).toBe(false);

    const call = server.callsFor("/api/v1/get/wilayas")[0];
    expect(call.headers["authorization"]).toBe(`Bearer ${TOKEN}`);
  });
});

describe("EcotrackProvider error typing", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws EcoTrackApiError with isRateLimit on HTTP 429", async () => {
    server.override("/api/v1/create/order", () =>
      new Response(JSON.stringify({ message: "Too Many Attempts." }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const err = await provider.createShipment(baseInput).catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).isRateLimit).toBe(true);
    expect((err as EcoTrackApiError).statusCode).toBe(429);
    expect((err as EcoTrackApiError).message).toMatch(/rate limit/i);
  });

  it("carries business error code 10002 on a refused wilaya", async () => {
    const err = await provider
      .createShipment({ ...baseInput, wilayaId: 12, commune: "Tbessa" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).errorCode).toBe(10002);
    expect((err as EcoTrackApiError).message).toContain("Pas de livraison pour la wilaya sélectionnée");
  });

  it("carries business error code 10001 when updating a validated order", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    await provider.validateShipment(trackingNumber);

    const err = await provider
      .updateShipment(trackingNumber, { amount: 9999 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).errorCode).toBe(10001);
  });

  it("includes field-level details from the Laravel 422 bag", async () => {
    const err = await provider
      .createShipment({ ...baseInput, customerName: "" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).statusCode).toBe(422);
    expect((err as EcoTrackApiError).message).toContain("The given data was invalid.");
    expect((err as EcoTrackApiError).message).toContain("nom_client:");
    expect((err as EcoTrackApiError).message).toContain("Le champ nom client est obligatoire.");
  });

  it("throws EcoTrackApiError for the legacy delete:{fail} shape", async () => {
    const { trackingNumber } = await provider.createShipment(baseInput);
    server.override("/api/v1/delete/order", () =>
      new Response(JSON.stringify({ delete: "fail" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const err = await provider.deleteShipment(trackingNumber).catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).errorCode).toBeUndefined();
  });

  it("throws EcoTrackApiError when the carrier returns non-JSON", async () => {
    server.override("/api/v1/get/tracking/info", () =>
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    );

    const err = await provider.getTrackingInfo("ECMOCK0000000001").catch((e) => e);
    expect(err).toBeInstanceOf(EcoTrackApiError);
    expect((err as EcoTrackApiError).statusCode).toBe(502);
    expect((err as EcoTrackApiError).message).toMatch(/not valid JSON/);
  });
});

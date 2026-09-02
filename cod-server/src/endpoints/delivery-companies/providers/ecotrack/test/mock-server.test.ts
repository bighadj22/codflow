/**
 * EcoTrack Mock Server — Contract Tests
 *
 * Verifies the double itself: routing, auth quirks, stateful parcel
 * lifecycle, and recording — so Slice 2+ tests can trust it blindly.
 * Adapter-level correctness is asserted in adapter.test.ts (Slice 2).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEcotrackMockServer } from "./mock-server";
import { EcotrackProvider } from "../adapter";

const TOKEN = "ecotrack-test-token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createEcotrackMockServer", () => {
  let server: ReturnType<typeof createEcotrackMockServer>;

  beforeEach(() => {
    server = createEcotrackMockServer({ token: TOKEN });
  });

  it("serves create/order with a tracking number and records the request", async () => {
    const res = await server.fetch(
      `${server.baseUrl}/api/v1/create/order?nom_client=Karim&telephone=0551234567&adresse=Rue+1&code_wilaya=16&commune=Alger+Centre&montant=4500&type=1`,
      { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const body = (await res.json()) as { success: boolean; tracking: string };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.tracking).toMatch(/^ECMOCK\d{10}$/);

    const calls = server.callsFor("/api/v1/create/order");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].searchParams.get("nom_client")).toBe("Karim");
  });

  it("answers 422 with a Laravel bag when required create params are missing", async () => {
    const res = await server.fetch(`${server.baseUrl}/api/v1/create/order?nom_client=Karim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const body = (await res.json()) as { message: string; errors: Record<string, string[]> };

    expect(res.status).toBe(422);
    expect(body.message).toBe("The given data was invalid.");
    expect(body.errors.telephone).toEqual(["Le champ téléphone est obligatoire."]);
  });

  it("refuses create for a wilaya the tenant does not serve (10002)", async () => {
    const query = new URLSearchParams({
      nom_client: "Karim",
      telephone: "0551234567",
      adresse: "Rue 1",
      code_wilaya: "12",
      commune: "Tbessa",
      montant: "4500",
      type: "1",
    });
    const res = await server.fetch(`${server.baseUrl}/api/v1/create/order?${query}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const body = (await res.json()) as { success: boolean; error: number };

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: false, error: 10002, message: "Pas de livraison pour la wilaya sélectionnée" });
  });

  it("requires Bearer auth and answers 401 without it", async () => {
    const res = await server.fetch(`${server.baseUrl}/api/v1/get/wilayas`);
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(401);
    expect(body.message).toBe("Unauthenticated.");
  });

  it("requires api_token QUERY auth on get/orders/status — Bearer alone is rejected", async () => {
    const res = await server.fetch(
      `${server.baseUrl}/api/v1/get/orders/status?trackings=ECMOCK0000000001&status=all`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    expect(res.status).toBe(401);

    const okRes = await server.fetch(
      `${server.baseUrl}/api/v1/get/orders/status?api_token=${TOKEN}&trackings=ECMOCK0000000001&status=all`
    );
    expect(okRes.status).toBe(200);
    const body = (await okRes.json()) as { data: Record<string, unknown> };
    expect(body.data).toBeInstanceOf(Object);
  });

  it("drives a stateful lifecycle: create → validate locks the parcel (10001)", async () => {
    const createQuery = new URLSearchParams({
      nom_client: "Karim",
      telephone: "0551234567",
      adresse: "Rue 1",
      code_wilaya: "16",
      commune: "Alger Centre",
      montant: "4500",
      type: "1",
    });
    const auth = { Authorization: `Bearer ${TOKEN}` } as const;

    const created = (await (
      await server.fetch(`${server.baseUrl}/api/v1/create/order?${createQuery}`, {
        method: "POST",
        headers: auth,
      })
    ).json()) as { tracking: string };

    const updateQuery = new URLSearchParams({
      tracking: created.tracking,
      client: "Karim2",
      montant: "5000",
    });
    const updated = await (
      await server.fetch(`${server.baseUrl}/api/v1/update/order?${updateQuery}`, {
        method: "POST",
        headers: auth,
      })
    ).json();
    expect((updated as { success: boolean }).success).toBe(true);

    const validated = await (
      await server.fetch(`${server.baseUrl}/api/v1/valid/order?tracking=${created.tracking}`, {
        method: "POST",
        headers: auth,
      })
    ).json();
    expect((validated as { success: boolean }).success).toBe(true);

    const locked = await (
      await server.fetch(`${server.baseUrl}/api/v1/update/order?${updateQuery}`, {
        method: "POST",
        headers: auth,
      })
    ).json();
    expect(locked).toEqual({
      success: false,
      error: 10001,
      message: "Commande non modifiable",
    });
  });

  it("serves the label as raw PDF bytes", async () => {
    const createQuery = new URLSearchParams({
      nom_client: "Karim",
      telephone: "0551234567",
      adresse: "Rue 1",
      code_wilaya: "16",
      commune: "Alger Centre",
      montant: "4500",
      type: "1",
    });
    const created = (await (
      await server.fetch(`${server.baseUrl}/api/v1/create/order?${createQuery}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
    ).json()) as { tracking: string };

    const res = await server.fetch(
      `${server.baseUrl}/api/v1/get/order/label?tracking=${created.tracking}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.slice(0, 4)).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  });

  it("returns reference-keyed results for bulk create with per-order errors", async () => {
    const body = {
      orders: {
        "0": {
          reference: "REF-OK",
          nom_client: "Client One",
          telephone: "0500000000",
          adresse: "17 rue med",
          commune: "Alger Centre",
          code_wilaya: "16",
          montant: "5000",
          type: "1",
        },
        "1": {
          reference: "REF-BAD",
          nom_client: "Client Two",
          telephone: "",
          adresse: "17 rue med",
          commune: "Alger Centre",
          code_wilaya: "16",
          montant: "5000",
          type: "1",
        },
      },
    };
    const res = await server.fetch(`${server.baseUrl}/api/v1/create/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
    });
    const parsed = (await res.json()) as {
      results: Record<string, { success?: boolean; tracking?: string; telephone?: string[] }>;
    };

    expect(parsed.results["REF-OK"].success).toBe(true);
    expect(parsed.results["REF-OK"].tracking).toMatch(/^ECMOCK\d{10}$/);
    expect(parsed.results["REF-BAD"].telephone).toEqual(["Le champ téléphone est obligatoire."]);
  });

  it("override replaces one route's response and reset clears everything", async () => {
    server.override("/api/v1/get/wilayas", () => jsonResponse({ message: "Too Many Attempts." }, 429));

    const blocked = await server.fetch(`${server.baseUrl}/api/v1/get/wilayas`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(blocked.status).toBe(429);

    server.reset();

    const restored = await server.fetch(`${server.baseUrl}/api/v1/get/wilayas`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const wilayas = (await restored.json()) as Array<{ wilaya_id: number }>;
    expect(Array.isArray(wilayas)).toBe(true);
    expect(restored.status).toBe(200);

    expect(server.callsFor("/api/v1/get/wilayas")).toHaveLength(1);
    expect(server.parcel("ECMOCK0000000001")).toBeUndefined();
  });
});

describe("mock server drives the real EcotrackProvider", () => {
  it("createShipment through the adapter creates parcel state and a label URL", async () => {
    const server = createEcotrackMockServer({ token: TOKEN });
    const originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;
    try {
      const provider = new EcotrackProvider(TOKEN, server.baseUrl);

      const result = await provider.createShipment({
        orderId: "ord-1",
        customerName: "Karim Benali",
        phone: "0551234567",
        address: "Rue 1, Alger",
        wilayaId: 16,
        commune: "Alger Centre",
        amount: 4500,
        productDescription: "T-shirt",
        stopDesk: false,
      });

      expect(result.trackingNumber).toMatch(/^ECMOCK\d{10}$/);
      expect(result.labelUrl).toBe(
        `${server.baseUrl}/api/v1/get/order/label?tracking=${result.trackingNumber}`
      );

      const parcel = server.parcel(result.trackingNumber);
      expect(parcel).toBeDefined();
      expect(parcel!.status).toBe("prete_a_expedier");
      expect(parcel!.validated).toBe(false);

      const call = server.callsFor("/api/v1/create/order")[0];
      expect(call.headers["authorization"]).toBe(`Bearer ${TOKEN}`);
      expect(call.body).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

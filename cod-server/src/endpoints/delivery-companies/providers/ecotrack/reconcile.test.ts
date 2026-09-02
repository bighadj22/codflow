/**
 * EcoTrack Reconciliation — Tests
 *
 * Drives reconcileEcotrackOrders against the mock EcoTrack server with a
 * crafted orders page (override) and a mocked order DB, verifying:
 *   - drift fixes go through updateOrderStatusWebhook with the reconcile source
 *   - forward-only: a terminal our-status never regresses (guard returns
 *     updated:false — counted as unchanged)
 *   - unmapped carrier statuses are skipped and sampled, never guessed
 *   - unknown trackings count as notFound
 *   - page cap respected and morePagesRemain reported
 *
 * The rank guard itself is owned by cod-shared/queries/orders (webhook tests);
 * here it is mocked to model its contract.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createEcotrackMockServer, type EcotrackMockServer } from "./test/mock-server";
import { EcotrackProvider } from "./adapter";
import { reconcileEcotrackOrders, DEFAULT_MAX_PAGES } from "./reconcile";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/endpoints/webhooks/queries");
vi.mock("@/endpoints/orders/queries");

import { getOrderByTracking } from "@/endpoints/webhooks/queries";
import { updateOrderStatusWebhook } from "@/endpoints/orders/queries";

const TOKEN = "ecotrack-test-token";

function ordersPage(rows: Array<{ tracking: string; status: string }>) {
  return {
    current_page: 1,
    data: rows,
    last_page: 1,
    per_page: 40,
    total: rows.length,
    from: rows.length > 0 ? 1 : null,
    to: rows.length,
  };
}

describe("reconcileEcotrackOrders", () => {
  let server: EcotrackMockServer;
  let provider: EcotrackProvider;
  let originalFetch: typeof fetch;
  let ourOrders: Map<string, { id: string; status: string }>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createEcotrackMockServer({ token: TOKEN });
    provider = new EcotrackProvider(TOKEN, server.baseUrl);
    originalFetch = global.fetch;
    global.fetch = server.fetch as unknown as typeof fetch;

    ourOrders = new Map([
      ["TRK-A", { id: "ord-a", status: "dispatched" }],
      ["TRK-B", { id: "ord-b", status: "out_for_delivery" }],
      ["TRK-C", { id: "ord-c", status: "out_for_delivery" }],
      ["TRK-D", { id: "ord-d", status: "delivered" }],
      ["TRK-F", { id: "ord-f", status: "dispatched" }],
    ]);

    vi.mocked(getOrderByTracking).mockImplementation(
      (async (_db: unknown, tracking: string) =>
        ourOrders.get(tracking) ?? null) as any
    );
    vi.mocked(updateOrderStatusWebhook).mockImplementation(
      (async (_db: unknown, orderId: string, newStatus: string) => {
        // Model the rank guard: delivered is terminal — annule cannot regress it.
        if (orderId === "ord-d" && newStatus === "cancelled") {
          return { updated: false };
        }
        ourOrders.set(
          [...ourOrders.entries()].find(([, o]) => o.id === orderId)![0],
          { id: orderId, status: newStatus }
        );
        return { updated: true };
      }) as any
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("applies drift fixes forward-only and never guesses unmapped statuses", async () => {
    server.override("/api/v1/get/orders", () =>
      new Response(
        JSON.stringify(
          ordersPage([
            { tracking: "TRK-A", status: "en_livraison" },
            { tracking: "TRK-B", status: "en_livraison" },
            { tracking: "TRK-C", status: "livre_non_encaisse" },
            { tracking: "TRK-D", status: "annule" },
            { tracking: "TRK-E", status: "en_livraison" },
            { tracking: "TRK-F", status: "mystery_new_status" },
          ])
        ),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const summary = await reconcileEcotrackOrders({} as any, provider, "dhd_ecotrack");

    expect(summary.pagesFetched).toBe(1);
    expect(summary.ordersSeen).toBe(6);
    expect(summary.updated).toBe(2);
    expect(summary.unchanged).toBe(2);
    expect(summary.notFound).toBe(1);
    expect(summary.skippedUnmapped).toBe(1);
    expect(summary.unmappedSamples).toEqual(["mystery_new_status"]);
    expect(summary.morePagesRemain).toBe(false);

    expect(updateOrderStatusWebhook).toHaveBeenCalledWith(
      expect.anything(), "ord-a", "out_for_delivery", "ecotrack-reconcile:dhd_ecotrack"
    );
    expect(updateOrderStatusWebhook).toHaveBeenCalledWith(
      expect.anything(), "ord-c", "delivered", "ecotrack-reconcile:dhd_ecotrack"
    );
    // TRK-B already at the mapped status — no call
    // TRK-D terminal (delivered) — guard returns updated:false, no state change
    // TRK-F unmapped — never guessed
    expect(updateOrderStatusWebhook).not.toHaveBeenCalledWith(
      expect.anything(), "ord-b", expect.any(String), expect.any(String)
    );
    expect(updateOrderStatusWebhook).not.toHaveBeenCalledWith(
      expect.anything(), "ord-f", expect.any(String), expect.any(String)
    );
  });

  it("respects the page cap and reports remaining pages", async () => {
    server.override("/api/v1/get/orders", () =>
      new Response(
        JSON.stringify({ ...ordersPage([]), current_page: 1, last_page: 25, total: 1000 }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const summary = await reconcileEcotrackOrders({} as any, provider, "dhd_ecotrack");

    // Cap kicks in: 25 pages exist but a run fetches at most DEFAULT_MAX_PAGES
    expect(summary.pagesFetched).toBe(DEFAULT_MAX_PAGES);
    expect(summary.morePagesRemain).toBe(true);
  });

  it("returns a clean summary for an empty account", async () => {
    server.override("/api/v1/get/orders", () =>
      new Response(
        JSON.stringify(ordersPage([])),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const summary = await reconcileEcotrackOrders({} as any, provider, "packers_ecotrack");

    expect(summary).toEqual({
      pagesFetched: 1,
      ordersSeen: 0,
      updated: 0,
      unchanged: 0,
      notFound: 0,
      skippedUnmapped: 0,
      unmappedSamples: [],
      morePagesRemain: false,
    });
  });
});

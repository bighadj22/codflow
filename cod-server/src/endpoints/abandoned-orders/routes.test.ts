/**
 * Route-level integration tests for Abandoned Orders routers
 * (dashboard CRUD/stats + storefront upsert/convert).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import abandonedOrdersRouter from "./routes";
import storeAbandonedRouter from "./store-routes";
import {
  listAbandonedOrders,
  getAbandonedOrderStats,
  updateAbandonedOrderStatus,
  deleteAbandonedOrder,
  upsertAbandonedOrder,
  markAbandonedOrderConverted,
} from "../../../../cod-shared/queries/abandoned-orders";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("../../../../cod-shared/queries/abandoned-orders");

const NOW = new Date().toISOString();

let mockDb: any;

function abandonedRow(overrides: Record<string, any> = {}) {
  return {
    id: "ab_1",
    sessionId: "sess-1a2b-3c4d",
    customerName: "Ahmed Benali",
    phone: "0551234567",
    wilayaId: 16,
    communeId: null,
    wilayaName: "الجزائر",
    communeName: null,
    productId: "prod_1",
    productName: "Samsung Galaxy A54",
    variantId: null,
    variantLabel: null,
    price: 9000,
    deliveryType: "home",
    fbc: null,
    fbp: null,
    ipAddress: null,
    userAgent: null,
    status: "abandoned",
    convertedOrderId: null,
    convertedOrderNumber: null,
    recoveryAttempts: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Abandoned Orders routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", {
        id: "admin_user_001",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: "cod_admin_key",
        scopes: ["*"],
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/abandoned-orders", abandonedOrdersRouter);
    app.route("/store", storeAbandonedRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  describe("GET /api/abandoned-orders", () => {
    it("returns 200 with rows and pagination echo", async () => {
      vi.mocked(listAbandonedOrders).mockResolvedValue({
        rows: [abandonedRow()],
        total: 42,
      } as any);

      const res = await app.request("/api/abandoned-orders?status=abandoned&limit=25&offset=5");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.total).toBe(42);
      expect(body.limit).toBe(25);
      expect(body.offset).toBe(5);
      expect(listAbandonedOrders).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ status: "abandoned", limit: 25, offset: 5 })
      );
    });

    it("rejects an unknown status filter with 400", async () => {
      const res = await app.request("/api/abandoned-orders?status=bogus");

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/abandoned-orders/stats", () => {
    it("returns 200 with recovery metrics", async () => {
      vi.mocked(getAbandonedOrderStats).mockResolvedValue({
        totalAbandoned: 34,
        totalConverted: 12,
        conversionRate: 26,
        estimatedLostRevenue: 306000,
      } as any);

      const res = await app.request("/api/abandoned-orders/stats");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.conversionRate).toBe(26);
    });
  });

  describe("PATCH /api/abandoned-orders/{id}/status", () => {
    it("updates the recovery status", async () => {
      vi.mocked(updateAbandonedOrderStatus).mockResolvedValue(undefined as any);

      const res = await app.request("/api/abandoned-orders/ab_1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      });

      expect(res.status).toBe(200);
      expect(updateAbandonedOrderStatus).toHaveBeenCalledWith(mockDb, "ab_1", "contacted");
    });

    it("rejects an invalid status with 400", async () => {
      const res = await app.request("/api/abandoned-orders/ab_1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "shipped" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/abandoned-orders/{id}", () => {
    it("deletes the record", async () => {
      vi.mocked(deleteAbandonedOrder).mockResolvedValue(undefined as any);

      const res = await app.request("/api/abandoned-orders/ab_1", { method: "DELETE" });

      expect(res.status).toBe(200);
      expect(deleteAbandonedOrder).toHaveBeenCalledWith(mockDb, "ab_1");
    });
  });

  // ─── Storefront ─────────────────────────────────────────────────────────────

  describe("POST /store/abandoned", () => {
    it("upserts a record and returns its id with 200", async () => {
      vi.mocked(upsertAbandonedOrder).mockResolvedValue("ab_new" as any);

      const res = await app.request("/store/abandoned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "9b2f8a3c-1d4e-5f67-a89b-cd012345ef67",
          customerName: "Ahmed Benali",
          phone: "0551234567",
          productName: "Galaxy A54",
          price: 9000,
        }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.id).toBe("ab_new");
      expect(upsertAbandonedOrder).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ sessionId: "9b2f8a3c-1d4e-5f67-a89b-cd012345ef67" })
      );
    });

    it("rejects a malformed phone number with 400", async () => {
      const res = await app.request("/store/abandoned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "9b2f8a3c-1d4e-5f67-a89b-cd012345ef67",
          customerName: "Ahmed Benali",
          phone: "call me maybe",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /store/abandoned/{sessionId}/convert", () => {
    it("records conversion fire-and-forget", async () => {
      vi.mocked(markAbandonedOrderConverted).mockResolvedValue(undefined as any);

      const res = await app.request("/store/abandoned/sess-1a2b-3c4d/convert", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ord_9", orderNumber: "ORD-20260821-0007" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
    });

    it("stays 200 even when the underlying update fails", async () => {
      vi.mocked(markAbandonedOrderConverted).mockRejectedValue(new Error("db down"));

      const res = await app.request("/store/abandoned/sess_x/convert", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ord_9", orderNumber: "ORD-X" }),
      });

      expect(res.status).toBe(200);
    });
  });
});

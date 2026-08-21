/**
 * Route-level integration tests for Stock OpenAPIHono routers
 * (overview/alerts on /api/stock + nested product/variant stock routes).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CATEGORIES, ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { stockRouter, productStockRouter } from "./routes";
import * as q from "./queries";
import { NotFoundError, BusinessLogicError } from "@/lib/errors/classes";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(async () => {}),
  ACTIONS: { STOCK_ADJUSTED: "stock.adjusted" },
}));

const NOW = new Date().toISOString();

let mockDb: any;

/** Minimal chainable drizzle stub for handler-level selects (e.g. product-name lookup). */
function dbSelectReturning(result: any) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => result),
        })),
      })),
    })),
  };
}

function movementRow(overrides: Record<string, any> = {}) {
  return {
    id: "mov_1",
    productId: "prod_1",
    variantId: null,
    type: "PURCHASE",
    delta: 10,
    qtyBefore: 5,
    qtyAfter: 15,
    reason: "Restocked",
    reference: null,
    createdBy: "admin_user_001",
    createdByName: "Admin User",
    createdAt: NOW,
    ...overrides,
  };
}

function alertItem(overrides: Record<string, any> = {}) {
  return {
    productId: "prod_1",
    variantId: null,
    productName: "Samsung Galaxy A54",
    variantLabel: null,
    inventory: 2,
    lowStockThreshold: 5,
    isOutOfStock: false,
    ...overrides,
  };
}

describe("Stock routes (OpenAPIHono)", () => {
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
    app.route("/api/stock", stockRouter);
    app.route("/api/products", productStockRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  // ─── /api/stock/* ───────────────────────────────────────────────────────────

  describe("GET /api/stock/overview", () => {
    it("returns 200 with aggregated metrics", async () => {
      vi.mocked(q.getStockOverview).mockResolvedValue({
        totalSkus: 42,
        outOfStockCount: 3,
        lowStockCount: 7,
        totalInventoryValue: 1250000,
        currency: "DZD",
        outOfStockItems: [alertItem({ inventory: 0, isOutOfStock: true })],
        lowStockItems: [alertItem()],
        allItems: [],
      } as any);

      const res = await app.request("/api/stock/overview");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalSkus).toBe(42);
      expect(body.data.outOfStockItems[0].isOutOfStock).toBe(true);
    });
  });

  describe("GET /api/stock/alerts", () => {
    it("returns 200 with paginated alert items", async () => {
      vi.mocked(q.getStockAlerts).mockResolvedValue({
        items: [alertItem()],
        total: 10,
      } as any);

      const res = await app.request("/api/stock/alerts?limit=20&offset=5");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.total).toBe(10);
      expect(q.getStockAlerts).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ limit: 20, offset: 5 })
      );
    });

    it("returns 400 for a limit above 100", async () => {
      const res = await app.request("/api/stock/alerts?limit=500");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.category).toBe(ERROR_CATEGORIES.VALIDATION);
    });
  });

  // ─── Simple-product stock ───────────────────────────────────────────────────

  describe("POST /api/products/{id}/stock/adjust", () => {
    it("adjusts stock and returns the movement", async () => {
      vi.mocked(q.adjustStock).mockResolvedValue({
        movement: movementRow(),
        currentInventory: 15,
      } as any);
      mockDb = dbSelectReturning({ name: "Samsung Galaxy A54" });

      const res = await app.request("/api/products/prod_1/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PURCHASE", delta: 10 }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.currentInventory).toBe(15);
      expect(q.adjustStock).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ productId: "prod_1", variantId: null, type: "PURCHASE", delta: 10 })
      );
    });

    it("rejects a zero delta with 400", async () => {
      const res = await app.request("/api/products/prod_1/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PURCHASE", delta: 0 }),
      });

      expect(res.status).toBe(400);
    });

    it("requires a reason for ADJUSTMENT_ADD (superRefine)", async () => {
      const res = await app.request("/api/products/prod_1/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ADJUSTMENT_ADD", delta: 5 }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.category).toBe(ERROR_CATEGORIES.VALIDATION);
    });

    it("propagates 422 INSUFFICIENT_STOCK from the query layer", async () => {
      vi.mocked(q.adjustStock).mockRejectedValue(
        new BusinessLogicError("Insufficient stock. Available: 2, Required: 10", ERROR_CODES.INSUFFICIENT_STOCK)
      );

      const res = await app.request("/api/products/prod_1/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "OFFLINE_SALE", delta: -10, reason: "Store sale" }),
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.INSUFFICIENT_STOCK);
    });

    it("propagates 404 when the product does not exist", async () => {
      vi.mocked(q.adjustStock).mockRejectedValue(new NotFoundError("Product", "missing"));

      const res = await app.request("/api/products/missing/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PURCHASE", delta: 1 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/products/{id}/stock/history", () => {
    it("returns 200 with movements and total", async () => {
      vi.mocked(q.getStockHistory).mockResolvedValue({
        movements: [movementRow()],
        total: 25,
      } as any);

      const res = await app.request("/api/products/prod_1/stock/history?variantId=var_9");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.total).toBe(25);
      expect(q.getStockHistory).toHaveBeenCalledWith(
        mockDb,
        "prod_1",
        expect.objectContaining({ variantId: "var_9", limit: 20, offset: 0 })
      );
    });
  });

  describe("PATCH /api/products/{id}/stock/threshold", () => {
    it("updates the threshold and returns 200", async () => {
      vi.mocked(q.updateProductThreshold).mockResolvedValue(true as any);

      const res = await app.request("/api/products/prod_1/stock/threshold", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: 7 }),
      });

      expect(res.status).toBe(200);
      expect(q.updateProductThreshold).toHaveBeenCalledWith(mockDb, "prod_1", { lowStockThreshold: 7 });
    });

    it("returns 404 when the product is missing", async () => {
      vi.mocked(q.updateProductThreshold).mockResolvedValue(undefined as any);

      const res = await app.request("/api/products/missing/stock/threshold", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: 7 }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects a threshold above 9999 with 400", async () => {
      const res = await app.request("/api/products/prod_1/stock/threshold", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: 10000 }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── Variant stock ──────────────────────────────────────────────────────────

  describe("POST /api/products/{productId}/variants/{variantId}/stock/adjust", () => {
    it("adjusts variant stock and returns the movement", async () => {
      vi.mocked(q.adjustStock).mockResolvedValue({
        movement: movementRow({ variantId: "var_1" }),
        currentInventory: 8,
      } as any);
      mockDb = dbSelectReturning({ name: "Samsung Galaxy A54" });

      const res = await app.request("/api/products/prod_1/variants/var_1/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ADJUSTMENT_REMOVE", delta: -2, reason: "Damaged" }),
      });

      expect(res.status).toBe(200);
      expect(q.adjustStock).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ productId: "prod_1", variantId: "var_1", delta: -2 })
      );
    });
  });

  describe("PATCH /api/products/{productId}/variants/{variantId}/stock/threshold", () => {
    it("updates the variant threshold and returns 200", async () => {
      vi.mocked(q.updateVariantThreshold).mockResolvedValue(true as any);

      const res = await app.request("/api/products/prod_1/variants/var_1/stock/threshold", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: 3 }),
      });

      expect(res.status).toBe(200);
      expect(q.updateVariantThreshold).toHaveBeenCalledWith(mockDb, "var_1", "prod_1", { lowStockThreshold: 3 });
    });

    it("returns 404 when the variant is missing or foreign to the product", async () => {
      vi.mocked(q.updateVariantThreshold).mockResolvedValue(undefined as any);

      const res = await app.request("/api/products/prod_1/variants/var_other/stock/threshold", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: 3 }),
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("VARIANT_NOT_FOUND");
    });
  });
});

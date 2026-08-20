/**
 * Integration Tests for Variants Endpoint
 * 
 * Tests error scenarios for product variants endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import * as handlers from "./handlers";
import * as queries from "./queries";

// Mock the queries module
vi.mock("./queries");

// Mock the database
const mockDb = {} as any;
vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

describe("Variants Endpoint - Error Scenarios", () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    app = new Hono<AppContext>();
    
    // Add middleware to inject mock env and user
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "admin",
        status: "active",
        apiKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      await next();
    });
    
    app.onError(errorHandler);
    app.get("/products/:productId/variants/:variantId", handlers.getVariant);
    app.patch("/products/:productId/variants/:variantId", handlers.updateVariant);
    app.delete("/products/:productId/variants/:variantId", handlers.deleteVariant);
    
    vi.clearAllMocks();
  });

  describe("GET /products/:productId/variants/:variantId", () => {
    it("should return 404 with VARIANT_NOT_FOUND code when variant does not exist", async () => {
      // Mock getVariantById to return null
      vi.mocked(queries.getVariantById).mockResolvedValue(null);

      const res = await app.request("/products/prod_123/variants/var_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Variant with ID var_nonexistent not found",
        code: ERROR_CODES.VARIANT_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Variant",
          id: "var_nonexistent",
        },
      });
    });

    it("should return 200 with variant data when variant exists", async () => {
      // Mock successful response
      vi.mocked(queries.getVariantById).mockResolvedValue({
        id: "var_123",
        productId: "prod_123",
        variations: { Color: "Red", Size: "M" },
        price: 45000,
        currency: "DZD",
        compareAtPrice: null,
        sku: "GALAXY-A54-RED-M",
        barcode: null,
        inventory: 10,
        lowStockThreshold: 5,
        weightKg: null,
        imageId: null,
        isDefault: false,
        active: true,
        position: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await app.request("/products/prod_123/variants/var_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "var_123",
          productId: "prod_123",
        }),
      });
    });
  });

  describe("PATCH /products/:productId/variants/:variantId", () => {
    it("should return 404 with VARIANT_NOT_FOUND code when variant does not exist", async () => {
      // Mock updateVariant to return null
      vi.mocked(queries.updateVariant).mockResolvedValue(null);

      const res = await app.request("/products/prod_123/variants/var_nonexistent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price: 50000,
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Variant with ID var_nonexistent not found",
        code: ERROR_CODES.VARIANT_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Variant",
          id: "var_nonexistent",
        },
      });
    });

    it("should return 200 when variant is updated successfully", async () => {
      // Mock successful update
      vi.mocked(queries.updateVariant).mockResolvedValue({
        id: "var_123",
        productId: "prod_123",
        variations: { Color: "Red", Size: "M" },
        price: 50000,
        currency: "DZD",
        compareAtPrice: null,
        sku: "GALAXY-A54-RED-M",
        barcode: null,
        inventory: 10,
        lowStockThreshold: 5,
        weightKg: null,
        imageId: null,
        isDefault: false,
        active: true,
        position: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await app.request("/products/prod_123/variants/var_123", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price: 50000,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "var_123",
          price: 50000,
        }),
      });
    });
  });

  describe("DELETE /products/:productId/variants/:variantId", () => {
    it("should return 422 with VARIANT_HAS_ORDERS code when variant has existing orders", async () => {
      // Mock deleteVariant to throw error about existing orders
      vi.mocked(queries.deleteVariant).mockRejectedValue(
        new Error("Cannot delete variant with existing orders")
      );

      const res = await app.request("/products/prod_123/variants/var_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete variant with existing orders",
        code: ERROR_CODES.VARIANT_HAS_ORDERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          variantId: "var_123",
          productId: "prod_123",
        },
      });
    });

    it("should return 200 when variant is deleted successfully", async () => {
      // Mock successful deletion
      vi.mocked(queries.deleteVariant).mockResolvedValue({ success: true });

      const res = await app.request("/products/prod_123/variants/var_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
      });
    });
  });
});

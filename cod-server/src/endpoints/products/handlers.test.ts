/**
 * Integration Tests for Products Endpoint
 * 
 * Tests error scenarios for products endpoints.
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
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  get: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock activity logging
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(),
  ACTIONS: {
    PRODUCT_CREATED: "product.created",
    PRODUCT_UPDATED: "product.updated",
    PRODUCT_DELETED: "product.deleted",
    PRODUCT_STATUS_CHANGED: "product.status_changed",
  },
}));

describe("Products Endpoint - Error Scenarios", () => {
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
    app.get("/products/:id", handlers.getProduct);
    app.post("/products", handlers.createProduct);
    app.patch("/products/:id", handlers.updateProduct);
    app.patch("/products/:id/status", handlers.updateProductStatus);
    app.delete("/products/:id", handlers.deleteProduct);
    
    vi.clearAllMocks();
  });

  describe("GET /products/:id", () => {
    it("should return 404 with PRODUCT_NOT_FOUND code when product does not exist", async () => {
      // Mock getProductById to return null
      vi.mocked(queries.getProductById).mockResolvedValue(null);

      const res = await app.request("/products/prod_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Product with ID prod_nonexistent not found",
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Product",
          id: "prod_nonexistent",
        },
      });
    });

    it("should return 200 with product data when product exists", async () => {
      // Mock successful response
      vi.mocked(queries.getProductById).mockResolvedValue({
        id: "prod_123",
        name: "Samsung Galaxy A54",
        description: "Latest smartphone",
        handle: "samsung-galaxy-a54",
        currency: "DZD",
        price: 45000,
        compareAtPrice: null,
        costPrice: null,
        type: "PHYSICAL",
        hasVariants: false,
        variantOptions: null,
        sku: "GALAXY-A54",
        inventory: 10,
        lowStockThreshold: 5,
        trackInventory: true,
        categoryId: null,
        tags: [],
        visibility: true,
        status: "ACTIVE",
        showInStore: true,
        storeFeatured: false,
        deletedAt: null,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: null,
        variants: [],
        images: [],
        variantsCount: 0,
        totalInventory: 10,
        shippingProfileId: null,
      });

      const res = await app.request("/products/prod_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "prod_123",
          name: "Samsung Galaxy A54",
        }),
      });
    });
  });

  describe("POST /products", () => {
    it("should return 409 with DUPLICATE_SKU code when SKU already exists", async () => {
      // Mock database query to return existing product with same SKU
      mockDb.get.mockResolvedValue({
        id: "prod_existing",
        name: "Existing Product",
        sku: "GALAXY-A54",
        deleted_at: null,
      });

      const res = await app.request("/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Samsung Galaxy A54",
          price: 45000,
          sku: "GALAXY-A54",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        error: 'Product with SKU "GALAXY-A54" already exists',
        code: ERROR_CODES.DUPLICATE_SKU,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          sku: "GALAXY-A54",
          existingProductId: "prod_existing",
        },
      });
    });

    it("should return 201 when product is created successfully", async () => {
      // Mock no existing product with same SKU
      mockDb.get.mockResolvedValue(null);
      
      // Mock successful creation
      vi.mocked(queries.createProduct).mockResolvedValue({
        id: "prod_new",
        name: "Samsung Galaxy A54",
        description: null,
        handle: "samsung-galaxy-a54",
        currency: "DZD",
        price: 45000,
        compareAtPrice: null,
        costPrice: null,
        type: "PHYSICAL",
        hasVariants: false,
        variantOptions: null,
        sku: "GALAXY-A54",
        inventory: 0,
        lowStockThreshold: 5,
        trackInventory: true,
        categoryId: null,
        tags: [],
        visibility: true,
        status: "ACTIVE",
        showInStore: true,
        storeFeatured: false,
        deletedAt: null,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: null,
        variants: [],
        images: [],
        variantsCount: 0,
        totalInventory: 0,
        shippingProfileId: null,
      });

      const res = await app.request("/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Samsung Galaxy A54",
          price: 45000,
          sku: "GALAXY-A54",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "prod_new",
          name: "Samsung Galaxy A54",
        }),
      });
    });
  });

  describe("PATCH /products/:id", () => {
    it("should return 404 with PRODUCT_NOT_FOUND code when product does not exist", async () => {
      // Mock updateProduct to return null
      vi.mocked(queries.updateProduct).mockResolvedValue(null);

      const res = await app.request("/products/prod_nonexistent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Product",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Product with ID prod_nonexistent not found",
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Product",
          id: "prod_nonexistent",
        },
      });
    });
  });

  describe("PATCH /products/:id/status", () => {
    it("should return 404 with PRODUCT_NOT_FOUND code when product does not exist", async () => {
      // Mock updateProduct to return null
      vi.mocked(queries.updateProduct).mockResolvedValue(null);

      const res = await app.request("/products/prod_nonexistent/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "ARCHIVED",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Product with ID prod_nonexistent not found",
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Product",
          id: "prod_nonexistent",
        },
      });
    });
  });

  describe("DELETE /products/:id", () => {
    it("should return 404 with PRODUCT_NOT_FOUND code when product does not exist", async () => {
      // Mock getProductById to return null
      vi.mocked(queries.getProductById).mockResolvedValue(null);

      const res = await app.request("/products/prod_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Product with ID prod_nonexistent not found",
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Product",
          id: "prod_nonexistent",
        },
      });
    });

    it("should return 422 with PRODUCT_HAS_ORDERS code when product has existing orders", async () => {
      // Mock getProductById to return existing product
      vi.mocked(queries.getProductById).mockResolvedValue({
        id: "prod_123",
        name: "Samsung Galaxy A54",
        description: null,
        handle: "samsung-galaxy-a54",
        currency: "DZD",
        price: 45000,
        compareAtPrice: null,
        costPrice: null,
        type: "PHYSICAL",
        hasVariants: false,
        variantOptions: null,
        sku: "GALAXY-A54",
        inventory: 10,
        lowStockThreshold: 5,
        trackInventory: true,
        categoryId: null,
        tags: [],
        visibility: true,
        status: "ACTIVE",
        showInStore: true,
        storeFeatured: false,
        deletedAt: null,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: null,
        variants: [],
        images: [],
        variantsCount: 0,
        totalInventory: 10,
        shippingProfileId: null,
      });

      // Mock database query to return order with this product
      mockDb.get.mockResolvedValue({
        id: "order_prod_1",
        order_id: "order_123",
        product_id: "prod_123",
      });

      const res = await app.request("/products/prod_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete product with existing orders",
        code: ERROR_CODES.PRODUCT_HAS_ORDERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          productId: "prod_123",
          productName: "Samsung Galaxy A54",
        },
      });
    });

    it("should return 200 when product is deleted successfully", async () => {
      // Mock getProductById to return existing product
      vi.mocked(queries.getProductById).mockResolvedValue({
        id: "prod_123",
        name: "Samsung Galaxy A54",
        description: null,
        handle: "samsung-galaxy-a54",
        currency: "DZD",
        price: 45000,
        compareAtPrice: null,
        costPrice: null,
        type: "PHYSICAL",
        hasVariants: false,
        variantOptions: null,
        sku: "GALAXY-A54",
        inventory: 10,
        lowStockThreshold: 5,
        trackInventory: true,
        categoryId: null,
        tags: [],
        visibility: true,
        status: "ACTIVE",
        showInStore: true,
        storeFeatured: false,
        deletedAt: null,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: null,
        variants: [],
        images: [],
        variantsCount: 0,
        totalInventory: 10,
        shippingProfileId: null,
      });

      // Mock no orders with this product
      mockDb.get.mockResolvedValue(null);

      // Mock successful deletion
      vi.mocked(queries.deleteProduct).mockResolvedValue({ success: true });

      const res = await app.request("/products/prod_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Product deleted",
      });
    });
  });
});

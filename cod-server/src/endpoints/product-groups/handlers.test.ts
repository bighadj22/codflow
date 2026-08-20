/**
 * Integration Tests for Product Groups Endpoint
 * 
 * Tests error scenarios for product groups endpoints.
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

describe("Product Groups Endpoint - Error Scenarios", () => {
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
    app.get("/product-groups", handlers.listGroups);
    app.get("/product-groups/:id", handlers.getGroup);
    app.post("/product-groups", handlers.createGroup);
    app.patch("/product-groups/:id", handlers.updateGroup);
    app.delete("/product-groups/:id", handlers.deleteGroup);
    
    vi.clearAllMocks();
  });

  describe("GET /product-groups/:id", () => {
    it("should return 404 with PRODUCT_GROUP_NOT_FOUND code when group does not exist", async () => {
      // Mock getGroupById to return null
      vi.mocked(queries.getGroupById).mockResolvedValue(null);

      const res = await app.request("/product-groups/group_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Product Group with ID group_nonexistent not found",
        code: "PRODUCT_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Product Group",
          id: "group_nonexistent",
        },
      });
    });

    it("should return 200 with group data when group exists", async () => {
      // Mock successful response
      vi.mocked(queries.getGroupById).mockResolvedValue({
        id: "group_123",
        name: "Electronics",
        slug: "electronics-abc12345",
        description: "Electronic products",
        parentId: null,
        imageUrl: null,
        metaTitle: null,
        metaDescription: null,
        metaKeywords: null,
        position: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        children: [],
        productsCount: 5,
      });

      const res = await app.request("/product-groups/group_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "group_123",
          name: "Electronics",
        }),
      });
    });
  });

  describe("PATCH /product-groups/:id", () => {
    it("should return 404 with PRODUCT_GROUP_NOT_FOUND code when group does not exist", async () => {
      // Mock updateGroup to return null
      vi.mocked(queries.updateGroup).mockResolvedValue(null);

      const res = await app.request("/product-groups/group_nonexistent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Product Group with ID group_nonexistent not found",
        code: "PRODUCT_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Product Group",
          id: "group_nonexistent",
        },
      });
    });

    it("should return 200 when group is updated successfully", async () => {
      // Mock successful update
      vi.mocked(queries.updateGroup).mockResolvedValue({
        id: "group_123",
        name: "Updated Electronics",
        slug: "electronics-abc12345",
        description: "Updated description",
        parentId: null,
        imageUrl: null,
        metaTitle: null,
        metaDescription: null,
        metaKeywords: null,
        position: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-02").toISOString(),
        children: [],
        productsCount: 5,
      });

      const res = await app.request("/product-groups/group_123", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Electronics",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          name: "Updated Electronics",
        }),
      });
    });
  });

  describe("DELETE /product-groups/:id", () => {
    it("should return 404 with PRODUCT_GROUP_NOT_FOUND code when group does not exist", async () => {
      // Mock getGroupById to return null
      vi.mocked(queries.getGroupById).mockResolvedValue(null);

      const res = await app.request("/product-groups/group_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Product Group with ID group_nonexistent not found",
        code: "PRODUCT_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Product Group",
          id: "group_nonexistent",
        },
      });
    });

    it("should return 422 with PRODUCT_GROUP_HAS_PRODUCTS code when group has products", async () => {
      // Mock getGroupById to return a group with products
      vi.mocked(queries.getGroupById).mockResolvedValue({
        id: "group_123",
        name: "Electronics",
        slug: "electronics-abc12345",
        description: "Electronic products",
        parentId: null,
        imageUrl: null,
        metaTitle: null,
        metaDescription: null,
        metaKeywords: null,
        position: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        children: [],
        productsCount: 5,
      });

      const res = await app.request("/product-groups/group_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete product group with existing products",
        code: ERROR_CODES.PRODUCT_GROUP_HAS_PRODUCTS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          groupId: "group_123",
          groupName: "Electronics",
          productsCount: 5,
        },
      });
    });

    it("should return 200 when group is deleted successfully (no products)", async () => {
      // Mock getGroupById to return a group with no products
      vi.mocked(queries.getGroupById).mockResolvedValue({
        id: "group_123",
        name: "Empty Group",
        slug: "empty-group-abc12345",
        description: null,
        parentId: null,
        imageUrl: null,
        metaTitle: null,
        metaDescription: null,
        metaKeywords: null,
        position: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        children: [],
        productsCount: 0,
      });
      vi.mocked(queries.deleteGroup).mockResolvedValue({ success: true });

      const res = await app.request("/product-groups/group_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(null);

      const res = await app.request("/product-groups/group_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("code");
      expect(body).toHaveProperty("category");
      expect(typeof body.error).toBe("string");
      expect(typeof body.code).toBe("string");
      expect(typeof body.category).toBe("string");
    });

    it("should include context field when available", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue({
        id: "group_123",
        name: "Electronics",
        slug: "electronics-abc12345",
        description: "Electronic products",
        parentId: null,
        imageUrl: null,
        metaTitle: null,
        metaDescription: null,
        metaKeywords: null,
        position: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        children: [],
        productsCount: 5,
      });

      const res = await app.request("/product-groups/group_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toMatchObject({
        groupId: "group_123",
        groupName: "Electronics",
        productsCount: 5,
      });
    });
  });
});

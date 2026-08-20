/**
 * Integration Tests for Customer Tags Endpoint
 * 
 * Tests error scenarios for customer tags endpoints.
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

// Mock activity logging
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(),
  ACTIONS: {
    CUSTOMER_TAG_CREATED: "customer_tag.created",
    CUSTOMER_TAG_UPDATED: "customer_tag.updated",
    CUSTOMER_TAG_DELETED: "customer_tag.deleted",
    CUSTOMER_TAG_ASSIGNED: "customer_tag.assigned",
    CUSTOMER_TAG_UNASSIGNED: "customer_tag.unassigned",
  },
}));

describe("Customer Tags Endpoint - Error Scenarios", () => {
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
    app.get("/customer-tags", handlers.listTags);
    app.get("/customer-tags/:id", handlers.getTag);
    app.post("/customer-tags", handlers.createTag);
    app.patch("/customer-tags/:id", handlers.updateTag);
    app.delete("/customer-tags/:id", handlers.deleteTag);
    app.post("/customer-tags/:id/assignments", handlers.assignTag);
    app.delete("/customer-tags/:id/assignments/:customerId", handlers.unassignTag);
    
    vi.clearAllMocks();
  });

  describe("GET /customer-tags/:id", () => {
    it("should return 404 with CUSTOMER_TAG_NOT_FOUND code when tag does not exist", async () => {
      // Mock getTagById to return null
      vi.mocked(queries.getTagById).mockResolvedValue(undefined);

      const res = await app.request("/customer-tags/tag_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "customer_tag with ID tag_nonexistent not found",
        code: "CUSTOMER_TAG_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_tag",
          id: "tag_nonexistent",
        },
      });
    });

    it("should return 200 with tag data when tag exists", async () => {
      // Mock successful response
      vi.mocked(queries.getTagById).mockResolvedValue({
        id: "tag_123",
        name: "VIP",
        color: "#FF5733",
        assignmentCount: 3,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });

      const res = await app.request("/customer-tags/tag_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "tag_123",
          name: "VIP",
        }),
      });
    });
  });

  describe("DELETE /customer-tags/:id", () => {
    it("should return 404 with CUSTOMER_TAG_NOT_FOUND code when tag does not exist", async () => {
      // Mock getTagById to return null
      vi.mocked(queries.getTagById).mockResolvedValue(undefined);

      const res = await app.request("/customer-tags/tag_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "customer_tag with ID tag_nonexistent not found",
        code: "CUSTOMER_TAG_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_tag",
          id: "tag_nonexistent",
        },
      });
    });

    it("should return 422 with TAG_HAS_ASSIGNMENTS code when tag has assignments", async () => {
      // Mock getTagById to return a tag with assignments
      vi.mocked(queries.getTagById).mockResolvedValue({
        id: "tag_123",
        name: "VIP",
        color: "#FF5733",
        assignmentCount: 5,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });

      const res = await app.request("/customer-tags/tag_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete tag with assignments",
        code: ERROR_CODES.TAG_HAS_ASSIGNMENTS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          tagId: "tag_123",
          tagName: "VIP",
          assignmentCount: 5,
        },
      });
    });

    it("should return 200 when tag is deleted successfully (no assignments)", async () => {
      // Mock getTagById to return a tag with no assignments
      vi.mocked(queries.getTagById).mockResolvedValue({
        id: "tag_123",
        name: "Empty Tag",
        color: "#64748b",
        assignmentCount: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });
      vi.mocked(queries.deleteTag).mockResolvedValue(undefined);

      const res = await app.request("/customer-tags/tag_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Tag deleted",
      });
    });
  });

  describe("PATCH /customer-tags/:id", () => {
    it("should return 404 with CUSTOMER_TAG_NOT_FOUND code when tag does not exist", async () => {
      // Mock updateTag to return null
      vi.mocked(queries.updateTag).mockResolvedValue(undefined);

      const res = await app.request("/customer-tags/tag_nonexistent", {
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
        error: "customer_tag with ID tag_nonexistent not found",
        code: "CUSTOMER_TAG_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_tag",
          id: "tag_nonexistent",
        },
      });
    });
  });

  describe("POST /customer-tags/:id/assignments", () => {
    it("should return 404 with CUSTOMER_TAG_NOT_FOUND code when tag does not exist", async () => {
      // Mock getTagById to return null
      vi.mocked(queries.getTagById).mockResolvedValue(undefined);

      const res = await app.request("/customer-tags/tag_nonexistent/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: "cust_123",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "customer_tag with ID tag_nonexistent not found",
        code: "CUSTOMER_TAG_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_tag",
          id: "tag_nonexistent",
        },
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      vi.mocked(queries.getTagById).mockResolvedValue(undefined);

      const res = await app.request("/customer-tags/tag_nonexistent", {
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
      vi.mocked(queries.getTagById).mockResolvedValue({
        id: "tag_123",
        name: "VIP",
        color: "#FF5733",
        assignmentCount: 3,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });

      const res = await app.request("/customer-tags/tag_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toMatchObject({
        tagId: "tag_123",
        tagName: "VIP",
        assignmentCount: 3,
      });
    });
  });
});

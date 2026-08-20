/**
 * Integration Tests for Customer Groups Endpoint
 * 
 * Tests error scenarios for customer groups endpoints.
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
    CUSTOMER_GROUP_CREATED: "customer_group.created",
    CUSTOMER_GROUP_UPDATED: "customer_group.updated",
    CUSTOMER_GROUP_DELETED: "customer_group.deleted",
    CUSTOMER_GROUP_MEMBER_ADDED: "customer_group.member_added",
    CUSTOMER_GROUP_MEMBER_REMOVED: "customer_group.member_removed",
  },
}));

describe("Customer Groups Endpoint - Error Scenarios", () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    app = new Hono<AppContext>();
    
    // Add middleware to inject mock env and user
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", { id: "user-123", email: "test@example.com" } as any);
      await next();
    });
    
    app.onError(errorHandler);
    app.get("/customer-groups", handlers.listGroups);
    app.get("/customer-groups/:id", handlers.getGroup);
    app.post("/customer-groups", handlers.createGroup);
    app.patch("/customer-groups/:id", handlers.updateGroup);
    app.delete("/customer-groups/:id", handlers.deleteGroup);
    app.post("/customer-groups/:id/members", handlers.addMember);
    app.delete("/customer-groups/:id/members/:customerId", handlers.removeMember);
    
    vi.clearAllMocks();
  });

  describe("GET /customer-groups/:id", () => {
    it("should return 404 with CUSTOMER_GROUP_NOT_FOUND code when group does not exist", async () => {
      // Mock getGroupById to return null
      vi.mocked(queries.getGroupById).mockResolvedValue(undefined);

      const res = await app.request("/customer-groups/grp_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "customer_group with ID grp_nonexistent not found",
        code: "CUSTOMER_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_group",
          id: "grp_nonexistent",
        },
      });
    });

    it("should return 200 with group data when group exists", async () => {
      // Mock successful response
      vi.mocked(queries.getGroupById).mockResolvedValue({
        id: "grp_123",
        name: "VIP Customers",
        description: "High value customers",
        color: "#3B82F6",
        memberCount: 5,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });

      const res = await app.request("/customer-groups/grp_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "grp_123",
          name: "VIP Customers",
        }),
      });
    });
  });

  describe("DELETE /customer-groups/:id", () => {
    it("should return 404 with CUSTOMER_GROUP_NOT_FOUND code when group does not exist", async () => {
      // Mock getGroupById to return null
      vi.mocked(queries.getGroupById).mockResolvedValue(undefined);

      const res = await app.request("/customer-groups/grp_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "customer_group with ID grp_nonexistent not found",
        code: "CUSTOMER_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_group",
          id: "grp_nonexistent",
        },
      });
    });

    it("should return 422 with GROUP_HAS_MEMBERS code when group has members", async () => {
      // Mock getGroupById to return a group with members
      vi.mocked(queries.getGroupById).mockResolvedValue({
        id: "grp_123",
        name: "VIP Customers",
        description: "High value customers",
        color: "#3B82F6",
        memberCount: 5,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });

      const res = await app.request("/customer-groups/grp_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete group with members",
        code: ERROR_CODES.GROUP_HAS_MEMBERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          groupId: "grp_123",
          groupName: "VIP Customers",
          memberCount: 5,
        },
      });
    });

    it("should return 200 when group is deleted successfully (no members)", async () => {
      // Mock getGroupById to return a group with no members
      vi.mocked(queries.getGroupById).mockResolvedValue({
        id: "grp_123",
        name: "Empty Group",
        description: null,
        color: "#3B82F6",
        memberCount: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });
      vi.mocked(queries.deleteGroup).mockResolvedValue(undefined);

      const res = await app.request("/customer-groups/grp_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Group deleted",
      });
    });
  });

  describe("PATCH /customer-groups/:id", () => {
    it("should return 404 with CUSTOMER_GROUP_NOT_FOUND code when group does not exist", async () => {
      // Mock updateGroup to return null
      vi.mocked(queries.updateGroup).mockResolvedValue(undefined);

      const res = await app.request("/customer-groups/grp_nonexistent", {
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
        error: "customer_group with ID grp_nonexistent not found",
        code: "CUSTOMER_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_group",
          id: "grp_nonexistent",
        },
      });
    });
  });

  describe("POST /customer-groups/:id/members", () => {
    it("should return 404 with CUSTOMER_GROUP_NOT_FOUND code when group does not exist", async () => {
      // Mock getGroupById to return null
      vi.mocked(queries.getGroupById).mockResolvedValue(undefined);

      const res = await app.request("/customer-groups/grp_nonexistent/members", {
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
        error: "customer_group with ID grp_nonexistent not found",
        code: "CUSTOMER_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "customer_group",
          id: "grp_nonexistent",
        },
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(undefined);

      const res = await app.request("/customer-groups/grp_nonexistent", {
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
        id: "grp_123",
        name: "VIP Customers",
        description: null,
        color: "#3B82F6",
        memberCount: 3,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
      });

      const res = await app.request("/customer-groups/grp_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toMatchObject({
        groupId: "grp_123",
        groupName: "VIP Customers",
        memberCount: 3,
      });
    });
  });
});

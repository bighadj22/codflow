/**
 * Route-level integration tests for Customer Groups OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import customerGroupsRouter from "./routes";
import * as queries from "./queries";

const mockDb = {
  select: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");

const mockUser = {
  id: "user_admin_001",
  name: "Admin User",
  role: "admin",
  scopes: ["customer_groups:read", "customer_groups:manage"],
};

const NOW = new Date().toISOString();

function groupRow(overrides: Record<string, any> = {}) {
  return {
    id: "grp_123",
    name: "VIP Customers",
    description: "High value customers",
    color: "#3B82F6",
    memberCount: 5,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Customer Groups routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", mockUser as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/customer-groups", customerGroupsRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/customer-groups", () => {
    it("returns 200 with list of customer groups", async () => {
      vi.mocked(queries.getAllGroups).mockResolvedValue([groupRow()]);

      const res = await app.request("/api/customer-groups");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: [groupRow()],
        count: 1,
      });
    });

    it("passes query parameters (search, limit, offset) to queries.getAllGroups", async () => {
      vi.mocked(queries.getAllGroups).mockResolvedValue([]);

      const res = await app.request("/api/customer-groups?search=VIP&limit=10&offset=5");

      expect(res.status).toBe(200);
      expect(queries.getAllGroups).toHaveBeenCalledWith(mockDb, {
        search: "VIP",
        limit: 10,
        offset: 5,
      });
    });

    it("returns 400 for invalid query parameter (e.g. limit > 100)", async () => {
      const res = await app.request("/api/customer-groups?limit=200");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });
  });

  describe("POST /api/customer-groups", () => {
    it("creates a customer group successfully and returns 201", async () => {
      vi.mocked(queries.createGroup).mockResolvedValue(groupRow());

      const res = await app.request("/api/customer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "VIP Customers",
          description: "High value customers",
          color: "#3B82F6",
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: groupRow(),
        message: "Group created",
      });
    });

    it("returns 400 when name is missing or empty", async () => {
      const res = await app.request("/api/customer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 400 for invalid hex color", async () => {
      const res = await app.request("/api/customer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          color: "invalid-hex",
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });
  });

  describe("GET /api/customer-groups/:id", () => {
    it("returns 200 with group data when group exists", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(groupRow());

      const res = await app.request("/api/customer-groups/grp_123");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: groupRow(),
      });
      expect(queries.getGroupById).toHaveBeenCalledWith(mockDb, "grp_123");
    });

    it("fetches members when ?members=true", async () => {
      const groupWithMembers = {
        ...groupRow(),
        members: [
          {
            id: "cust_1",
            name: "Ahmed Benali",
            phone: "0555123456",
            wilaya: "Alger",
            totalOrders: 3,
            totalSpent: 10000,
            assignedAt: NOW,
          },
        ],
      };
      vi.mocked(queries.getGroupWithMembers).mockResolvedValue(groupWithMembers as any);

      const res = await app.request("/api/customer-groups/grp_123?members=true");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: groupWithMembers,
      });
      expect(queries.getGroupWithMembers).toHaveBeenCalledWith(mockDb, "grp_123");
    });

    it("returns 404 when group is not found", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-groups/grp_missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "CUSTOMER_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/customer-groups/:id", () => {
    it("updates group successfully", async () => {
      vi.mocked(queries.updateGroup).mockResolvedValue(groupRow({ name: "Updated VIP" }));

      const res = await app.request("/api/customer-groups/grp_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated VIP" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Updated VIP");
    });

    it("returns 400 for invalid hex color", async () => {
      const res = await app.request("/api/customer-groups/grp_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: "bad-color" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });
  });

  describe("DELETE /api/customer-groups/:id", () => {
    it("deletes group with 0 members successfully", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(groupRow({ memberCount: 0 }));
      vi.mocked(queries.deleteGroup).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-groups/grp_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        message: "Group deleted",
      });
    });

    it("returns 422 when trying to delete group with members", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(groupRow({ memberCount: 3 }));

      const res = await app.request("/api/customer-groups/grp_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.GROUP_HAS_MEMBERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("POST /api/customer-groups/:id/members", () => {
    it("adds member successfully", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(groupRow());
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ id: "cust_123" }),
          }),
        }),
      });
      vi.mocked(queries.addMember).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-groups/grp_123/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "cust_123" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        message: "Member added",
      });
    });
  });

  describe("DELETE /api/customer-groups/:id/members/:customerId", () => {
    it("removes member successfully", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(groupRow());
      vi.mocked(queries.removeMember).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-groups/grp_123/members/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        message: "Member removed",
      });
    });
  });
});

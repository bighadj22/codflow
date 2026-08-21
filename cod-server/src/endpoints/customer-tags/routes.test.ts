/**
 * Route-level integration tests for Customer Tags OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import customerTagsRouter from "./routes";
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
  scopes: ["customer_tags:read", "customer_tags:manage"],
};

const NOW = new Date().toISOString();

function tagRow(overrides: Record<string, any> = {}) {
  return {
    id: "tag_123",
    name: "VIP",
    color: "#64748b",
    assignmentCount: 5,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Customer Tags routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", mockUser as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/customer-tags", customerTagsRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/customer-tags", () => {
    it("returns 200 with list of customer tags", async () => {
      vi.mocked(queries.getAllTags).mockResolvedValue([tagRow()]);

      const res = await app.request("/api/customer-tags");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: [tagRow()],
        count: 1,
      });
    });

    it("passes query parameters (search, limit, offset) to queries.getAllTags", async () => {
      vi.mocked(queries.getAllTags).mockResolvedValue([]);

      const res = await app.request("/api/customer-tags?search=VIP&limit=10&offset=5");

      expect(res.status).toBe(200);
      expect(queries.getAllTags).toHaveBeenCalledWith(mockDb, {
        search: "VIP",
        limit: 10,
        offset: 5,
      });
    });

    it("returns 400 for invalid query parameter (e.g. limit > 100)", async () => {
      const res = await app.request("/api/customer-tags?limit=200");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });
  });

  describe("POST /api/customer-tags", () => {
    it("creates a customer tag successfully and returns 201", async () => {
      vi.mocked(queries.createTag).mockResolvedValue(tagRow());

      const res = await app.request("/api/customer-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "VIP",
          color: "#FF5733",
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: tagRow(),
        message: "Tag created",
      });
    });

    it("returns 400 when name is missing or empty", async () => {
      const res = await app.request("/api/customer-tags", {
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
      const res = await app.request("/api/customer-tags", {
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

  describe("GET /api/customer-tags/:id", () => {
    it("returns 200 with tag data when tag exists", async () => {
      vi.mocked(queries.getTagById).mockResolvedValue(tagRow());

      const res = await app.request("/api/customer-tags/tag_123");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: tagRow(),
      });
      expect(queries.getTagById).toHaveBeenCalledWith(mockDb, "tag_123");
    });

    it("fetches customers when ?customers=true", async () => {
      const tagWithCustomers = {
        ...tagRow(),
        customers: [
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
      vi.mocked(queries.getTagWithCustomers).mockResolvedValue(tagWithCustomers as any);

      const res = await app.request("/api/customer-tags/tag_123?customers=true");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: tagWithCustomers,
      });
      expect(queries.getTagWithCustomers).toHaveBeenCalledWith(mockDb, "tag_123");
    });

    it("returns 404 when tag is not found", async () => {
      vi.mocked(queries.getTagById).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-tags/tag_missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "CUSTOMER_TAG_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/customer-tags/:id", () => {
    it("updates tag successfully", async () => {
      vi.mocked(queries.updateTag).mockResolvedValue(tagRow({ name: "VIP+" }));

      const res = await app.request("/api/customer-tags/tag_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "VIP+" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("VIP+");
    });

    it("returns 400 for invalid hex color", async () => {
      const res = await app.request("/api/customer-tags/tag_123", {
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

  describe("DELETE /api/customer-tags/:id", () => {
    it("deletes tag with 0 assignments successfully", async () => {
      vi.mocked(queries.getTagById).mockResolvedValue(tagRow({ assignmentCount: 0 }));
      vi.mocked(queries.deleteTag).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-tags/tag_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        message: "Tag deleted",
      });
    });

    it("returns 422 when trying to delete tag with assignments", async () => {
      vi.mocked(queries.getTagById).mockResolvedValue(tagRow({ assignmentCount: 3 }));

      const res = await app.request("/api/customer-tags/tag_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.TAG_HAS_ASSIGNMENTS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("POST /api/customer-tags/:id/assignments", () => {
    it("assigns tag successfully", async () => {
      vi.mocked(queries.getTagById).mockResolvedValue(tagRow());
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ id: "cust_123" }),
          }),
        }),
      });
      vi.mocked(queries.assignTag).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-tags/tag_123/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "cust_123" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        message: "Tag assigned",
      });
    });
  });

  describe("DELETE /api/customer-tags/:id/assignments/:customerId", () => {
    it("unassigns tag successfully", async () => {
      vi.mocked(queries.getTagById).mockResolvedValue(tagRow());
      vi.mocked(queries.unassignTag).mockResolvedValue(undefined);

      const res = await app.request("/api/customer-tags/tag_123/assignments/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        message: "Tag unassigned",
      });
    });
  });
});

/**
 * Route-level integration tests for Product Groups OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import productGroupsRouter from "./routes";
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
  scopes: ["product_groups:read", "product_groups:manage"],
};

const NOW = new Date().toISOString();

function categoryRow(overrides: Record<string, any> = {}) {
  return {
    id: "cat_123",
    name: "Electronics",
    slug: "electronics-abc12345",
    description: "Electronic products",
    parentId: null,
    imageUrl: null,
    metaTitle: null,
    metaDescription: null,
    metaKeywords: null,
    position: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Product Groups routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", mockUser as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/product-groups", productGroupsRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/product-groups", () => {
    it("returns 200 with list of product groups and count", async () => {
      const group = { ...categoryRow(), productsCount: 5 };
      vi.mocked(queries.getAllGroups).mockResolvedValue([group]);

      const res = await app.request("/api/product-groups");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: [group],
        count: 1,
      });
    });

    it("passes query parameters (search, parentId) to queries.getAllGroups", async () => {
      vi.mocked(queries.getAllGroups).mockResolvedValue([]);

      const res = await app.request("/api/product-groups?search=elec&parentId=cat_1");

      expect(res.status).toBe(200);
      expect(queries.getAllGroups).toHaveBeenCalledWith(mockDb, {
        search: "elec",
        parentId: "cat_1",
      });
    });
  });

  describe("POST /api/product-groups", () => {
    it("creates a product group successfully and returns 201", async () => {
      const created = { ...categoryRow(), children: [], productsCount: 0 };
      vi.mocked(queries.createGroup).mockResolvedValue(created);

      const res = await app.request("/api/product-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Electronics" }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: created,
      });
    });

    it("returns 400 when name is missing or empty", async () => {
      const res = await app.request("/api/product-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });

    it("returns 400 for invalid slug (uppercase)", async () => {
      const res = await app.request("/api/product-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Electronics", slug: "Electronics" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 400 for invalid imageUrl", async () => {
      const res = await app.request("/api/product-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Electronics", imageUrl: "not-a-url" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });
  });

  describe("GET /api/product-groups/:id", () => {
    it("returns 200 with group data when group exists", async () => {
      const group = { ...categoryRow(), children: [], productsCount: 5 };
      vi.mocked(queries.getGroupById).mockResolvedValue(group);

      const res = await app.request("/api/product-groups/cat_123");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: group,
      });
      expect(queries.getGroupById).toHaveBeenCalledWith(mockDb, "cat_123");
    });

    it("returns 404 when group is not found", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(null);

      const res = await app.request("/api/product-groups/cat_missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "PRODUCT_GROUP_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/product-groups/:id", () => {
    it("updates group successfully", async () => {
      const updated = { ...categoryRow({ name: "Updated Electronics" }), children: [], productsCount: 2 };
      vi.mocked(queries.updateGroup).mockResolvedValue(updated);

      const res = await app.request("/api/product-groups/cat_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Electronics" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Updated Electronics");
    });

    it("returns 400 for invalid slug", async () => {
      const res = await app.request("/api/product-groups/cat_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "bad slug" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 404 when group is not found", async () => {
      vi.mocked(queries.updateGroup).mockResolvedValue(null);

      const res = await app.request("/api/product-groups/cat_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Whatever" }),
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "PRODUCT_GROUP_NOT_FOUND",
      });
    });
  });

  describe("DELETE /api/product-groups/:id", () => {
    it("deletes group with no products successfully", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue({
        ...categoryRow(),
        children: [],
        productsCount: 0,
      });
      vi.mocked(queries.deleteGroup).mockResolvedValue({ success: true } as any);

      const res = await app.request("/api/product-groups/cat_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("returns 422 when trying to delete group with products", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue({
        ...categoryRow(),
        children: [],
        productsCount: 5,
      });

      const res = await app.request("/api/product-groups/cat_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.PRODUCT_GROUP_HAS_PRODUCTS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          groupId: "cat_123",
          groupName: "Electronics",
          productsCount: 5,
        },
      });
    });

    it("returns 404 when group is not found", async () => {
      vi.mocked(queries.getGroupById).mockResolvedValue(null);

      const res = await app.request("/api/product-groups/cat_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "PRODUCT_GROUP_NOT_FOUND",
      });
    });
  });
});

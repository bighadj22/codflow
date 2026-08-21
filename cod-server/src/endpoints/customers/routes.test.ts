/**
 * Route-level integration tests for Customers OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import { BusinessLogicError } from "@/lib/errors/classes";
import customersRouter from "./routes";
import * as queries from "./queries";

const mockDb = {
  select: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(),
  ACTIONS: {
    CUSTOMER_CREATED: "customer.created",
    CUSTOMER_UPDATED: "customer.updated",
    CUSTOMER_DELETED: "customer.deleted",
  },
}));

const mockUser = {
  id: "user_admin_001",
  name: "Admin User",
  role: "admin",
  scopes: [
    "customers:read",
    "customers:create",
    "customers:update",
    "customers:delete",
    "customer_groups:read",
    "customer_tags:read",
  ],
};

const NOW = new Date().toISOString();

function customerRow(overrides: Record<string, any> = {}) {
  return {
    id: "cust_123",
    name: "Ahmed Benali",
    phone: "0551234567",
    phone2: null,
    wilayaId: 16,
    communeId: null,
    wilaya: "الجزائر",
    commune: null,
    address: null,
    totalOrders: 5,
    totalSpent: 15000,
    createdAt: NOW,
    lastOrderAt: null,
    ...overrides,
  };
}

describe("Customers routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", mockUser as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/customers", customersRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/customers", () => {
    it("returns 200 with list of customers and count", async () => {
      vi.mocked(queries.getAllCustomers).mockResolvedValue([customerRow()]);

      const res = await app.request("/api/customers");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.data).toHaveLength(1);
    });

    it("passes query parameters to queries.getAllCustomers", async () => {
      vi.mocked(queries.getAllCustomers).mockResolvedValue([]);

      const res = await app.request(
        "/api/customers?search=fatima&groupId=grp_1&tagId=tag_1&wilayaId=16&limit=10&offset=5"
      );

      expect(res.status).toBe(200);
      expect(queries.getAllCustomers).toHaveBeenCalledWith(mockDb, {
        search: "fatima",
        groupId: "grp_1",
        tagId: "tag_1",
        wilayaId: 16,
        limit: 10,
        offset: 5,
      });
    });

    it("returns 400 for limit > 100", async () => {
      const res = await app.request("/api/customers?limit=101");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });

    it("returns 400 for wilayaId out of range", async () => {
      const res = await app.request("/api/customers?wilayaId=99");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });
  });

  describe("POST /api/customers", () => {
    it("creates a customer successfully and returns 201", async () => {
      vi.mocked(queries.getCustomerByPhone).mockResolvedValue(undefined);
      const created = { ...customerRow({ id: "cust_new" }), recentOrders: [] };
      vi.mocked(queries.createCustomer).mockResolvedValue(created);

      const res = await app.request("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ahmed Benali",
          phone: "0551234567",
          wilayaId: 16,
          communeId: "c-16-001",
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: created,
        message: "Customer created successfully",
      });
    });

    it("returns 409 with DUPLICATE_PHONE when phone already exists", async () => {
      vi.mocked(queries.getCustomerByPhone).mockResolvedValue(
        customerRow({ id: "cust_existing" })
      );

      const res = await app.request("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ahmed Benali",
          phone: "0551234567",
          wilayaId: 16,
          communeId: "c-16-001",
        }),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DUPLICATE_PHONE,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          phone: "0551234567",
          existingCustomerId: "cust_existing",
        },
      });
    });

    it("returns 400 for invalid phone format", async () => {
      const res = await app.request("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ahmed Benali",
          phone: "0321234567",
          wilayaId: 16,
          communeId: "c-16-001",
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });
  });

  describe("GET /api/customers/:id", () => {
    it("returns 200 with customer data including recentOrders", async () => {
      const customer = { ...customerRow(), recentOrders: [] };
      vi.mocked(queries.getCustomerById).mockResolvedValue(customer);

      const res = await app.request("/api/customers/cust_123");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: customer });
      expect(queries.getCustomerById).toHaveBeenCalledWith(mockDb, "cust_123");
    });

    it("returns 404 when customer is not found", async () => {
      vi.mocked(queries.getCustomerById).mockResolvedValue(null);

      const res = await app.request("/api/customers/cust_missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.CUSTOMER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/customers/:id", () => {
    it("updates customer successfully", async () => {
      const updated = { ...customerRow({ name: "Updated Name" }), recentOrders: [] };
      vi.mocked(queries.updateCustomer).mockResolvedValue(updated);

      const res = await app.request("/api/customers/cust_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Updated Name");
    });

    it("returns 409 when updating to an existing phone", async () => {
      vi.mocked(queries.getCustomerByPhone).mockResolvedValue(
        customerRow({ id: "cust_other" })
      );

      const res = await app.request("/api/customers/cust_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "0551234567" }),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DUPLICATE_PHONE,
      });
    });

    it("returns 404 when customer is not found", async () => {
      vi.mocked(queries.updateCustomer).mockResolvedValue(null);

      const res = await app.request("/api/customers/cust_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Whatever" }),
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.CUSTOMER_NOT_FOUND,
      });
    });
  });

  describe("DELETE /api/customers/:id", () => {
    it("deletes customer with no orders successfully", async () => {
      vi.mocked(queries.getCustomerById).mockResolvedValue({
        ...customerRow(),
        recentOrders: [],
      });
      vi.mocked(queries.deleteCustomer).mockResolvedValue({ success: true });

      const res = await app.request("/api/customers/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Customer deleted successfully",
      });
    });

    it("returns 422 with CUSTOMER_HAS_ORDERS when customer has orders", async () => {
      vi.mocked(queries.getCustomerById).mockResolvedValue({
        ...customerRow(),
        recentOrders: [],
      });
      vi.mocked(queries.deleteCustomer).mockRejectedValue(
        new BusinessLogicError(
          "Cannot delete customer with existing orders",
          ERROR_CODES.CUSTOMER_HAS_ORDERS,
          { customerId: "cust_123", orderCount: 5 }
        )
      );

      const res = await app.request("/api/customers/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.CUSTOMER_HAS_ORDERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          customerId: "cust_123",
          orderCount: 5,
        },
      });
    });

    it("returns 404 when customer is not found", async () => {
      vi.mocked(queries.getCustomerById).mockResolvedValue(null);

      const res = await app.request("/api/customers/cust_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.CUSTOMER_NOT_FOUND,
      });
    });
  });

  describe("GET /api/customers/:id/orders", () => {
    it("returns 200 with orders and count", async () => {
      const order = {
        id: "ord_1",
        orderNumber: "ORD-20260327-0042",
        status: "new",
        price: 9000,
        createdAt: NOW,
        wilayaId: 16,
        communeId: null,
        wilayaName: "الجزائر",
        communeName: null,
        wilaya: "الجزائر",
        commune: null,
        statusHistory: [],
      };
      vi.mocked(queries.getOrdersByCustomerId).mockResolvedValue([order]);

      const res = await app.request("/api/customers/cust_123/orders");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: [order], count: 1 });
    });
  });

  describe("GET /api/customers/:id/groups", () => {
    it("returns 200 with group memberships", async () => {
      const membership = {
        id: "grp_123",
        name: "Wholesale Customers",
        color: "#6366f1",
        description: null,
        memberCount: 12,
        createdAt: NOW,
        updatedAt: NOW,
        assignedAt: NOW,
      };
      vi.mocked(queries.getCustomerGroupMemberships).mockResolvedValue([membership]);

      const res = await app.request("/api/customers/cust_123/groups");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: [membership] });
    });
  });

  describe("GET /api/customers/:id/tags", () => {
    it("returns 200 with tag memberships", async () => {
      const membership = {
        id: "tag_123",
        name: "VIP",
        color: "#64748b",
        assignmentCount: 8,
        createdAt: NOW,
        updatedAt: NOW,
        assignedAt: NOW,
      };
      vi.mocked(queries.getCustomerTagMemberships).mockResolvedValue([membership]);

      const res = await app.request("/api/customers/cust_123/tags");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: [membership] });
    });
  });
});

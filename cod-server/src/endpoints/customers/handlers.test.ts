/**
 * Integration Tests for Customers Endpoint
 * 
 * Tests error scenarios for customers endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import { BusinessLogicError } from "@/lib/errors/classes";
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
    CUSTOMER_CREATED: "customer.created",
    CUSTOMER_UPDATED: "customer.updated",
    CUSTOMER_DELETED: "customer.deleted",
  },
}));

describe("Customers Endpoint - Error Scenarios", () => {
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
    app.get("/customers", handlers.listCustomers);
    app.get("/customers/:id", handlers.getCustomer);
    app.post("/customers", handlers.createCustomer);
    app.patch("/customers/:id", handlers.updateCustomer);
    app.delete("/customers/:id", handlers.deleteCustomer);
    app.get("/customers/:id/orders", handlers.listCustomerOrders);
    app.get("/customers/:id/groups", handlers.listCustomerGroups);
    app.get("/customers/:id/tags", handlers.listCustomerTags);
    
    vi.clearAllMocks();
  });

  describe("GET /customers/:id", () => {
    it("should return 404 with CUSTOMER_NOT_FOUND code when customer does not exist", async () => {
      // Mock getCustomerById to return null
      vi.mocked(queries.getCustomerById).mockResolvedValue(null);

      const res = await app.request("/customers/cust_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Customer with ID cust_nonexistent not found",
        code: ERROR_CODES.CUSTOMER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Customer",
          id: "cust_nonexistent",
        },
      });
    });

    it("should return 200 with customer data when customer exists", async () => {
      // Mock successful response
      vi.mocked(queries.getCustomerById).mockResolvedValue({
        id: "cust_123",
        name: "Ahmed Benali",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: "12 Rue Didouche Mourad",
        totalOrders: 5,
        totalSpent: 15000,
        createdAt: new Date("2024-01-01").toISOString(),
        lastOrderAt: new Date("2024-01-15").toISOString(),
        recentOrders: [],
      });

      const res = await app.request("/customers/cust_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "cust_123",
          name: "Ahmed Benali",
        }),
      });
    });
  });

  describe("POST /customers", () => {
    it("should return 409 with DUPLICATE_PHONE code when phone number already exists", async () => {
      // Mock getCustomerByPhone to return existing customer
      vi.mocked(queries.getCustomerByPhone).mockResolvedValue({
        id: "cust_existing",
        name: "Existing Customer",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: null,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        lastOrderAt: null,
      });

      const res = await app.request("/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Ahmed Benali",
          phone: "0551234567",
          wilayaId: 16,
          communeId: "c-16-001",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "A customer with this phone number already exists",
        code: ERROR_CODES.DUPLICATE_PHONE,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          phone: "0551234567",
          existingCustomerId: "cust_existing",
        },
      });
    });

    it("should return 201 when customer is created successfully", async () => {
      // Mock no existing customer
      vi.mocked(queries.getCustomerByPhone).mockResolvedValue(undefined);
      
      // Mock successful creation
      vi.mocked(queries.createCustomer).mockResolvedValue({
        id: "cust_new",
        name: "Ahmed Benali",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: null,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
        lastOrderAt: null,
        recentOrders: [],
      });

      const res = await app.request("/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Ahmed Benali",
          phone: "0551234567",
          wilayaId: 16,
          communeId: "c-16-001",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "cust_new",
          name: "Ahmed Benali",
        }),
        message: "Customer created successfully",
      });
    });
  });

  describe("PATCH /customers/:id", () => {
    it("should return 404 with CUSTOMER_NOT_FOUND code when customer does not exist", async () => {
      // Mock updateCustomer to return null
      vi.mocked(queries.updateCustomer).mockResolvedValue(null);

      const res = await app.request("/customers/cust_nonexistent", {
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
        error: "Customer with ID cust_nonexistent not found",
        code: ERROR_CODES.CUSTOMER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Customer",
          id: "cust_nonexistent",
        },
      });
    });

    it("should return 409 with DUPLICATE_PHONE code when updating to existing phone", async () => {
      // Mock getCustomerByPhone to return different customer with same phone
      vi.mocked(queries.getCustomerByPhone).mockResolvedValue({
        id: "cust_other",
        name: "Other Customer",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: null,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        lastOrderAt: null,
      });

      const res = await app.request("/customers/cust_123", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "0551234567",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "A customer with this phone number already exists",
        code: ERROR_CODES.DUPLICATE_PHONE,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          phone: "0551234567",
          existingCustomerId: "cust_other",
        },
      });
    });
  });

  describe("DELETE /customers/:id", () => {
    it("should return 404 with CUSTOMER_NOT_FOUND code when customer does not exist", async () => {
      // Mock getCustomerById to return null
      vi.mocked(queries.getCustomerById).mockResolvedValue(null);

      const res = await app.request("/customers/cust_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Customer with ID cust_nonexistent not found",
        code: ERROR_CODES.CUSTOMER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Customer",
          id: "cust_nonexistent",
        },
      });
    });

    it("should return 422 with CUSTOMER_HAS_ORDERS code when customer has orders", async () => {
      // Mock getCustomerById to return a customer
      vi.mocked(queries.getCustomerById).mockResolvedValue({
        id: "cust_123",
        name: "Ahmed Benali",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: null,
        totalOrders: 5,
        totalSpent: 15000,
        createdAt: new Date("2024-01-01").toISOString(),
        lastOrderAt: new Date("2024-01-15").toISOString(),
        recentOrders: [],
      });

      // Mock deleteCustomer to throw error with order count
      vi.mocked(queries.deleteCustomer).mockRejectedValue(
        new BusinessLogicError("Cannot delete customer with existing orders", ERROR_CODES.CUSTOMER_HAS_ORDERS, { customerId: "cust_123", orderCount: 5 })
      );

      const res = await app.request("/customers/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete customer with existing orders",
        code: ERROR_CODES.CUSTOMER_HAS_ORDERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          customerId: "cust_123",
          orderCount: 5,
        },
      });
    });

    it("should verify orderCount is included in context when customer has orders", async () => {
      // Mock getCustomerById to return a customer
      vi.mocked(queries.getCustomerById).mockResolvedValue({
        id: "cust_123",
        name: "Ahmed Benali",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: null,
        totalOrders: 3,
        totalSpent: 9000,
        createdAt: new Date("2024-01-01").toISOString(),
        lastOrderAt: new Date("2024-01-15").toISOString(),
        recentOrders: [],
      });

      // Mock deleteCustomer to throw error with specific order count
      vi.mocked(queries.deleteCustomer).mockRejectedValue(
        new BusinessLogicError("Cannot delete customer with existing orders", ERROR_CODES.CUSTOMER_HAS_ORDERS, { customerId: "cust_123", orderCount: 3 })
      );

      const res = await app.request("/customers/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.context).toHaveProperty("orderCount");
      expect(body.context.orderCount).toBe(3);
    });

    it("should return 200 when customer is deleted successfully (no orders)", async () => {
      // Mock getCustomerById to return a customer with no orders
      vi.mocked(queries.getCustomerById).mockResolvedValue({
        id: "cust_123",
        name: "Ahmed Benali",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: null,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        lastOrderAt: null,
        recentOrders: [],
      });
      
      vi.mocked(queries.deleteCustomer).mockResolvedValue({ success: true });

      const res = await app.request("/customers/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Customer deleted successfully",
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      vi.mocked(queries.getCustomerById).mockResolvedValue(null);

      const res = await app.request("/customers/cust_nonexistent", {
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
      vi.mocked(queries.getCustomerById).mockResolvedValue({
        id: "cust_123",
        name: "Ahmed Benali",
        phone: "0551234567",
        phone2: null,
        wilayaId: 16,
        communeId: null,
        wilaya: "Alger",
        commune: null,
        address: null,
        totalOrders: 5,
        totalSpent: 15000,
        createdAt: new Date("2024-01-01").toISOString(),
        lastOrderAt: new Date("2024-01-15").toISOString(),
        recentOrders: [],
      });

      vi.mocked(queries.deleteCustomer).mockRejectedValue(
        new BusinessLogicError("Cannot delete customer with existing orders", ERROR_CODES.CUSTOMER_HAS_ORDERS, { customerId: "cust_123", orderCount: 5 })
      );

      const res = await app.request("/customers/cust_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toMatchObject({
        customerId: "cust_123",
        orderCount: 5,
      });
    });
  });
});

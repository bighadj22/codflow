/**
 * Integration Tests for Drivers Endpoint
 * 
 * Tests error scenarios for drivers endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import { ConflictError } from "@/lib/errors/classes";
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
    DRIVER_CREATED: "driver.created",
    DRIVER_UPDATED: "driver.updated",
    DRIVER_DELETED: "driver.deleted",
    DRIVER_STATUS_CHANGED: "driver.status_changed",
  },
}));

describe("Drivers Endpoint - Error Scenarios", () => {
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
    app.get("/drivers", handlers.listDrivers);
    app.get("/drivers/:id", handlers.getDriver);
    app.post("/drivers", handlers.createDriver);
    app.patch("/drivers/:id", handlers.updateDriver);
    app.patch("/drivers/:id/status", handlers.updateDriverStatus);
    app.delete("/drivers/:id", handlers.deleteDriver);
    
    vi.clearAllMocks();
  });

  describe("GET /drivers/:id", () => {
    it("should return 404 with DRIVER_NOT_FOUND code when driver does not exist", async () => {
      // Mock getDriverById to return null
      vi.mocked(queries.getDriverById).mockResolvedValue(null);

      const res = await app.request("/drivers/drv_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Driver with ID drv_nonexistent not found",
        code: ERROR_CODES.DRIVER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Driver",
          id: "drv_nonexistent",
        },
      });
    });

    it("should return 200 with driver data when driver exists", async () => {
      // Mock successful response
      vi.mocked(queries.getDriverById).mockResolvedValue({
        id: "drv_123",
        firstName: "Ahmed",
        lastName: "Benali",
        phone: "0551234567",
        phone2: null,
        vehicleType: "motorcycle",
        status: "available",
        totalDelivered: 50,
        totalEarnings: 25000,
        pendingCash: 5000,
        totalPaid: 20000,
        notes: null,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-15").toISOString(),
        compensationWilayaCount: 0,
        recentOrders: [],
      });

      const res = await app.request("/drivers/drv_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "drv_123",
          firstName: "Ahmed",
          lastName: "Benali",
        }),
      });
    });
  });

  describe("PATCH /drivers/:id", () => {
    it("should return 404 with DRIVER_NOT_FOUND code when driver does not exist", async () => {
      // Mock updateDriver to return null
      vi.mocked(queries.updateDriver).mockResolvedValue(null);

      const res = await app.request("/drivers/drv_nonexistent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "Updated",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Driver with ID drv_nonexistent not found",
        code: ERROR_CODES.DRIVER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Driver",
          id: "drv_nonexistent",
        },
      });
    });
  });

  describe("PATCH /drivers/:id/status", () => {
    it("should return 404 with DRIVER_NOT_FOUND code when driver does not exist", async () => {
      // Mock updateDriverStatus to return null
      vi.mocked(queries.updateDriverStatus).mockResolvedValue(null);

      const res = await app.request("/drivers/drv_nonexistent/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "busy",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Driver with ID drv_nonexistent not found",
        code: ERROR_CODES.DRIVER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Driver",
          id: "drv_nonexistent",
        },
      });
    });
  });

  describe("DELETE /drivers/:id", () => {
    it("should return 404 with DRIVER_NOT_FOUND code when driver does not exist", async () => {
      // Mock getDriverById to return null
      vi.mocked(queries.getDriverById).mockResolvedValue(null);

      const res = await app.request("/drivers/drv_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Driver with ID drv_nonexistent not found",
        code: ERROR_CODES.DRIVER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Driver",
          id: "drv_nonexistent",
        },
      });
    });

    it("should return 409 with DRIVER_HAS_ACTIVE_ORDERS code when driver has active orders", async () => {
      // Mock getDriverById to return a driver
      vi.mocked(queries.getDriverById).mockResolvedValue({
        id: "drv_123",
        firstName: "Ahmed",
        lastName: "Benali",
        phone: "0551234567",
        phone2: null,
        vehicleType: "motorcycle",
        status: "available",
        totalDelivered: 50,
        totalEarnings: 25000,
        pendingCash: 5000,
        totalPaid: 20000,
        notes: null,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-15").toISOString(),
        compensationWilayaCount: 0,
        recentOrders: [],
      });

      // Mock deleteDriver to throw error with active order count
      vi.mocked(queries.deleteDriver).mockRejectedValue(
        new ConflictError("Cannot delete driver with active orders", ERROR_CODES.DRIVER_HAS_ACTIVE_ORDERS, { driverId: "drv_123", activeOrderCount: 3 })
      );

      const res = await app.request("/drivers/drv_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete driver with active orders",
        code: ERROR_CODES.DRIVER_HAS_ACTIVE_ORDERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          driverId: "drv_123",
          activeOrderCount: 3,
        },
      });
    });

    it("should return 200 when driver is successfully deleted", async () => {
      // Mock getDriverById to return a driver
      vi.mocked(queries.getDriverById).mockResolvedValue({
        id: "drv_123",
        firstName: "Ahmed",
        lastName: "Benali",
        phone: "0551234567",
        phone2: null,
        vehicleType: "motorcycle",
        status: "available",
        totalDelivered: 50,
        totalEarnings: 25000,
        pendingCash: 5000,
        totalPaid: 20000,
        notes: null,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-15").toISOString(),
        compensationWilayaCount: 0,
        recentOrders: [],
      });

      // Mock deleteDriver to succeed
      vi.mocked(queries.deleteDriver).mockResolvedValue({ success: true });

      const res = await app.request("/drivers/drv_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Driver deleted successfully",
      });
    });
  });

  describe("Driver Unavailable Error", () => {
    it("should handle DRIVER_UNAVAILABLE error code (documented in spec)", async () => {
      // This test documents the DRIVER_UNAVAILABLE error code
      // which would be used when trying to assign an unavailable driver to an order
      // The actual implementation would be in the orders endpoint, not drivers endpoint
      
      // This is a placeholder test to verify the error code exists and is documented
      expect(ERROR_CODES.DRIVER_UNAVAILABLE).toBe("DRIVER_UNAVAILABLE");
    });
  });
});

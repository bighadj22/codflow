/**
 * Route-level integration tests for Drivers OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import { ConflictError } from "@/lib/errors/classes";
import driversRouter from "./routes";
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
    DRIVER_CREATED: "driver.created",
    DRIVER_UPDATED: "driver.updated",
    DRIVER_DELETED: "driver.deleted",
    DRIVER_STATUS_CHANGED: "driver.status_changed",
  },
}));

const mockUser = {
  id: "user_admin_001",
  name: "Admin User",
  role: "admin",
  scopes: ["delivery:read", "delivery:manage"],
};

const NOW = new Date().toISOString();

function driverRow(overrides: Record<string, any> = {}) {
  return {
    id: "drv_123",
    firstName: "Mohamed",
    lastName: "Amiri",
    phone: "0551234567",
    phone2: null,
    vehicleType: "van" as const,
    status: "available" as const,
    totalDelivered: 50,
    totalEarnings: 25000,
    pendingCash: 5000,
    totalPaid: 20000,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    compensationWilayaCount: 12,
    recentOrders: [],
    ...overrides,
  };
}

describe("Drivers routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", mockUser as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/drivers", driversRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/drivers", () => {
    it("returns 200 with drivers and count", async () => {
      vi.mocked(queries.getAllDrivers).mockResolvedValue([driverRow()]);

      const res = await app.request("/api/drivers");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.data[0].compensationWilayaCount).toBe(12);
    });

    it("passes query parameters to queries.getAllDrivers", async () => {
      vi.mocked(queries.getAllDrivers).mockResolvedValue([]);

      const res = await app.request(
        "/api/drivers?wilayaId=16&status=available&vehicleType=van&search=moh&limit=10&offset=5"
      );

      expect(res.status).toBe(200);
      expect(queries.getAllDrivers).toHaveBeenCalledWith(mockDb, {
        wilayaId: 16,
        status: "available",
        vehicleType: "van",
        search: "moh",
        limit: 10,
        offset: 5,
      });
    });

    it("returns 400 for invalid status filter", async () => {
      const res = await app.request("/api/drivers?status=flying");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });
  });

  describe("POST /api/drivers", () => {
    it("creates a driver successfully and returns 201", async () => {
      const created = driverRow({ id: "drv_new" });
      vi.mocked(queries.createDriver).mockResolvedValue(created);

      const res = await app.request("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Mohamed",
          lastName: "Amiri",
          phone: "0551234567",
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: created,
        message: "Driver created successfully",
      });
    });

    it("returns 409 DUPLICATE_PHONE when phone already exists", async () => {
      vi.mocked(queries.createDriver).mockRejectedValue(
        new Error('Driver with phone "0551234567" already exists')
      );

      const res = await app.request("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Mohamed",
          lastName: "Amiri",
          phone: "0551234567",
        }),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "DUPLICATE_PHONE",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: { phone: "0551234567" },
      });
    });

    it("returns 400 for invalid phone format", async () => {
      const res = await app.request("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Mohamed",
          lastName: "Amiri",
          phone: "0321234567",
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });
  });

  describe("GET /api/drivers/:id", () => {
    it("returns 200 with driver detail including recentOrders", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(driverRow());

      const res = await app.request("/api/drivers/drv_123");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.recentOrders).toEqual([]);
    });

    it("returns 404 when driver is not found", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(null);

      const res = await app.request("/api/drivers/drv_missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DRIVER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/drivers/:id", () => {
    it("updates driver successfully", async () => {
      vi.mocked(queries.updateDriver).mockResolvedValue(
        driverRow({ firstName: "Updated" })
      );

      const res = await app.request("/api/drivers/drv_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Updated" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.firstName).toBe("Updated");
    });

    it("returns 404 when driver is not found", async () => {
      vi.mocked(queries.updateDriver).mockResolvedValue(null);

      const res = await app.request("/api/drivers/drv_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Whatever" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/drivers/:id/status", () => {
    it("updates status successfully", async () => {
      vi.mocked(queries.updateDriverStatus).mockResolvedValue(
        driverRow({ status: "busy" })
      );

      const res = await app.request("/api/drivers/drv_123/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "busy" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.status).toBe("busy");
      expect(body.message).toBe("Driver status updated");
    });

    it("returns 400 for invalid status value", async () => {
      const res = await app.request("/api/drivers/drv_123/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "flying" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when driver is not found", async () => {
      vi.mocked(queries.updateDriverStatus).mockResolvedValue(null);

      const res = await app.request("/api/drivers/drv_missing/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "busy" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/drivers/:id", () => {
    it("deletes driver successfully", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(driverRow());
      vi.mocked(queries.deleteDriver).mockResolvedValue({ success: true });

      const res = await app.request("/api/drivers/drv_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Driver deleted successfully",
      });
    });

    it("returns 409 DRIVER_HAS_ACTIVE_ORDERS when driver has active orders", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(driverRow());
      vi.mocked(queries.deleteDriver).mockRejectedValue(
        new ConflictError(
          "Cannot delete driver with active orders",
          ERROR_CODES.DRIVER_HAS_ACTIVE_ORDERS,
          { driverId: "drv_123", activeOrderCount: 3 }
        )
      );

      const res = await app.request("/api/drivers/drv_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DRIVER_HAS_ACTIVE_ORDERS,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          driverId: "drv_123",
          activeOrderCount: 3,
        },
      });
    });

    it("returns 404 when driver is not found", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(null);

      const res = await app.request("/api/drivers/drv_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/drivers/:id/compensations", () => {
    it("returns 200 with all wilayas and sparse fees", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(driverRow());
      vi.mocked(queries.getCompensationsForDriver).mockResolvedValue([
        { wilayaId: 16, wilayaName: "Alger", wilayaNameAr: "الجزائر", feePerDelivery: 350 },
        { wilayaId: 31, wilayaName: "Oran", wilayaNameAr: "وهران", feePerDelivery: null },
      ]);

      const res = await app.request("/api/drivers/drv_123/compensations");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[1].feePerDelivery).toBeNull();
    });

    it("returns 404 when driver is not found", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(null);

      const res = await app.request("/api/drivers/drv_missing/compensations");

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/drivers/:id/compensations/:wilayaId", () => {
    it("upserts a compensation successfully", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(driverRow());
      vi.mocked(queries.setCompensation).mockResolvedValue({
        id: "comp_1",
        driverId: "drv_123",
        wilayaId: 16,
        feePerDelivery: 350,
        createdAt: NOW,
        updatedAt: NOW,
      });

      const res = await app.request("/api/drivers/drv_123/compensations/16", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feePerDelivery: 350 }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.feePerDelivery).toBe(350);
      expect(body.message).toBe("Compensation saved");
    });

    it("returns 400 for wilayaId out of range (route-level validation)", async () => {
      const res = await app.request("/api/drivers/drv_123/compensations/99", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feePerDelivery: 350 }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 404 when driver is not found", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(null);

      const res = await app.request("/api/drivers/drv_missing/compensations/16", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feePerDelivery: 350 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/drivers/:id/compensations/:wilayaId", () => {
    it("removes a compensation successfully", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(driverRow());
      vi.mocked(queries.deleteCompensation).mockResolvedValue(true);

      const res = await app.request("/api/drivers/drv_123/compensations/16", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        message: "Compensation removed",
      });
    });

    it("returns 404 when no compensation row exists", async () => {
      vi.mocked(queries.getDriverById).mockResolvedValue(driverRow());
      vi.mocked(queries.deleteCompensation).mockResolvedValue(false);

      const res = await app.request("/api/drivers/drv_123/compensations/16", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "DRIVER_COMPENSATION_NOT_FOUND",
      });
    });
  });
});

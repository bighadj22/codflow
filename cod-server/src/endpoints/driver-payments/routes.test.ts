/**
 * Route-level integration tests for Driver Payments OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import driverPaymentsRouter from "./routes";
import * as queries from "./queries";
import { BusinessLogicError } from "@/lib/errors/classes";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");

const NOW = new Date().toISOString();

let mockDb: any;

function paymentRow(overrides: Record<string, any> = {}) {
  return {
    id: "pay_1",
    driverId: "drv_1",
    type: "cod_remittance",
    amount: 95000,
    orderCount: 3,
    notes: null,
    createdBy: "admin_user_001",
    createdByName: "Admin User",
    createdAt: NOW,
    ...overrides,
  };
}

function orderRow(overrides: Record<string, any> = {}) {
  return {
    id: "ord_1",
    driverId: "drv_1",
    status: "delivered",
    codAmount: 45000,
    driverFee: 500,
    codPaymentId: null,
    feePaymentId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Driver Payments routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", {
        id: "admin_user_001",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: "cod_admin_key",
        scopes: ["*"],
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/driver-payments", driverPaymentsRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  describe("POST /api/driver-payments", () => {
    it("creates a payment and returns 201 with message", async () => {
      vi.mocked(queries.createDriverPayment).mockResolvedValue(
        paymentRow({ amount: 90000, orderCount: 2 }) as any
      );

      const res = await app.request("/api/driver-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: "drv_1",
          type: "cod_remittance",
          orderIds: ["ord_1", "ord_2"],
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.data.amount).toBe(90000);
      expect(body.message).toBe("Payment recorded successfully");
      expect(queries.createDriverPayment).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ driverId: "drv_1", type: "cod_remittance" }),
        "admin_user_001",
        "Admin User"
      );
    });

    it("rejects an empty orderIds array with 400", async () => {
      const res = await app.request("/api/driver-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: "drv_1", type: "cod_remittance", orderIds: [] }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects an unknown payment type with 400", async () => {
      const res = await app.request("/api/driver-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: "drv_1",
          type: "salary_advance",
          orderIds: ["ord_1"],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("propagates 422 PAYMENT_ALREADY_SETTLED from the query layer", async () => {
      vi.mocked(queries.createDriverPayment).mockRejectedValue(
        new BusinessLogicError("1 order(s) already have their COD settled", ERROR_CODES.PAYMENT_ALREADY_SETTLED)
      );

      const res = await app.request("/api/driver-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: "drv_1",
          type: "net_settlement",
          orderIds: ["ord_1"],
        }),
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.PAYMENT_ALREADY_SETTLED);
    });
  });

  describe("GET /api/driver-payments/{driverId}", () => {
    it("returns 200 with payment history (newest first)", async () => {
      vi.mocked(queries.getDriverPayments).mockResolvedValue([
        paymentRow(),
        paymentRow({ id: "pay_0", amount: 1000 }),
      ] as any);

      const res = await app.request("/api/driver-payments/drv_1");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toHaveLength(2);
      expect(queries.getDriverPayments).toHaveBeenCalledWith(mockDb, "drv_1");
    });

    it("returns 200 with an empty array for a driver without payments", async () => {
      vi.mocked(queries.getDriverPayments).mockResolvedValue([] as any);

      const res = await app.request("/api/driver-payments/drv_none");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });
  });

  describe("GET /api/driver-payments/{driverId}/pending", () => {
    it("returns 200 with delivered unsettled orders", async () => {
      vi.mocked(queries.getPendingSettlementOrders).mockResolvedValue([
        orderRow(),
        orderRow({ id: "ord_2", codAmount: 30000 }),
      ] as any);

      const res = await app.request("/api/driver-payments/drv_1/pending");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].codPaymentId).toBeNull();
      expect(queries.getPendingSettlementOrders).toHaveBeenCalledWith(mockDb, "drv_1");
    });

    it("returns 200 with an empty array when nothing is pending", async () => {
      vi.mocked(queries.getPendingSettlementOrders).mockResolvedValue([] as any);

      const res = await app.request("/api/driver-payments/drv_1/pending");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });
  });
});

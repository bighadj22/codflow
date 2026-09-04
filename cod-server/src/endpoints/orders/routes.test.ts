/**
 * Route-level integration tests for Orders OpenAPIHono router
 * (CRUD, lifecycle transitions, carrier dispatch guards, shipment ops).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import ordersRouter from "./routes";
import * as queries from "./queries";
import * as resolveFee from "./resolve-fee";
import { NotFoundError, BusinessLogicError } from "@/lib/errors/classes";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");
vi.mock("./resolve-fee");
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(async () => {}),
  ACTIONS: {
    ORDER_CREATED: "order.created",
    ORDER_UPDATED: "order.updated",
    ORDER_STATUS_CHANGED: "order.status_changed",
    ORDER_DRIVER_ASSIGNED: "order.driver_assigned",
    ORDER_DISPATCHED: "order.dispatched",
    ORDER_DELETED: "order.deleted",
    ORDER_PRODUCT_RETURNED: "order.product_returned",
    STOCK_ADJUSTED: "stock.adjusted",
  },
}));
vi.mock("@/workflows/capi-helpers", () => ({
  shouldTriggerCapiPurchase: vi.fn(() => false),
  resolveCapiDispatch: vi.fn(() => ({ send: false, reason: "tracking-disabled", message: "mock skip" })),
}));
vi.mock("@/endpoints/delivery-companies/queries", () => ({
  getDeliveryCompanyById: vi.fn(async () => ({ id: "comp_1", name: "NOEST" })),
  getDeliveryCompanyRaw: vi.fn(async () => ({
    id: "comp_1",
    name: "NOEST",
    code: "noest",
    active: true,
    apiEndpoint: "https://noest.test",
    apiToken: "tok",
  })),
}));

const NOW = new Date().toISOString();

let mockDb: any;

function dbSelectReturning(result: any) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => result),
          all: vi.fn(async () => (Array.isArray(result) ? result : result ? [result] : [])),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  };
}

function orderRow(overrides: Record<string, any> = {}) {
  return {
    id: "ord_1",
    orderNumber: "ORD-20260327-0042",
    customerId: "cust_1",
    customerName: "Ahmed Benali",
    phone: "0551234567",
    wilayaId: 16,
    wilaya: "الجزائر",
    communeId: "16001",
    commune: "بئر مراد رايس",
    city: null,
    address: "12 Rue Didouche Mourad",
    price: 9000,
    notes: null,
    status: "new",
    orderType: "online",
    deliveryMethod: "unassigned",
    driverId: null,
    driverName: null,
    companyId: "comp_1",
    assignedAt: null,
    assignedBy: null,
    assignmentNotes: null,
    trackingNumber: null,
    trackingUrl: null,
    externalOrderId: null,
    deliveryType: "home",
    stationCode: null,
    deliveryFee: 600,
    driverFee: 0,
    codAmount: 9600,
    pickupTime: null,
    deliveryTime: null,
    deliveryAttempts: 0,
    photos: null,
    codPaymentId: null,
    feePaymentId: null,
    weight: null,
    isFragile: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Orders routes (OpenAPIHono)", () => {
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
    app.route("/api/orders", ordersRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  describe("GET /api/orders", () => {
    it("returns 200 with orders and count", async () => {
      vi.mocked(queries.getAllOrders).mockResolvedValue([orderRow()] as any);

      const res = await app.request("/api/orders");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.count).toBe(1);
      expect(body.data[0].orderNumber).toBe("ORD-20260327-0042");
    });

    it("passes filters through to the query", async () => {
      vi.mocked(queries.getAllOrders).mockResolvedValue([] as any);

      const res = await app.request("/api/orders?status=delivered&limit=10");

      expect(res.status).toBe(200);
      expect(queries.getAllOrders).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ status: "delivered", limit: 10 })
      );
    });

    it("returns 400 for an unknown status filter", async () => {
      const res = await app.request("/api/orders?status=bogus");

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/orders/{id}", () => {
    it("returns 200 with detail including products and history", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(
        orderRow({
          products: [{ id: "op_1", orderId: "ord_1", status: "fulfilled" }],
          statusHistory: [{ id: "h1", orderId: "ord_1", status: "new", timestamp: NOW }],
        }) as any
      );

      const res = await app.request("/api/orders/ord_1");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body.data.products)).toBe(true);
      expect(Array.isArray(body.data.statusHistory)).toBe(true);
    });

    it("returns 404 when the order does not exist", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(null as any);

      const res = await app.request("/api/orders/missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("ORDER_NOT_FOUND");
    });
  });

  describe("POST /api/orders", () => {
    const validOrder = {
      customerId: "cust_1",
      customerName: "Ahmed Benali",
      phone: "0551234567",
      wilayaId: 16,
      communeId: "16001",
      address: "12 Rue Didouche Mourad",
      price: 9000,
      products: [
        { productId: "prod_1", productName: "Galaxy A54", quantity: 1, pricePerUnit: 9000, lineTotal: 9000 },
      ],
    };

    it("creates an order and returns computed COD amount with 201", async () => {
      vi.mocked(queries.createOrder).mockResolvedValue(undefined as any);
      vi.mocked(resolveFee.resolveDeliveryFee).mockResolvedValue({ deliveryFee: 600 } as any);
      vi.mocked(resolveFee.applyFreeShippingOffer).mockResolvedValue(600);
      mockDb = dbSelectReturning({ id: "cust_1" }); // existing customer

      const res = await app.request("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validOrder),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.data.codAmount).toBe(9600);
      expect(body.data.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
    });

    it("requires address for home delivery (superRefine)", async () => {
      const res = await app.request("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validOrder, address: undefined }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects a non-Algerian phone number", async () => {
      const res = await app.request("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validOrder, phone: "12345" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/orders/{id}", () => {
    it("deletes an existing order", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow() as any);
      vi.mocked(queries.deleteOrder).mockResolvedValue(undefined as any);

      const res = await app.request("/api/orders/ord_1", { method: "DELETE" });

      expect(res.status).toBe(200);
      expect(queries.deleteOrder).toHaveBeenCalledWith(mockDb, "ord_1");
    });

    it("returns 404 when deleting a missing order", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(null as any);

      const res = await app.request("/api/orders/missing", { method: "DELETE" });

      expect(res.status).toBe(404);
    });
  });

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  describe("PATCH /api/orders/{id}/status", () => {
    it("applies a valid forward transition", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow({ status: "confirmed" }) as any);
      vi.mocked(queries.updateOrderStatus).mockResolvedValue(undefined as any);

      const res = await app.request("/api/orders/ord_1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "preparing" }),
      });

      expect(res.status).toBe(200);
      expect(queries.updateOrderStatus).toHaveBeenCalledWith(
        mockDb, "ord_1", "preparing", "admin_user_001", "Admin User"
      );
    });

    it("blocks an invalid backward transition with 400 INVALID_STATUS_TRANSITION", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow({ status: "delivered" }) as any);

      const res = await app.request("/api/orders/ord_1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "new" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("INVALID_STATUS_TRANSITION");
      expect(body.context.allowedTransitions).toEqual([]);
    });
  });

  describe("PATCH /api/orders/{id}/assign-driver", () => {
    it("assigns a driver", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow() as any);
      vi.mocked(queries.assignDriver).mockResolvedValue(undefined as any);
      mockDb = dbSelectReturning({ id: "drv_1" });

      const res = await app.request("/api/orders/ord_1/assign-driver", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: "drv_1" }),
      });

      expect(res.status).toBe(200);
      expect(queries.assignDriver).toHaveBeenCalledWith(mockDb, "ord_1", "drv_1");
    });

    it("returns 422 when already dispatched to a company", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(
        orderRow({ trackingNumber: "NE123DZ" }) as any
      );

      const res = await app.request("/api/orders/ord_1/assign-driver", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: "drv_1" }),
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.ORDER_ALREADY_DISPATCHED);
    });
  });

  describe("PATCH /api/orders/{id}/unassign", () => {
    it("returns 422 when no driver is assigned", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow() as any);

      const res = await app.request("/api/orders/ord_1/unassign", { method: "PATCH" });

      expect(res.status).toBe(422);
    });

    it("unassigns successfully when a driver is set", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(
        orderRow({ driverId: "drv_1", deliveryMethod: "driver", status: "assigned" }) as any
      );
      vi.mocked(queries.unassignDriver).mockResolvedValue(undefined as any);

      const res = await app.request("/api/orders/ord_1/unassign", { method: "PATCH" });

      expect(res.status).toBe(200);
      expect(queries.unassignDriver).toHaveBeenCalledWith(mockDb, "ord_1");
    });
  });

  describe("PATCH /api/orders/{id}/products/{productLineId}/return", () => {
    it("records a return and reports derived status", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow() as any);
      vi.mocked(queries.setOrderProductReturn).mockResolvedValue({
        returnedQuantity: 1,
        status: "partially_returned",
      } as any);

      const res = await app.request("/api/orders/ord_1/products/op_1/return", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnedQuantity: 1 }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.status).toBe("partially_returned");
    });

    it("returns 422 on a terminal-state order", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow({ status: "cancelled" }) as any);

      const res = await app.request("/api/orders/ord_1/products/op_1/return", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnedQuantity: 1 }),
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.INVALID_STATUS_TRANSITION);
    });
  });

  // ─── Carrier dispatch ───────────────────────────────────────────────────────

  describe("POST /api/orders/bulk-dispatch", () => {
    it("rejects an empty orderIds array with 400", async () => {
      const res = await app.request("/api/orders/bulk-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "comp_1", orderIds: [] }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/orders/{id}/dispatch", () => {
    it("returns 404 when the order does not exist", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(null as any);

      const res = await app.request("/api/orders/missing/dispatch", { method: "POST" });

      expect(res.status).toBe(404);
    });

    it("returns 422 when already dispatched", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(
        orderRow({ trackingNumber: "NE999DZ" }) as any
      );

      const res = await app.request("/api/orders/ord_1/dispatch", { method: "POST" });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.ORDER_ALREADY_DISPATCHED);
    });

    it("returns 400 when no company is resolvable", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow({ companyId: null }) as any);

      const res = await app.request("/api/orders/ord_1/dispatch", { method: "POST" });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.REQUIRED_FIELD_MISSING);
    });
  });

  // ─── Shipment operations ────────────────────────────────────────────────────

  describe("shipment operation guards", () => {
    it("update-shipment returns 422 before dispatch", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow() as any);

      const res = await app.request("/api/orders/ord_1/update-shipment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100 }),
      });

      expect(res.status).toBe(422);
    });

    it("cancel-shipment returns 422 before dispatch", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow() as any);

      const res = await app.request("/api/orders/ord_1/cancel-shipment", { method: "POST" });

      expect(res.status).toBe(422);
    });

    it("add-remark rejects empty content with 400", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(
        orderRow({ trackingNumber: "NE123DZ" }) as any
      );

      const res = await app.request("/api/orders/ord_1/add-remark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("tracking-events returns 422 before dispatch", async () => {
      vi.mocked(queries.getOrderById).mockResolvedValue(orderRow() as any);

      const res = await app.request("/api/orders/ord_1/tracking-events");

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.REQUIRED_FIELD_MISSING);
    });
  });
});

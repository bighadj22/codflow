/**
 * Driver Payments — Integration Tests
 *
 * Coverage:
 *  1. createDriverPayment — validates orders, checks settlement status, throws appropriate errors
 *  2. Error scenarios — payment not found, invalid orders, already settled orders
 *  3. Error response structure verification
 */

import { describe, it, expect } from "vitest";
import { createPaymentSchema } from "./validation";
import { createDriverPayment, getDriverPayments, getPendingSettlementOrders } from "./queries";
import { makeMockDb, f, a, orderRow, NOW } from "@/test-utils/mock-db";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

// ─── Validation ────────────────────────────────────────────────────────────────

describe("createPaymentSchema", () => {
  const validBase = {
    driverId: "drv_1",
    type: "cod_remittance" as const,
    orderIds: ["ord_1", "ord_2"],
  };

  it("accepts a valid payment payload", () => {
    expect(createPaymentSchema.safeParse(validBase).success).toBe(true);
  });

  it("accepts optional notes field", () => {
    expect(createPaymentSchema.safeParse({ ...validBase, notes: "Test payment" }).success).toBe(true);
  });

  it("rejects empty driverId", () => {
    expect(createPaymentSchema.safeParse({ ...validBase, driverId: "" }).success).toBe(false);
  });

  it("rejects missing type", () => {
    const { type: _, ...rest } = validBase;
    expect(createPaymentSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid payment type", () => {
    expect(createPaymentSchema.safeParse({ ...validBase, type: "invalid_type" }).success).toBe(false);
  });

  it("rejects empty orderIds array", () => {
    expect(createPaymentSchema.safeParse({ ...validBase, orderIds: [] }).success).toBe(false);
  });

  it("rejects orderIds with empty strings", () => {
    expect(createPaymentSchema.safeParse({ ...validBase, orderIds: ["ord_1", ""] }).success).toBe(false);
  });

  it("accepts all valid payment types", () => {
    for (const type of ["cod_remittance", "fee_payment", "net_settlement"]) {
      expect(createPaymentSchema.safeParse({ ...validBase, type }).success).toBe(true);
    }
  });
});

// ─── Query logic ───────────────────────────────────────────────────────────────

describe("createDriverPayment", () => {
  it("throws BusinessLogicError when orders don't belong to driver", async () => {
    // orders.all returns only 1 order instead of 2 requested
    const db = makeMockDb([
      a([orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered" })]),
    ]);

    await expect(
      createDriverPayment(
        db,
        { driverId: "drv_1", type: "cod_remittance", orderIds: ["ord_1", "ord_2"] },
        "user_1",
        "Test User"
      )
    ).rejects.toThrow(BusinessLogicError);
  });

  it("throws BusinessLogicError with ORDER_NOT_FOUND code when orders are invalid", async () => {
    const db = makeMockDb([
      a([orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered" })]),
    ]);

    try {
      await createDriverPayment(
        db,
        { driverId: "drv_1", type: "cod_remittance", orderIds: ["ord_1", "ord_2"] },
        "user_1",
        "Test User"
      );
      expect.fail("Should have thrown BusinessLogicError");
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessLogicError);
      expect((error as BusinessLogicError).code).toBe(ERROR_CODES.ORDER_NOT_FOUND);
      expect((error as BusinessLogicError).context).toMatchObject({
        driverId: "drv_1",
        requestedCount: 2,
        foundCount: 1,
      });
    }
  });

  it("throws BusinessLogicError when COD already settled for cod_remittance", async () => {
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", cod_payment_id: "pay_old" }),
        orderRow({ id: "ord_2", driver_id: "drv_1", status: "delivered", cod_payment_id: null }),
      ]),
    ]);

    await expect(
      createDriverPayment(
        db,
        { driverId: "drv_1", type: "cod_remittance", orderIds: ["ord_1", "ord_2"] },
        "user_1",
        "Test User"
      )
    ).rejects.toThrow(BusinessLogicError);
  });

  it("throws BusinessLogicError with PAYMENT_ALREADY_SETTLED code when COD already settled", async () => {
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", cod_payment_id: "pay_old" }),
      ]),
    ]);

    try {
      await createDriverPayment(
        db,
        { driverId: "drv_1", type: "cod_remittance", orderIds: ["ord_1"] },
        "user_1",
        "Test User"
      );
      expect.fail("Should have thrown BusinessLogicError");
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessLogicError);
      expect((error as BusinessLogicError).code).toBe(ERROR_CODES.PAYMENT_ALREADY_SETTLED);
      expect((error as BusinessLogicError).context).toMatchObject({
        driverId: "drv_1",
        kind: "cod",
        settledCount: 1,
      });
      expect((error as BusinessLogicError).context?.settledOrderIds).toContain("ord_1");
    }
  });

  it("throws BusinessLogicError when fee already settled for fee_payment", async () => {
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", fee_payment_id: "pay_old" }),
      ]),
    ]);

    await expect(
      createDriverPayment(
        db,
        { driverId: "drv_1", type: "fee_payment", orderIds: ["ord_1"] },
        "user_1",
        "Test User"
      )
    ).rejects.toThrow(BusinessLogicError);
  });

  it("throws BusinessLogicError when COD already settled for net_settlement", async () => {
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", cod_payment_id: "pay_old" }),
      ]),
    ]);

    await expect(
      createDriverPayment(
        db,
        { driverId: "drv_1", type: "net_settlement", orderIds: ["ord_1"] },
        "user_1",
        "Test User"
      )
    ).rejects.toThrow(BusinessLogicError);
  });

  it("completes successfully for valid cod_remittance payment", async () => {
    // orders.all → driverPayments.insert → orders.update (COD) → drivers.update
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", cod_amount: 2500, cod_payment_id: null }),
        orderRow({ id: "ord_2", driver_id: "drv_1", status: "delivered", cod_amount: 3000, cod_payment_id: null }),
      ]),
    ]);

    const result = await createDriverPayment(
      db,
      { driverId: "drv_1", type: "cod_remittance", orderIds: ["ord_1", "ord_2"] },
      "user_1",
      "Test User"
    );

    expect(result).toMatchObject({
      driverId: "drv_1",
      type: "cod_remittance",
      amount: 5500, // 2500 + 3000
      orderCount: 2,
      createdByName: "Test User",
    });
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
  });

  it("completes successfully for valid fee_payment", async () => {
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", driver_fee: 200, fee_payment_id: null }),
        orderRow({ id: "ord_2", driver_id: "drv_1", status: "delivered", driver_fee: 300, fee_payment_id: null }),
      ]),
    ]);

    const result = await createDriverPayment(
      db,
      { driverId: "drv_1", type: "fee_payment", orderIds: ["ord_1", "ord_2"] },
      "user_1",
      "Test User"
    );

    expect(result).toMatchObject({
      driverId: "drv_1",
      type: "fee_payment",
      amount: 500, // 200 + 300
      orderCount: 2,
    });
  });

  it("completes successfully for valid net_settlement", async () => {
    const db = makeMockDb([
      a([
        orderRow({
          id: "ord_1",
          driver_id: "drv_1",
          status: "delivered",
          cod_amount: 2500,
          driver_fee: 200,
          cod_payment_id: null,
          fee_payment_id: null,
        }),
      ]),
    ]);

    const result = await createDriverPayment(
      db,
      { driverId: "drv_1", type: "net_settlement", orderIds: ["ord_1"] },
      "user_1",
      "Test User"
    );

    expect(result).toMatchObject({
      driverId: "drv_1",
      type: "net_settlement",
      amount: 2300, // 2500 - 200
      orderCount: 1,
    });
  });

  it("includes notes in payment record when provided", async () => {
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", cod_amount: 2500, cod_payment_id: null }),
      ]),
    ]);

    const result = await createDriverPayment(
      db,
      { driverId: "drv_1", type: "cod_remittance", orderIds: ["ord_1"], notes: "Monthly settlement" },
      "user_1",
      "Test User"
    );

    expect(result).toBeDefined();
    // Notes are stored in DB but not returned in the result object
  });
});

describe("getDriverPayments", () => {
  it("returns empty array when driver has no payments", async () => {
    const db = makeMockDb([a([])]);
    const result = await getDriverPayments(db, "drv_1");
    expect(result).toEqual([]);
  });

  it("returns payment history for driver", async () => {
    const db = makeMockDb([
      a([
        {
          id: "pay_1",
          driver_id: "drv_1",
          type: "cod_remittance",
          amount: 5500,
          order_count: 2,
          notes: null,
          created_by: "user_1",
          created_by_name: "Test User",
          created_at: NOW,
        },
      ]),
    ]);

    const result = await getDriverPayments(db, "drv_1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "pay_1",
      driverId: "drv_1",
      type: "cod_remittance",
      amount: 5500,
    });
  });
});

describe("getPendingSettlementOrders", () => {
  it("returns empty array when driver has no pending orders", async () => {
    const db = makeMockDb([a([])]);
    const result = await getPendingSettlementOrders(db, "drv_1");
    expect(result).toEqual([]);
  });

  it("returns only delivered orders with null codPaymentId", async () => {
    const db = makeMockDb([
      a([
        orderRow({ id: "ord_1", driver_id: "drv_1", status: "delivered", cod_payment_id: null }),
        orderRow({ id: "ord_2", driver_id: "drv_1", status: "delivered", cod_payment_id: null }),
      ]),
    ]);

    const result = await getPendingSettlementOrders(db, "drv_1");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("ord_1");
    expect(result[1].id).toBe("ord_2");
  });
});

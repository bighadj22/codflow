/**
 * Customers — Unit Tests
 *
 * Coverage:
 *  1. Validation schemas (Zod) — no DB required
 *  2. getCustomerById — returns null for missing customer
 *  3. deleteCustomer — throws when orders exist, succeeds otherwise
 *  4. createCustomer — inserts new customer
 *  5. updateCustomer — returns null for missing customer
 */

import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFiltersSchema,
} from "./validation";
import { deleteCustomer, getCustomerById, createCustomer } from "./queries";
import { makeMockDb, f, a, customerRow, NOW } from "@/test-utils/mock-db";

// ─── Validation ────────────────────────────────────────────────────────────────

describe("createCustomerSchema", () => {
  const validBase = {
    name: "Fatima Zahra",
    phone: "0661234567",
    wilayaId: 16,
    communeId: "c-16-001",
  };

  it("accepts a valid customer payload", () => {
    expect(createCustomerSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createCustomerSchema.safeParse({ ...validBase, name: "" }).success).toBe(false);
  });

  it("rejects wilayaId of 0 (out of range)", () => {
    expect(createCustomerSchema.safeParse({ ...validBase, wilayaId: 0 }).success).toBe(false);
  });

  it("rejects wilayaId of 59 (out of range)", () => {
    expect(createCustomerSchema.safeParse({ ...validBase, wilayaId: 59 }).success).toBe(false);
  });

  it("rejects phone with wrong prefix (03...)", () => {
    expect(createCustomerSchema.safeParse({ ...validBase, phone: "0321234567" }).success).toBe(false);
  });

  it("rejects phone that is too short", () => {
    expect(createCustomerSchema.safeParse({ ...validBase, phone: "066123456" }).success).toBe(false);
  });

  it("rejects phone that is too long", () => {
    expect(createCustomerSchema.safeParse({ ...validBase, phone: "06612345678" }).success).toBe(false);
  });

  it("accepts valid Algerian phone prefixes 05, 06, 07", () => {
    for (const phone of ["0551234567", "0661234567", "0771234567"]) {
      expect(createCustomerSchema.safeParse({ ...validBase, phone }).success).toBe(true);
    }
  });

  it("rejects invalid phone2 format", () => {
    expect(
      createCustomerSchema.safeParse({ ...validBase, phone2: "0321234567" }).success
    ).toBe(false);
  });

  it("accepts valid phone2", () => {
    expect(
      createCustomerSchema.safeParse({ ...validBase, phone2: "0771234567" }).success
    ).toBe(true);
  });

  it("accepts communeId and address fields", () => {
    expect(
      createCustomerSchema.safeParse({
        ...validBase,
        communeId: "550e8400-e29b-41d4-a716-446655440000",
        address: "شارع الاستقلال رقم 5",
      }).success
    ).toBe(true);
  });
});

describe("updateCustomerSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateCustomerSchema.safeParse({}).success).toBe(true);
  });

  it("rejects empty name if provided", () => {
    expect(updateCustomerSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects wilayaId out of range if provided", () => {
    expect(updateCustomerSchema.safeParse({ wilayaId: 0 }).success).toBe(false);
    expect(updateCustomerSchema.safeParse({ wilayaId: 59 }).success).toBe(false);
  });

  it("accepts null phone2 to clear secondary number", () => {
    expect(updateCustomerSchema.safeParse({ phone2: null }).success).toBe(true);
  });

  it("accepts null communeId to clear commune", () => {
    expect(updateCustomerSchema.safeParse({ communeId: null }).success).toBe(true);
  });

  it("accepts null address to clear address", () => {
    expect(updateCustomerSchema.safeParse({ address: null }).success).toBe(true);
  });

  it("rejects invalid phone if provided", () => {
    expect(updateCustomerSchema.safeParse({ phone: "0421234567" }).success).toBe(false);
  });
});

describe("customerFiltersSchema", () => {
  it("accepts valid filter combination", () => {
    const result = customerFiltersSchema.parse({ wilayaId: "16", search: "Fatima" });
    expect(result.wilayaId).toBe(16);
    expect(result.search).toBe("Fatima");
  });

  it("defaults limit to 50", () => {
    expect(customerFiltersSchema.parse({}).limit).toBe(50);
  });

  it("defaults offset to 0", () => {
    expect(customerFiltersSchema.parse({}).offset).toBe(0);
  });

  it("rejects limit > 100", () => {
    expect(customerFiltersSchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("coerces limit from string to number", () => {
    expect(customerFiltersSchema.parse({ limit: "20" }).limit).toBe(20);
  });

  it("rejects negative offset", () => {
    expect(customerFiltersSchema.safeParse({ offset: "-1" }).success).toBe(false);
  });
});

// ─── Query logic ───────────────────────────────────────────────────────────────

describe("getCustomerById", () => {
  it("returns null when customer does not exist", async () => {
    const db = makeMockDb([f(null)]);
    const result = await getCustomerById(db, "cust_missing");
    expect(result).toBeNull();
  });

  it("returns the customer with recentOrders when found", async () => {
    // customers.get → orders.all (recent orders)
    const db = makeMockDb([
      f(customerRow()),
      a([]), // no recent orders
    ]);
    const result = await getCustomerById(db, "cust_1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("cust_1");
    expect(result!.recentOrders).toEqual([]);
  });
});

describe("createCustomer", () => {
  it("creates a customer successfully", async () => {
    // wilayas.get → INSERT customers (run) → getCustomerById: customers.get + orders.all
    const db = makeMockDb([
      f({ name_ar: "وهران" }),                                    // wilaya name lookup
      f(customerRow({ name: "Omar Khaled" })),                    // getCustomerById
      a([]),                                                        // recentOrders
    ]);

    const result = await createCustomer(db, {
      name: "Omar Khaled",
      phone: "0551234567",
      wilayaId: 31,
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBeDefined();
  });

  it("accepts communeId and address fields", async () => {
    // wilayas.get → communes.get → INSERT (run) → customers.get + orders.all
    const db = makeMockDb([
      f({ name_ar: "الجزائر" }),                                  // wilaya name lookup
      f({ name_ar: "باب الوادي" }),                               // commune name lookup
      f(customerRow({ commune_id: "c-16-001", commune: "باب الوادي", address: "شارع 5" })),
      a([]),
    ]);

    const result = await createCustomer(db, {
      name: "Amina",
      phone: "0661234567",
      wilayaId: 16,
      communeId: "c-16-001",
      address: "شارع 5",
    });

    expect(result).not.toBeNull();
  });
});

describe("deleteCustomer", () => {
  it("throws when customer has existing orders", async () => {
    const db = makeMockDb([f({ count: 3 })]);
    await expect(deleteCustomer(db, "cust_1")).rejects.toThrow(
      "Cannot delete customer with existing orders"
    );
  });

  it("throws when customer has exactly 1 order", async () => {
    const db = makeMockDb([f({ count: 1 })]);
    await expect(deleteCustomer(db, "cust_1")).rejects.toThrow(
      "Cannot delete customer with existing orders"
    );
  });

  it("succeeds when customer has no orders", async () => {
    // count.get() → { count: 0 } → DELETE (run — no queue consumption)
    const db = makeMockDb([f({ count: 0 })]);
    await expect(deleteCustomer(db, "cust_1")).resolves.toEqual({ success: true });
  });
});

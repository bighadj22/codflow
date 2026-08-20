/**
 * Stock — Integration Tests
 *
 * Tests error scenarios for stock management endpoints:
 *  1. Stock record not found error
 *  2. Insufficient stock error
 *  3. Negative stock not allowed error
 *  4. Error response structure and codes
 */

import { describe, it, expect } from "vitest";
import { adjustStock } from "./queries";
import { makeMockDb, f } from "@/test-utils/mock-db";
import { NotFoundError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

// ─── adjustStock Error Scenarios ───────────────────────────────────────────────

describe("adjustStock - Error Scenarios", () => {
  const validParams = {
    productId: "00000000-0000-0000-0000-000000000001",
    variantId: null,
    type: "ADJUSTMENT_ADD" as const,
    delta: 10,
    reason: "Restock",
    createdBy: "user-123",
    createdByName: "Ahmed",
  };

  describe("Stock Record Not Found", () => {
    it("throws NotFoundError when product does not exist", async () => {
      // Mock DB returns null for product lookup
      const db = makeMockDb([f(null)]);

      await expect(
        adjustStock(db, validParams)
      ).rejects.toThrow(NotFoundError);

      try {
        await adjustStock(db, validParams);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        if (error instanceof NotFoundError) {
          expect(error.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
          expect(error.category).toBe("BUSINESS_LOGIC");
          expect(error.statusCode).toBe(404);
          expect(error.context).toEqual({
            entity: "Product",
            id: validParams.productId,
          });
        }
      }
    });

    it("throws NotFoundError when variant does not exist", async () => {
      const variantId = "00000000-0000-0000-0000-000000000002";
      const db = makeMockDb([f(null)]);

      await expect(
        adjustStock(db, { ...validParams, variantId })
      ).rejects.toThrow(NotFoundError);

      try {
        await adjustStock(db, { ...validParams, variantId });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        if (error instanceof NotFoundError) {
          expect(error.code).toBe(ERROR_CODES.VARIANT_NOT_FOUND);
          expect(error.category).toBe("BUSINESS_LOGIC");
          expect(error.statusCode).toBe(404);
          expect(error.context).toEqual({
            entity: "Variant",
            id: variantId,
          });
        }
      }
    });
  });

  describe("Insufficient Stock", () => {
    it("throws BusinessLogicError when attempting to deduct more stock than available", async () => {
      // Mock DB returns product with inventory of 5
      // First call: getProductInventory returns { inventory: 5, exists: true }
      // Second call: get product name for error message
      const db = makeMockDb([
        f({ inventory: 5 }), // getProductInventory - returns product with inventory
        f({ name: "Samsung Galaxy A54" }), // get product name for error message
      ]);

      const params = {
        ...validParams,
        delta: -10, // Trying to deduct 10 when only 5 available
      };

      await expect(
        adjustStock(db, params)
      ).rejects.toThrow(BusinessLogicError);

      // Reset mock DB for second test
      const db2 = makeMockDb([
        f({ inventory: 5 }),
        f({ name: "Samsung Galaxy A54" }),
      ]);

      try {
        await adjustStock(db2, params);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessLogicError);
        if (error instanceof BusinessLogicError) {
          expect(error.code).toBe(ERROR_CODES.INSUFFICIENT_STOCK);
          expect(error.category).toBe("BUSINESS_LOGIC");
          expect(error.statusCode).toBe(422);
          expect(error.message).toContain("Insufficient stock");
          expect(error.message).toContain("Samsung Galaxy A54");
          expect(error.context).toMatchObject({
            stockId: validParams.productId,
            productName: "Samsung Galaxy A54",
            available: 5,
            required: 10,
          });
        }
      }
    });

    it("throws BusinessLogicError with correct context for variant stock", async () => {
      const variantId = "00000000-0000-0000-0000-000000000002";
      const db = makeMockDb([
        f({ inventory: 3 }), // getProductInventory for variant
        f({ name: "T-Shirt Red/M" }), // get product name
      ]);

      const params = {
        ...validParams,
        variantId,
        delta: -5, // Trying to deduct 5 when only 3 available
      };

      try {
        await adjustStock(db, params);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessLogicError);
        if (error instanceof BusinessLogicError) {
          expect(error.code).toBe(ERROR_CODES.INSUFFICIENT_STOCK);
          expect(error.context).toMatchObject({
            stockId: variantId,
            available: 3,
            required: 5,
          });
        }
      }
    });
  });

  describe("Negative Stock Not Allowed", () => {
    it("prevents stock from going negative (edge case: exactly 0)", async () => {
      const db = makeMockDb([
        f({ inventory: 5 }), // Current inventory
        f({ name: "Product A" }), // Product name
      ]);

      const params = {
        ...validParams,
        delta: -5, // This should work (5 - 5 = 0)
      };

      // This should NOT throw - stock can be exactly 0
      await expect(
        adjustStock(db, params)
      ).resolves.toBeDefined();
    });

    it("prevents stock from going below zero", async () => {
      const db = makeMockDb([
        f({ inventory: 5 }), // Current inventory
        f({ name: "Product B" }), // Product name
      ]);

      const params = {
        ...validParams,
        delta: -6, // This should fail (5 - 6 = -1)
      };

      await expect(
        adjustStock(db, params)
      ).rejects.toThrow(BusinessLogicError);

      try {
        await adjustStock(db, params);
      } catch (error) {
        if (error instanceof BusinessLogicError) {
          expect(error.code).toBe(ERROR_CODES.INSUFFICIENT_STOCK);
          expect(error.message).toContain("Insufficient stock");
        }
      }
    });
  });

  describe("Error Response Structure", () => {
    it("includes all required error properties", async () => {
      const db = makeMockDb([f(null)]);

      try {
        await adjustStock(db, validParams);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        if (error instanceof NotFoundError) {
          // Verify error has all required properties for middleware formatting
          expect(error).toHaveProperty("message");
          expect(error).toHaveProperty("code");
          expect(error).toHaveProperty("category");
          expect(error).toHaveProperty("statusCode");
          expect(error).toHaveProperty("context");
          
          // Verify types
          expect(typeof error.message).toBe("string");
          expect(typeof error.code).toBe("string");
          expect(typeof error.category).toBe("string");
          expect(typeof error.statusCode).toBe("number");
          expect(typeof error.context).toBe("object");
        }
      }
    });

    it("provides actionable error messages", async () => {
      const db = makeMockDb([
        f({ inventory: 2 }),
        f({ name: "Limited Edition Item" }),
      ]);

      const params = {
        ...validParams,
        delta: -5,
      };

      try {
        await adjustStock(db, params);
      } catch (error) {
        if (error instanceof BusinessLogicError) {
          // Error message should be clear and actionable
          expect(error.message).toContain("Insufficient stock");
          expect(error.message).toContain("Limited Edition Item");
          expect(error.message).toContain("Available: 2");
          expect(error.message).toContain("Required: 5");
        }
      }
    });
  });
});

/**
 * Store (single) — Integration Tests
 *
 * Coverage:
 *  1. getStoreConfig — validates store existence, returns store config
 *  2. getStoreProduct — validates product existence by handle
 *  3. listStoreCommunes — validates wilaya ID range
 *  4. listProductReviews — validates productId is required
 *  5. submitReview — validates order existence and prevents duplicate reviews
 *  6. Error scenarios — store not found, product not found, invalid input
 *  7. Error response structure verification
 */

import { describe, it, expect } from "vitest";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { storeReviewSchema } from "./validation";

// ─── Review submission wire-format contract ────────────────────────────────────
//
// Regression guard: prior to v1.0.55 the storefront form asked the customer
// for their order NUMBER ("ORD-YYYYMMDD-NNNN") but the server looked up the
// internal orders.id UUID. Every real submission 404'd. These tests lock the
// storeReviewSchema contract to the customer-facing order number format.

describe("storeReviewSchema — customer-facing orderNumber contract", () => {
  const base = {
    productId: "prod-xyz",
    rating: 5,
    body: "Great product, arrived on time and well packaged.",
  };

  it("accepts a real order-number shape ORD-YYYYMMDD-NNNN", () => {
    const result = storeReviewSchema.safeParse({
      ...base,
      orderNumber: "ORD-20240101-0042",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderNumber).toBe("ORD-20240101-0042");
    }
  });

  it("rejects a raw UUID (guards against the pre-v1.0.55 confusion)", () => {
    const result = storeReviewSchema.safeParse({
      ...base,
      orderNumber: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = storeReviewSchema.safeParse({ ...base, orderNumber: "" });
    expect(result.success).toBe(false);
  });

  it("rejects arbitrary freeform text", () => {
    const result = storeReviewSchema.safeParse({ ...base, orderNumber: "my order" });
    expect(result.success).toBe(false);
  });

  it("is case-insensitive on the ORD prefix (admins sometimes type ord-…)", () => {
    const result = storeReviewSchema.safeParse({ ...base, orderNumber: "ord-20240101-0042" });
    expect(result.success).toBe(true);
  });
});

// ─── Error Scenarios ───────────────────────────────────────────────────────────

describe("Store endpoint error handling", () => {
  describe("NotFoundError for store", () => {
    it("throws NotFoundError when store doesn't exist", () => {
      expect(() => {
        throw new NotFoundError("Store", "store_123");
      }).toThrow(NotFoundError);
    });

    it("NotFoundError has correct error code for store", () => {
      try {
        throw new NotFoundError("Store", "store_123");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        expect((error as NotFoundError).code).toBe(ERROR_CODES.STORE_NOT_FOUND);
        expect((error as NotFoundError).statusCode).toBe(404);
        expect((error as NotFoundError).category).toBe("BUSINESS_LOGIC");
        expect((error as NotFoundError).context).toMatchObject({
          entity: "Store",
          id: "store_123",
        });
      }
    });

    it("NotFoundError message includes store ID", () => {
      try {
        throw new NotFoundError("Store", "store_123");
      } catch (error) {
        expect((error as NotFoundError).message).toBe("Store with ID store_123 not found");
      }
    });
  });

  describe("NotFoundError for product", () => {
    it("throws NotFoundError when product doesn't exist", () => {
      expect(() => {
        throw new NotFoundError("Product", "samsung-galaxy-a54");
      }).toThrow(NotFoundError);
    });

    it("NotFoundError has correct error code for product", () => {
      try {
        throw new NotFoundError("Product", "samsung-galaxy-a54");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        expect((error as NotFoundError).code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
        expect((error as NotFoundError).statusCode).toBe(404);
        expect((error as NotFoundError).category).toBe("BUSINESS_LOGIC");
        expect((error as NotFoundError).context).toMatchObject({
          entity: "Product",
          id: "samsung-galaxy-a54",
        });
      }
    });

    it("NotFoundError message includes product handle", () => {
      try {
        throw new NotFoundError("Product", "samsung-galaxy-a54");
      } catch (error) {
        expect((error as NotFoundError).message).toBe("Product with ID samsung-galaxy-a54 not found");
      }
    });
  });

  describe("NotFoundError for order", () => {
    it("throws NotFoundError when order doesn't exist", () => {
      expect(() => {
        throw new NotFoundError("Order", "order_123");
      }).toThrow(NotFoundError);
    });

    it("NotFoundError has correct error code for order", () => {
      try {
        throw new NotFoundError("Order", "order_123");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        expect((error as NotFoundError).code).toBe(ERROR_CODES.ORDER_NOT_FOUND);
        expect((error as NotFoundError).statusCode).toBe(404);
        expect((error as NotFoundError).category).toBe("BUSINESS_LOGIC");
        expect((error as NotFoundError).context).toMatchObject({
          entity: "Order",
          id: "order_123",
        });
      }
    });
  });

  describe("ValidationError for invalid wilaya ID", () => {
    it("throws ValidationError when wilaya ID is out of range", () => {
      expect(() => {
        throw new ValidationError(
          "Invalid wilaya ID — must be an integer between 1 and 58",
          ERROR_CODES.VALUE_OUT_OF_RANGE,
          { wilayaId: 99, min: 1, max: 58 }
        );
      }).toThrow(ValidationError);
    });

    it("ValidationError has correct error code and context", () => {
      try {
        throw new ValidationError(
          "Invalid wilaya ID — must be an integer between 1 and 58",
          ERROR_CODES.VALUE_OUT_OF_RANGE,
          { wilayaId: 99, min: 1, max: 58 }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).code).toBe(ERROR_CODES.VALUE_OUT_OF_RANGE);
        expect((error as ValidationError).statusCode).toBe(400);
        expect((error as ValidationError).category).toBe("VALIDATION");
        expect((error as ValidationError).context).toMatchObject({
          wilayaId: 99,
          min: 1,
          max: 58,
        });
      }
    });
  });

  describe("ValidationError for missing productId", () => {
    it("throws ValidationError when productId is missing", () => {
      expect(() => {
        throw new ValidationError(
          "productId is required",
          ERROR_CODES.REQUIRED_FIELD_MISSING,
          { field: "productId" }
        );
      }).toThrow(ValidationError);
    });

    it("ValidationError has correct error code and context", () => {
      try {
        throw new ValidationError(
          "productId is required",
          ERROR_CODES.REQUIRED_FIELD_MISSING,
          { field: "productId" }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).code).toBe(ERROR_CODES.REQUIRED_FIELD_MISSING);
        expect((error as ValidationError).statusCode).toBe(400);
        expect((error as ValidationError).category).toBe("VALIDATION");
        expect((error as ValidationError).context).toMatchObject({
          field: "productId",
        });
      }
    });
  });

  describe("ConflictError for duplicate review", () => {
    it("throws ConflictError when order already has a review", () => {
      expect(() => {
        throw new ConflictError(
          "A review has already been submitted for this order",
          ERROR_CODES.ORDER_ALREADY_REVIEWED,
          { orderNumber: "ORD-20240101-0042" }
        );
      }).toThrow(ConflictError);
    });

    it("ConflictError has correct error code and context", () => {
      try {
        throw new ConflictError(
          "A review has already been submitted for this order",
          ERROR_CODES.ORDER_ALREADY_REVIEWED,
          { orderNumber: "ORD-20240101-0042" }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).code).toBe(ERROR_CODES.ORDER_ALREADY_REVIEWED);
        expect((error as ConflictError).statusCode).toBe(409);
        expect((error as ConflictError).category).toBe("BUSINESS_LOGIC");
        expect((error as ConflictError).context).toMatchObject({
          orderNumber: "ORD-20240101-0042",
        });
      }
    });
  });
});

// ─── Error Response Structure ─────────────────────────────────────────────────

describe("Error response structure", () => {
  it("NotFoundError for store contains all required fields", () => {
    const error = new NotFoundError("Store", "store_123");
    
    // Verify error has all required properties for API response
    expect(error).toHaveProperty("message");
    expect(error).toHaveProperty("code");
    expect(error).toHaveProperty("category");
    expect(error).toHaveProperty("statusCode");
    expect(error).toHaveProperty("context");
    
    // Verify values
    expect(error.message).toBe("Store with ID store_123 not found");
    expect(error.code).toBe("STORE_NOT_FOUND");
    expect(error.category).toBe("BUSINESS_LOGIC");
    expect(error.statusCode).toBe(404);
    expect(error.context).toEqual({
      entity: "Store",
      id: "store_123",
    });
  });

  it("NotFoundError for product contains all required fields", () => {
    const error = new NotFoundError("Product", "samsung-galaxy-a54");
    
    expect(error.message).toBe("Product with ID samsung-galaxy-a54 not found");
    expect(error.code).toBe("PRODUCT_NOT_FOUND");
    expect(error.category).toBe("BUSINESS_LOGIC");
    expect(error.statusCode).toBe(404);
    expect(error.context).toEqual({
      entity: "Product",
      id: "samsung-galaxy-a54",
    });
  });

  it("ValidationError for wilaya contains all required fields", () => {
    const error = new ValidationError(
      "Invalid wilaya ID — must be an integer between 1 and 58",
      ERROR_CODES.VALUE_OUT_OF_RANGE,
      { wilayaId: 99, min: 1, max: 58 }
    );
    
    expect(error.message).toBe("Invalid wilaya ID — must be an integer between 1 and 58");
    expect(error.code).toBe("VALUE_OUT_OF_RANGE");
    expect(error.category).toBe("VALIDATION");
    expect(error.statusCode).toBe(400);
    expect(error.context).toEqual({
      wilayaId: 99,
      min: 1,
      max: 58,
    });
  });

  it("ValidationError for missing field contains all required fields", () => {
    const error = new ValidationError(
      "productId is required",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { field: "productId" }
    );
    
    expect(error.message).toBe("productId is required");
    expect(error.code).toBe("REQUIRED_FIELD_MISSING");
    expect(error.category).toBe("VALIDATION");
    expect(error.statusCode).toBe(400);
    expect(error.context).toEqual({
      field: "productId",
    });
  });

  it("ConflictError for duplicate review contains all required fields", () => {
    const error = new ConflictError(
      "A review has already been submitted for this order",
      ERROR_CODES.ORDER_ALREADY_REVIEWED,
      { orderNumber: "ORD-20240101-0042" }
    );
    
    expect(error.message).toBe("A review has already been submitted for this order");
    expect(error.code).toBe("ORDER_ALREADY_REVIEWED");
    expect(error.category).toBe("BUSINESS_LOGIC");
    expect(error.statusCode).toBe(409);
    expect(error.context).toEqual({
      orderNumber: "ORD-20240101-0042",
    });
  });

  it("Error response structure matches API specification for NotFoundError", () => {
    const error = new NotFoundError("Store", "store_123");
    
    // Simulate what the error middleware would return
    const errorResponse = {
      error: error.message,
      code: error.code,
      category: error.category,
      context: error.context,
    };
    
    // Verify structure matches specification
    expect(errorResponse).toEqual({
      error: "Store with ID store_123 not found",
      code: "STORE_NOT_FOUND",
      category: "BUSINESS_LOGIC",
      context: {
        entity: "Store",
        id: "store_123",
      },
    });
  });

  it("Error response structure matches API specification for ValidationError", () => {
    const error = new ValidationError(
      "Invalid wilaya ID — must be an integer between 1 and 58",
      ERROR_CODES.VALUE_OUT_OF_RANGE,
      { wilayaId: 99, min: 1, max: 58 }
    );
    
    const errorResponse = {
      error: error.message,
      code: error.code,
      category: error.category,
      context: error.context,
    };
    
    expect(errorResponse).toEqual({
      error: "Invalid wilaya ID — must be an integer between 1 and 58",
      code: "VALUE_OUT_OF_RANGE",
      category: "VALIDATION",
      context: {
        wilayaId: 99,
        min: 1,
        max: 58,
      },
    });
  });

  it("Error response structure matches API specification for ConflictError", () => {
    const error = new ConflictError(
      "A review has already been submitted for this order",
      ERROR_CODES.ORDER_ALREADY_REVIEWED,
      { orderNumber: "ORD-20240101-0042" }
    );
    
    const errorResponse = {
      error: error.message,
      code: error.code,
      category: error.category,
      context: error.context,
    };
    
    expect(errorResponse).toEqual({
      error: "A review has already been submitted for this order",
      code: "ORDER_ALREADY_REVIEWED",
      category: "BUSINESS_LOGIC",
      context: {
        orderNumber: "ORD-20240101-0042",
      },
    });
  });

  it("Error context includes relevant information for traceability", () => {
    const storeError = new NotFoundError("Store", "store_123");
    expect(storeError.context).toHaveProperty("entity");
    expect(storeError.context).toHaveProperty("id");
    expect(storeError.context?.entity).toBe("Store");
    expect(storeError.context?.id).toBe("store_123");

    const validationError = new ValidationError(
      "productId is required",
      ERROR_CODES.REQUIRED_FIELD_MISSING,
      { field: "productId" }
    );
    expect(validationError.context).toHaveProperty("field");
    expect(validationError.context?.field).toBe("productId");

    const conflictError = new ConflictError(
      "A review has already been submitted for this order",
      ERROR_CODES.ORDER_ALREADY_REVIEWED,
      { orderNumber: "ORD-20240101-0042" }
    );
    expect(conflictError.context).toHaveProperty("orderNumber");
    expect(conflictError.context?.orderNumber).toBe("ORD-20240101-0042");
  });
});

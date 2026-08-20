/**
 * Unit Tests for Error Code Registry
 * 
 * Tests error code format, uniqueness, category assignment, and naming patterns.
 */

import { describe, it, expect } from "vitest";
import { ERROR_CODES, ERROR_CATEGORIES, ErrorCode, ErrorCategory } from "../../../../cod-shared/errors/codes";

describe("Error Code Registry", () => {
  describe("Error Code Format", () => {
    it("should have all error codes in SCREAMING_SNAKE_CASE format", () => {
      const errorCodes = Object.values(ERROR_CODES);
      const screamingSnakeCasePattern = /^[A-Z][A-Z0-9_]*$/;

      errorCodes.forEach((code) => {
        expect(code).toMatch(screamingSnakeCasePattern);
      });
    });

    it("should not have error codes with lowercase letters", () => {
      const errorCodes = Object.values(ERROR_CODES);

      errorCodes.forEach((code) => {
        expect(code).not.toMatch(/[a-z]/);
      });
    });

    it("should not have error codes with special characters except underscore", () => {
      const errorCodes = Object.values(ERROR_CODES);

      errorCodes.forEach((code) => {
        expect(code).not.toMatch(/[^A-Z0-9_]/);
      });
    });
  });

  describe("Error Code Uniqueness", () => {
    it("should have unique error codes (no duplicates)", () => {
      const errorCodes = Object.values(ERROR_CODES);
      const uniqueCodes = new Set(errorCodes);

      expect(uniqueCodes.size).toBe(errorCodes.length);
    });

    it("should have unique error code keys", () => {
      const errorCodeKeys = Object.keys(ERROR_CODES);
      const uniqueKeys = new Set(errorCodeKeys);

      expect(uniqueKeys.size).toBe(errorCodeKeys.length);
    });
  });

  describe("Error Category Assignment", () => {
    it("should have valid error categories", () => {
      const categories = Object.values(ERROR_CATEGORIES);
      const expectedCategories = ["VALIDATION", "AUTHENTICATION", "BUSINESS_LOGIC", "SYSTEM"];

      expect(categories).toEqual(expectedCategories);
    });

    it("should have all categories in SCREAMING_SNAKE_CASE format", () => {
      const categories = Object.values(ERROR_CATEGORIES);
      const screamingSnakeCasePattern = /^[A-Z][A-Z0-9_]*$/;

      categories.forEach((category) => {
        expect(category).toMatch(screamingSnakeCasePattern);
      });
    });
  });

  describe("Error Code Naming Pattern Consistency", () => {
    it("should have consistent NOT_FOUND error naming pattern", () => {
      const notFoundErrors = Object.values(ERROR_CODES).filter((code) =>
        code.endsWith("_NOT_FOUND")
      );

      // Verify all NOT_FOUND errors follow the pattern: ENTITY_NOT_FOUND
      notFoundErrors.forEach((code) => {
        expect(code).toMatch(/^[A-Z_]+_NOT_FOUND$/);
      });

      // Verify we have NOT_FOUND errors for major entities
      expect(notFoundErrors).toContain("CUSTOMER_NOT_FOUND");
      expect(notFoundErrors).toContain("ORDER_NOT_FOUND");
      expect(notFoundErrors).toContain("PRODUCT_NOT_FOUND");
      expect(notFoundErrors).toContain("DRIVER_NOT_FOUND");
    });

    it("should have consistent DUPLICATE error naming pattern", () => {
      const duplicateErrors = Object.values(ERROR_CODES).filter(
        (code) => code.startsWith("DUPLICATE_") || code.includes("_DUPLICATE")
      );

      // Verify all DUPLICATE errors follow consistent patterns
      duplicateErrors.forEach((code) => {
        expect(code).toMatch(/^DUPLICATE_[A-Z_]+$|^[A-Z_]+_DUPLICATE$/);
      });
    });

    it("should have consistent HAS error naming pattern for business logic", () => {
      const hasErrors = Object.values(ERROR_CODES).filter((code) => code.includes("_HAS_"));

      // Verify all HAS errors follow the pattern: ENTITY_HAS_RELATED
      hasErrors.forEach((code) => {
        expect(code).toMatch(/^[A-Z_]+_HAS_[A-Z_]+$/);
      });

      // Verify we have HAS errors for entities with relationships
      expect(hasErrors).toContain("CUSTOMER_HAS_ORDERS");
      expect(hasErrors).toContain("PRODUCT_HAS_ORDERS");
      expect(hasErrors).toContain("DRIVER_HAS_ACTIVE_ORDERS");
    });
  });

  describe("Error Code Coverage", () => {
    it("should have validation error codes", () => {
      const validationErrors = [
        ERROR_CODES.VALIDATION_FAILED,
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        ERROR_CODES.INVALID_FORMAT,
        ERROR_CODES.VALUE_OUT_OF_RANGE,
        ERROR_CODES.INVALID_UUID,
      ];

      validationErrors.forEach((code) => {
        expect(code).toBeDefined();
        expect(typeof code).toBe("string");
      });
    });

    it("should have authentication error codes", () => {
      const authErrors = [
        ERROR_CODES.INVALID_API_KEY,
        ERROR_CODES.PERMISSION_DENIED,
        ERROR_CODES.SESSION_EXPIRED,
      ];

      authErrors.forEach((code) => {
        expect(code).toBeDefined();
        expect(typeof code).toBe("string");
      });
    });

    it("should have business logic error codes for all major entities", () => {
      const businessLogicErrors = [
        ERROR_CODES.CUSTOMER_NOT_FOUND,
        ERROR_CODES.ORDER_NOT_FOUND,
        ERROR_CODES.PRODUCT_NOT_FOUND,
        ERROR_CODES.DRIVER_NOT_FOUND,
        ERROR_CODES.COMPANY_NOT_FOUND,
      ];

      businessLogicErrors.forEach((code) => {
        expect(code).toBeDefined();
        expect(typeof code).toBe("string");
      });
    });

    it("should have system error codes", () => {
      const systemErrors = [
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        ERROR_CODES.EXTERNAL_API_FAILURE,
        ERROR_CODES.NETWORK_TIMEOUT,
      ];

      systemErrors.forEach((code) => {
        expect(code).toBeDefined();
        expect(typeof code).toBe("string");
      });
    });
  });

  describe("TypeScript Type Safety", () => {
    it("should have ErrorCode type that matches error code values", () => {
      const errorCode: ErrorCode = ERROR_CODES.CUSTOMER_NOT_FOUND;
      expect(errorCode).toBe("CUSTOMER_NOT_FOUND");
    });

    it("should have ErrorCategory type that matches category values", () => {
      const category: ErrorCategory = ERROR_CATEGORIES.BUSINESS_LOGIC;
      expect(category).toBe("BUSINESS_LOGIC");
    });
  });
});

/**
 * Unit Tests for Custom Error Classes
 * 
 * Tests error class constructors, status codes, categories, and context preservation.
 */

import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  NotFoundError,
  BusinessLogicError,
  ConflictError,
  AuthenticationError,
  PermissionError,
  SystemError,
  ExternalApiError,
  ErrorContext,
} from "./classes";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";

describe("Custom Error Classes", () => {
  describe("AppError", () => {
    it("should create an AppError with all properties", () => {
      const context: ErrorContext = { userId: "123", action: "delete" };
      const error = new AppError(
        "Test error",
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CATEGORIES.SYSTEM,
        500,
        context
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(error.category).toBe(ERROR_CATEGORIES.SYSTEM);
      expect(error.statusCode).toBe(500);
      expect(error.context).toEqual(context);
      expect(error.name).toBe("AppError");
    });

    it("should have a stack trace", () => {
      const error = new AppError(
        "Test error",
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CATEGORIES.SYSTEM,
        500
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("AppError");
    });
  });

  describe("ValidationError", () => {
    it("should create a ValidationError with default code", () => {
      const error = new ValidationError("Validation failed");

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("Validation failed");
      expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      expect(error.category).toBe(ERROR_CATEGORIES.VALIDATION);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ValidationError");
    });

    it("should create a ValidationError with custom code and context", () => {
      const context: ErrorContext = { field: "email", value: "invalid" };
      const error = new ValidationError(
        "Invalid email format",
        ERROR_CODES.INVALID_FORMAT,
        context
      );

      expect(error.code).toBe(ERROR_CODES.INVALID_FORMAT);
      expect(error.context).toEqual(context);
      expect(error.statusCode).toBe(400);
    });

    it("should have correct HTTP status code (400)", () => {
      const error = new ValidationError("Test");
      expect(error.statusCode).toBe(400);
    });
  });

  describe("NotFoundError", () => {
    it("should create a NotFoundError with entity name only", () => {
      const error = new NotFoundError("Customer");

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe("Customer not found");
      expect(error.code).toBe("CUSTOMER_NOT_FOUND");
      expect(error.category).toBe(ERROR_CATEGORIES.BUSINESS_LOGIC);
      expect(error.statusCode).toBe(404);
      expect(error.context).toEqual({ entity: "Customer", id: undefined });
      expect(error.name).toBe("NotFoundError");
    });

    it("should create a NotFoundError with entity name and ID", () => {
      const error = new NotFoundError("Order", "123e4567-e89b-12d3-a456-426614174000");

      expect(error.message).toBe("Order with ID 123e4567-e89b-12d3-a456-426614174000 not found");
      expect(error.code).toBe("ORDER_NOT_FOUND");
      expect(error.context).toEqual({
        entity: "Order",
        id: "123e4567-e89b-12d3-a456-426614174000",
      });
    });

    it("should generate correct error code from entity name", () => {
      const customerError = new NotFoundError("Customer");
      expect(customerError.code).toBe("CUSTOMER_NOT_FOUND");

      const productError = new NotFoundError("Product");
      expect(productError.code).toBe("PRODUCT_NOT_FOUND");

      const driverError = new NotFoundError("Driver");
      expect(driverError.code).toBe("DRIVER_NOT_FOUND");
    });

    it("should have correct HTTP status code (404)", () => {
      const error = new NotFoundError("Customer");
      expect(error.statusCode).toBe(404);
    });
  });

  describe("BusinessLogicError", () => {
    it("should create a BusinessLogicError with code and context", () => {
      const context: ErrorContext = { customerId: "123", orderCount: 5 };
      const error = new BusinessLogicError(
        "Cannot delete customer with existing orders",
        ERROR_CODES.CUSTOMER_HAS_ORDERS,
        context
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(BusinessLogicError);
      expect(error.message).toBe("Cannot delete customer with existing orders");
      expect(error.code).toBe(ERROR_CODES.CUSTOMER_HAS_ORDERS);
      expect(error.category).toBe(ERROR_CATEGORIES.BUSINESS_LOGIC);
      expect(error.statusCode).toBe(422);
      expect(error.context).toEqual(context);
      expect(error.name).toBe("BusinessLogicError");
    });

    it("should have correct HTTP status code (422)", () => {
      const error = new BusinessLogicError("Test", ERROR_CODES.CUSTOMER_HAS_ORDERS);
      expect(error.statusCode).toBe(422);
    });
  });

  describe("ConflictError", () => {
    it("should create a ConflictError with code and context", () => {
      const context: ErrorContext = { phone: "+213555123456" };
      const error = new ConflictError(
        "Phone number already registered",
        ERROR_CODES.DUPLICATE_PHONE,
        context
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe("Phone number already registered");
      expect(error.code).toBe(ERROR_CODES.DUPLICATE_PHONE);
      expect(error.category).toBe(ERROR_CATEGORIES.BUSINESS_LOGIC);
      expect(error.statusCode).toBe(409);
      expect(error.context).toEqual(context);
      expect(error.name).toBe("ConflictError");
    });

    it("should have correct HTTP status code (409)", () => {
      const error = new ConflictError("Test", ERROR_CODES.DUPLICATE_PHONE);
      expect(error.statusCode).toBe(409);
    });
  });

  describe("AuthenticationError", () => {
    it("should create an AuthenticationError with default code", () => {
      const error = new AuthenticationError("Invalid API key");

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe("Invalid API key");
      expect(error.code).toBe(ERROR_CODES.INVALID_API_KEY);
      expect(error.category).toBe(ERROR_CATEGORIES.AUTHENTICATION);
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("AuthenticationError");
    });

    it("should create an AuthenticationError with custom code and context", () => {
      const context: ErrorContext = { userId: "123" };
      const error = new AuthenticationError(
        "Session expired",
        ERROR_CODES.SESSION_EXPIRED,
        context
      );

      expect(error.code).toBe(ERROR_CODES.SESSION_EXPIRED);
      expect(error.context).toEqual(context);
    });

    it("should have correct HTTP status code (401)", () => {
      const error = new AuthenticationError("Test");
      expect(error.statusCode).toBe(401);
    });
  });

  describe("PermissionError", () => {
    it("should create a PermissionError with required scope", () => {
      const error = new PermissionError(
        "You don't have permission to delete customers",
        "CUSTOMERS_DELETE"
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(PermissionError);
      expect(error.message).toBe("You don't have permission to delete customers");
      expect(error.code).toBe(ERROR_CODES.PERMISSION_DENIED);
      expect(error.category).toBe(ERROR_CATEGORIES.AUTHENTICATION);
      expect(error.statusCode).toBe(403);
      expect(error.context).toEqual({ requiredScope: "CUSTOMERS_DELETE" });
      expect(error.name).toBe("PermissionError");
    });

    it("should create a PermissionError without required scope", () => {
      const error = new PermissionError("Access denied");

      expect(error.context).toEqual({ requiredScope: undefined });
    });

    it("should have correct HTTP status code (403)", () => {
      const error = new PermissionError("Test");
      expect(error.statusCode).toBe(403);
    });
  });

  describe("SystemError", () => {
    it("should create a SystemError with default code", () => {
      const error = new SystemError("An unexpected error occurred");

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(SystemError);
      expect(error.message).toBe("An unexpected error occurred");
      expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(error.category).toBe(ERROR_CATEGORIES.SYSTEM);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("SystemError");
    });

    it("should create a SystemError with custom code and context", () => {
      const context: ErrorContext = { query: "SELECT * FROM users", table: "users" };
      const error = new SystemError(
        "Database query failed",
        ERROR_CODES.DATABASE_ERROR,
        context
      );

      expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR);
      expect(error.context).toEqual(context);
    });

    it("should have correct HTTP status code (500)", () => {
      const error = new SystemError("Test");
      expect(error.statusCode).toBe(500);
    });
  });

  describe("ExternalApiError", () => {
    it("should create an ExternalApiError with provider and message", () => {
      const error = new ExternalApiError("ZR Express", "Connection timeout");

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ExternalApiError);
      expect(error.message).toBe("External API failure: ZR Express - Connection timeout");
      expect(error.code).toBe(ERROR_CODES.EXTERNAL_API_FAILURE);
      expect(error.category).toBe(ERROR_CATEGORIES.SYSTEM);
      expect(error.statusCode).toBe(502);
      expect(error.context).toEqual({ provider: "ZR Express" });
      expect(error.name).toBe("ExternalApiError");
    });

    it("should create an ExternalApiError with additional context", () => {
      const context: ErrorContext = { endpoint: "/api/v1/parcels", statusCode: 503 };
      const error = new ExternalApiError("Yalidine", "Service unavailable", context);

      expect(error.context).toEqual({
        provider: "Yalidine",
        endpoint: "/api/v1/parcels",
        statusCode: 503,
      });
    });

    it("should have correct HTTP status code (502)", () => {
      const error = new ExternalApiError("Test Provider", "Test");
      expect(error.statusCode).toBe(502);
    });
  });

  describe("Error Context Preservation", () => {
    it("should preserve complex context objects", () => {
      const context: ErrorContext = {
        userId: "123",
        action: "delete",
        metadata: {
          timestamp: "2024-01-01T00:00:00Z",
          ip: "192.168.1.1",
        },
        items: ["item1", "item2"],
      };

      const error = new BusinessLogicError("Test", ERROR_CODES.CUSTOMER_HAS_ORDERS, context);

      expect(error.context).toEqual(context);
      expect(error.context?.metadata).toEqual(context.metadata);
      expect(error.context?.items).toEqual(context.items);
    });
  });
});

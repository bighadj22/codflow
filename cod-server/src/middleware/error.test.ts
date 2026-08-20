/**
 * Unit Tests for Error Middleware
 * 
 * Tests error handling for ZodError, custom AppError instances, and unknown errors.
 */

import { describe, it, expect, vi } from "vitest";
import { Context } from "hono";
import { ZodError, z } from "zod";
import { errorHandler, ErrorResponse } from "./error";
import {
  AppError,
  ValidationError,
  NotFoundError,
  BusinessLogicError,
  SystemError,
} from "@/lib/errors/classes";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../cod-shared/errors/codes";

// Mock Context for testing
function createMockContext(): Context {
  const mockContext = {
    req: {
      path: "/api/test",
      method: "GET",
    },
    get: vi.fn(() => ({ id: "user-123" })),
    json: vi.fn((data, status) => {
      return {
        status,
        data,
      } as any;
    }),
  } as any;

  return mockContext;
}

describe("Error Middleware", () => {
  describe("ZodError Handling", () => {
    it("should transform ZodError into structured validation error response", () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(18),
      });

      try {
        schema.parse({ name: "", email: "invalid", age: 15 });
      } catch (err) {
        const context = createMockContext();
        const response = errorHandler(err as Error, context);

        expect(context.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: "Validation failed",
            code: ERROR_CODES.VALIDATION_FAILED,
            category: ERROR_CATEGORIES.VALIDATION,
            context: expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({
                  path: expect.any(String),
                  message: expect.any(String),
                  code: expect.any(String),
                }),
              ]),
            }),
          }),
          400
        );
      }
    });

    it("should include field paths and messages in validation error context", () => {
      const schema = z.object({
        products: z.array(
          z.object({
            name: z.string().min(1),
            quantity: z.number().positive(),
          })
        ),
      });

      try {
        schema.parse({ products: [{ name: "", quantity: -1 }] });
      } catch (err) {
        const context = createMockContext();
        errorHandler(err as Error, context);

        const callArgs = (context.json as any).mock.calls[0][0];
        expect(callArgs.context.fields).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: "products.0.name",
            }),
            expect.objectContaining({
              path: "products.0.quantity",
            }),
          ])
        );
      }
    });

    it("should return HTTP 400 for ZodError", () => {
      const schema = z.object({ name: z.string() });

      try {
        schema.parse({ name: 123 });
      } catch (err) {
        const context = createMockContext();
        errorHandler(err as Error, context);

        expect(context.json).toHaveBeenCalledWith(expect.any(Object), 400);
      }
    });
  });

  describe("Custom AppError Handling", () => {
    it("should handle ValidationError correctly", () => {
      const error = new ValidationError("Invalid email format", ERROR_CODES.INVALID_FORMAT, {
        field: "email",
        value: "invalid",
      });

      const context = createMockContext();
      const response = errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(
        {
          error: "Invalid email format",
          code: ERROR_CODES.INVALID_FORMAT,
          category: ERROR_CATEGORIES.VALIDATION,
          context: { field: "email", value: "invalid" },
        },
        400
      );
    });

    it("should handle NotFoundError correctly", () => {
      const error = new NotFoundError("Customer", "123e4567-e89b-12d3-a456-426614174000");

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Customer with ID 123e4567-e89b-12d3-a456-426614174000 not found",
          code: "CUSTOMER_NOT_FOUND",
          category: ERROR_CATEGORIES.BUSINESS_LOGIC,
          context: expect.objectContaining({
            entity: "Customer",
            id: "123e4567-e89b-12d3-a456-426614174000",
          }),
        }),
        404
      );
    });

    it("should handle BusinessLogicError correctly", () => {
      const error = new BusinessLogicError(
        "Cannot delete customer with existing orders",
        ERROR_CODES.CUSTOMER_HAS_ORDERS,
        { customerId: "123", orderCount: 5 }
      );

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(
        {
          error: "Cannot delete customer with existing orders",
          code: ERROR_CODES.CUSTOMER_HAS_ORDERS,
          category: ERROR_CATEGORIES.BUSINESS_LOGIC,
          context: { customerId: "123", orderCount: 5 },
        },
        422
      );
    });

    it("should handle SystemError correctly", () => {
      const error = new SystemError("Database connection failed", ERROR_CODES.DATABASE_ERROR, {
        database: "codflow-db",
      });

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(
        {
          error: "Database connection failed",
          code: ERROR_CODES.DATABASE_ERROR,
          category: ERROR_CATEGORIES.SYSTEM,
          context: { database: "codflow-db" },
        },
        500
      );
    });

    it("should preserve error context in response", () => {
      const context = {
        orderId: "order-123",
        trackingNumber: "TRK-456",
        provider: "ZR Express",
      };

      const error = new BusinessLogicError(
        "Order already dispatched",
        ERROR_CODES.ORDER_ALREADY_DISPATCHED,
        context
      );

      const mockContext = createMockContext();
      errorHandler(error, mockContext);

      const callArgs = (mockContext.json as any).mock.calls[0][0];
      expect(callArgs.context).toEqual(context);
    });
  });

  describe("Unknown Error Handling", () => {
    it("should handle unknown errors with generic message", () => {
      const error = new Error("Some unexpected error");

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          category: ERROR_CATEGORIES.SYSTEM,
        }),
        500
      );
    });

    it("should sanitize error messages with sensitive information", () => {
      const error = new Error("API key abc123 is invalid");

      const context = createMockContext();
      errorHandler(error, context);

      const callArgs = (context.json as any).mock.calls[0][0];
      expect(callArgs.error).not.toContain("abc123");
      expect(callArgs.error).toBe("An unexpected error occurred");
    });

    it("should sanitize error messages with file paths", () => {
      const error = new Error("Error in /home/user/project/src/handlers.ts at line 42");

      const context = createMockContext();
      errorHandler(error, context);

      const callArgs = (context.json as any).mock.calls[0][0];
      expect(callArgs.error).not.toContain("/home/user/project");
    });

    it("should sanitize error messages with stack traces", () => {
      const error = new Error("Error at Object.<anonymous> (/path/to/file.ts:10:5)");

      const context = createMockContext();
      errorHandler(error, context);

      const callArgs = (context.json as any).mock.calls[0][0];
      expect(callArgs.error).not.toContain("at Object.<anonymous>");
    });

    it("should return HTTP 500 for unknown errors", () => {
      const error = new Error("Unknown error");

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(expect.any(Object), 500);
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields", () => {
      const error = new NotFoundError("Customer");

      const context = createMockContext();
      errorHandler(error, context);

      const callArgs = (context.json as any).mock.calls[0][0];
      expect(callArgs).toHaveProperty("error");
      expect(callArgs).toHaveProperty("code");
      expect(callArgs).toHaveProperty("category");
    });

    it("should include context field when available", () => {
      const error = new BusinessLogicError(
        "Test error",
        ERROR_CODES.CUSTOMER_HAS_ORDERS,
        { customerId: "123" }
      );

      const context = createMockContext();
      errorHandler(error, context);

      const callArgs = (context.json as any).mock.calls[0][0];
      expect(callArgs).toHaveProperty("context");
      expect(callArgs.context).toEqual({ customerId: "123" });
    });

    it("should not include context field when not available", () => {
      const error = new Error("Generic error");

      const context = createMockContext();
      errorHandler(error, context);

      const callArgs = (context.json as any).mock.calls[0][0];
      expect(callArgs.context).toBeUndefined();
    });
  });

  describe("HTTP Status Code Mapping", () => {
    it("should return 400 for validation errors", () => {
      const error = new ValidationError("Validation failed");

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(expect.any(Object), 400);
    });

    it("should return 404 for not found errors", () => {
      const error = new NotFoundError("Customer");

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(expect.any(Object), 404);
    });

    it("should return 422 for business logic errors", () => {
      const error = new BusinessLogicError("Test", ERROR_CODES.CUSTOMER_HAS_ORDERS);

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(expect.any(Object), 422);
    });

    it("should return 500 for system errors", () => {
      const error = new SystemError("System failure");

      const context = createMockContext();
      errorHandler(error, context);

      expect(context.json).toHaveBeenCalledWith(expect.any(Object), 500);
    });
  });

  describe("Server-Side Logging", () => {
    it("should log error details to console", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new NotFoundError("Customer", "123");
      const context = createMockContext();
      errorHandler(error, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[Error Handler]",
        expect.objectContaining({
          requestId: expect.any(String),
          name: "NotFoundError",
          message: "Customer with ID 123 not found",
          stack: expect.any(String),
          path: "/api/test",
          method: "GET",
          timestamp: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });

    it("should include request ID in logs", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new Error("Test error");
      const context = createMockContext();
      errorHandler(error, context);

      const logCall = consoleSpy.mock.calls[0][1];
      expect(logCall).toHaveProperty("requestId");
      expect(typeof logCall.requestId).toBe("string");

      consoleSpy.mockRestore();
    });
  });
});

/**
 * Unit Tests for Error Mapper Utility
 */

import { describe, it, expect } from "vitest";
import {
  mapError,
  formatValidationErrors,
  isRecoverableError,
  isBlockingError,
  type Locale,
} from "./mapper";
import { ERROR_CODES } from "cod-shared/errors/codes";

describe("mapError", () => {
  describe("Known error codes", () => {
    it("should map known error code to English message", () => {
      const message = mapError(ERROR_CODES.CUSTOMER_NOT_FOUND, "en");
      expect(message).toBe("Customer not found");
    });

    it("should map known error code to Arabic message", () => {
      const message = mapError(ERROR_CODES.CUSTOMER_NOT_FOUND, "ar");
      expect(message).toBe("العميل غير موجود");
    });

    it("should map validation error to English message", () => {
      const message = mapError(ERROR_CODES.VALIDATION_FAILED, "en");
      expect(message).toBe("Please check your input and try again");
    });

    it("should map validation error to Arabic message", () => {
      const message = mapError(ERROR_CODES.VALIDATION_FAILED, "ar");
      expect(message).toBe("يرجى التحقق من المدخلات والمحاولة مرة أخرى");
    });

    it("should map system error to English message", () => {
      const message = mapError(ERROR_CODES.INTERNAL_SERVER_ERROR, "en");
      expect(message).toBe("An unexpected error occurred. Please try again later.");
    });

    it("should map system error to Arabic message", () => {
      const message = mapError(ERROR_CODES.INTERNAL_SERVER_ERROR, "ar");
      expect(message).toBe("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً.");
    });
  });

  describe("Unknown error codes", () => {
    it("should return fallback message for unknown error code in English", () => {
      const message = mapError("UNKNOWN_ERROR_CODE", "en");
      expect(message).toBe("An error occurred. Please try again.");
    });

    it("should return fallback message for unknown error code in Arabic", () => {
      const message = mapError("UNKNOWN_ERROR_CODE", "ar");
      expect(message).toBe("حدث خطأ. يرجى المحاولة مرة أخرى.");
    });

    it("should return fallback message for empty error code", () => {
      const message = mapError("", "en");
      expect(message).toBe("An error occurred. Please try again.");
    });
  });

  describe("Context interpolation", () => {
    it("should replace single placeholder with context value", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { fieldName: "Email" }
      );
      expect(message).toBe("Email is required");
    });

    it("should replace multiple placeholders with context values", () => {
      const message = mapError(
        ERROR_CODES.INSUFFICIENT_STOCK,
        "en",
        { productName: "Widget", available: "5", required: "10" }
      );
      expect(message).toBe("Insufficient stock for Widget. Available: 5, Required: 10");
    });

    it("should replace placeholders in Arabic messages", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "ar",
        { fieldName: "البريد الإلكتروني" }
      );
      expect(message).toBe("البريد الإلكتروني مطلوب");
    });

    it("should replace same placeholder multiple times if it appears multiple times", () => {
      const message = mapError(
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        "en",
        { currentStatus: "pending", targetStatus: "delivered" }
      );
      expect(message).toContain("pending");
      expect(message).toContain("delivered");
    });

    it("should convert non-string context values to strings", () => {
      const message = mapError(
        ERROR_CODES.INSUFFICIENT_STOCK,
        "en",
        { productName: "Widget", available: 5, required: 10 }
      );
      expect(message).toBe("Insufficient stock for Widget. Available: 5, Required: 10");
    });
  });

  describe("Missing context handling", () => {
    it("should leave placeholder unchanged when context is missing", () => {
      const message = mapError(ERROR_CODES.REQUIRED_FIELD_MISSING, "en");
      expect(message).toBe("{{fieldName}} is required");
    });

    it("should leave placeholder unchanged when context key is missing", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { wrongKey: "value" }
      );
      expect(message).toBe("{{fieldName}} is required");
    });

    it("should replace available placeholders and leave missing ones", () => {
      const message = mapError(
        ERROR_CODES.INSUFFICIENT_STOCK,
        "en",
        { productName: "Widget" }
      );
      expect(message).toContain("Widget");
      expect(message).toContain("{{available}}");
      expect(message).toContain("{{required}}");
    });

    it("should handle empty context object", () => {
      const message = mapError(ERROR_CODES.REQUIRED_FIELD_MISSING, "en", {});
      expect(message).toBe("{{fieldName}} is required");
    });
  });

  describe("XSS prevention", () => {
    it("should escape HTML special characters in context values", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { fieldName: "<script>alert('xss')</script>" }
      );
      expect(message).not.toContain("<script>");
      expect(message).toContain("&lt;script&gt;");
    });

    it("should escape ampersands", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { fieldName: "Name & Email" }
      );
      expect(message).toContain("&amp;");
    });

    it("should escape quotes", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { fieldName: 'Field "name"' }
      );
      expect(message).toContain("&quot;");
    });

    it("should escape single quotes", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { fieldName: "User's name" }
      );
      expect(message).toContain("&#x27;");
    });

    it("should escape forward slashes", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { fieldName: "path/to/field" }
      );
      expect(message).toContain("&#x2F;");
    });

    it("should escape multiple special characters", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "en",
        { fieldName: '<img src="x" onerror="alert(1)">' }
      );
      expect(message).not.toContain("<img");
      expect(message).not.toContain("<img src=");
      expect(message).toContain("&lt;");
      expect(message).toContain("&gt;");
      expect(message).toContain("&quot;");
      // Verify the full escaped string is present
      expect(message).toContain("&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;");
    });

    it("should escape context values in Arabic messages", () => {
      const message = mapError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        "ar",
        { fieldName: "<script>alert('xss')</script>" }
      );
      expect(message).not.toContain("<script>");
      expect(message).toContain("&lt;script&gt;");
    });
  });

  describe("Default locale", () => {
    it("should default to English when locale is not provided", () => {
      const message = mapError(ERROR_CODES.CUSTOMER_NOT_FOUND);
      expect(message).toBe("Customer not found");
    });
  });
});

describe("formatValidationErrors", () => {
  it("should convert fields array to field-to-message map", () => {
    const fields = [
      { path: "name", message: "Name is required" },
      { path: "email", message: "Invalid email format" },
    ];
    
    const errors = formatValidationErrors(fields);
    
    expect(errors).toEqual({
      name: "Name is required",
      email: "Invalid email format",
    });
  });

  it("should handle nested field paths", () => {
    const fields = [
      { path: "products.0.quantity", message: "Quantity must be positive" },
      { path: "products.1.name", message: "Name is required" },
    ];
    
    const errors = formatValidationErrors(fields);
    
    expect(errors).toEqual({
      "products.0.quantity": "Quantity must be positive",
      "products.1.name": "Name is required",
    });
  });

  it("should handle empty fields array", () => {
    const errors = formatValidationErrors([]);
    expect(errors).toEqual({});
  });

  it("should handle single field error", () => {
    const fields = [{ path: "email", message: "Email is required" }];
    const errors = formatValidationErrors(fields);
    
    expect(errors).toEqual({
      email: "Email is required",
    });
  });

  it("should preserve field order in the map", () => {
    const fields = [
      { path: "field1", message: "Error 1" },
      { path: "field2", message: "Error 2" },
      { path: "field3", message: "Error 3" },
    ];
    
    const errors = formatValidationErrors(fields);
    const keys = Object.keys(errors);
    
    expect(keys).toEqual(["field1", "field2", "field3"]);
  });

  it("should ignore locale parameter (not used in current implementation)", () => {
    const fields = [{ path: "name", message: "Name is required" }];
    const errors = formatValidationErrors(fields, "ar");
    
    expect(errors).toEqual({
      name: "Name is required",
    });
  });
});

describe("isRecoverableError", () => {
  it("should return true for NETWORK_TIMEOUT", () => {
    expect(isRecoverableError("NETWORK_TIMEOUT")).toBe(true);
  });

  it("should return true for SERVICE_UNAVAILABLE", () => {
    expect(isRecoverableError("SERVICE_UNAVAILABLE")).toBe(true);
  });

  it("should return true for EXTERNAL_API_FAILURE", () => {
    expect(isRecoverableError("EXTERNAL_API_FAILURE")).toBe(true);
  });

  it("should return false for CUSTOMER_NOT_FOUND", () => {
    expect(isRecoverableError("CUSTOMER_NOT_FOUND")).toBe(false);
  });

  it("should return false for VALIDATION_FAILED", () => {
    expect(isRecoverableError("VALIDATION_FAILED")).toBe(false);
  });

  it("should return false for PERMISSION_DENIED", () => {
    expect(isRecoverableError("PERMISSION_DENIED")).toBe(false);
  });

  it("should return false for unknown error codes", () => {
    expect(isRecoverableError("UNKNOWN_ERROR")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isRecoverableError("")).toBe(false);
  });
});

describe("isBlockingError", () => {
  it("should return true for PERMISSION_DENIED", () => {
    expect(isBlockingError("PERMISSION_DENIED")).toBe(true);
  });

  it("should return true for INVALID_API_KEY", () => {
    expect(isBlockingError("INVALID_API_KEY")).toBe(true);
  });

  it("should return true for SESSION_EXPIRED", () => {
    expect(isBlockingError("SESSION_EXPIRED")).toBe(true);
  });

  it("should return true for UNAUTHORIZED", () => {
    expect(isBlockingError("UNAUTHORIZED")).toBe(true);
  });

  it("should return false for CUSTOMER_NOT_FOUND", () => {
    expect(isBlockingError("CUSTOMER_NOT_FOUND")).toBe(false);
  });

  it("should return false for VALIDATION_FAILED", () => {
    expect(isBlockingError("VALIDATION_FAILED")).toBe(false);
  });

  it("should return false for NETWORK_TIMEOUT", () => {
    expect(isBlockingError("NETWORK_TIMEOUT")).toBe(false);
  });

  it("should return false for unknown error codes", () => {
    expect(isBlockingError("UNKNOWN_ERROR")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isBlockingError("")).toBe(false);
  });
});

/**
 * Custom Error Classes
 * 
 * Typed error classes for semantic error handling in the COD platform.
 * All errors extend the base AppError class and include code, category, status, and context.
 */

import { ERROR_CODES, ERROR_CATEGORIES, ErrorCode, ErrorCategory } from "../../../../cod-shared/errors/codes";

/**
 * Error context for additional error information
 */
export interface ErrorContext {
  [key: string]: any;
}

/**
 * Base application error class
 * All custom errors extend this class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public category: ErrorCategory,
    public statusCode: number,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation Error (400 Bad Request)
 * Used for input validation failures from Zod schemas or manual validation
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.VALIDATION_FAILED,
    context?: ErrorContext
  ) {
    super(message, code, ERROR_CATEGORIES.VALIDATION, 400, context);
  }
}

/**
 * Not Found Error (404 Not Found)
 * Used when a requested entity doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    const message = id ? `${entity} with ID ${id} not found` : `${entity} not found`;
    
    // Generate error code from entity name (e.g., "Customer" -> "CUSTOMER_NOT_FOUND")
    const entityUpper = entity.toUpperCase().replace(/\s+/g, "_");
    const code = `${entityUpper}_NOT_FOUND` as ErrorCode;
    
    super(message, code, ERROR_CATEGORIES.BUSINESS_LOGIC, 404, { entity, id });
  }
}

/**
 * Business Logic Error (422 Unprocessable Entity)
 * Used for domain rule violations and business constraints
 */
export class BusinessLogicError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: ErrorContext
  ) {
    super(message, code, ERROR_CATEGORIES.BUSINESS_LOGIC, 422, context);
  }
}

/**
 * Conflict Error (409 Conflict)
 * Used for duplicate entities or conflicting operations
 */
export class ConflictError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: ErrorContext
  ) {
    super(message, code, ERROR_CATEGORIES.BUSINESS_LOGIC, 409, context);
  }
}

/**
 * Authentication Error (401 Unauthorized)
 * Used for missing or invalid credentials
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.INVALID_API_KEY,
    context?: ErrorContext
  ) {
    super(message, code, ERROR_CATEGORIES.AUTHENTICATION, 401, context);
  }
}

/**
 * Permission Error (403 Forbidden)
 * Used when user lacks required permissions
 */
export class PermissionError extends AppError {
  constructor(message: string, requiredScope?: string) {
    super(
      message,
      ERROR_CODES.PERMISSION_DENIED,
      ERROR_CATEGORIES.AUTHENTICATION,
      403,
      { requiredScope }
    );
  }
}

/**
 * System Error (500 Internal Server Error)
 * Used for unexpected server errors and infrastructure failures
 */
export class SystemError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    context?: ErrorContext
  ) {
    super(message, code, ERROR_CATEGORIES.SYSTEM, 500, context);
  }
}

/**
 * External API Error (502 Bad Gateway)
 * Used when external service calls fail
 */
export class ExternalApiError extends AppError {
  constructor(provider: string, message: string, context?: ErrorContext) {
    super(
      `External API failure: ${provider} - ${message}`,
      ERROR_CODES.EXTERNAL_API_FAILURE,
      ERROR_CATEGORIES.SYSTEM,
      502,
      { provider, ...context }
    );
  }
}

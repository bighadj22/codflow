/**
 * Error Handling Middleware
 * 
 * Global error handler for consistent error responses.
 * Handles custom AppError instances, ZodError validation, and unknown errors.
 */

import { Context } from "hono";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/classes";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../cod-shared/errors/codes";

/**
 * Standardized error response structure
 */
export interface ErrorResponse {
  error: string;
  code: string;
  category: string;
  context?: Record<string, any>;
}

/**
 * Sanitize error message to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  // Remove file paths
  message = message.replace(/\/[^\s]+\.(ts|js|tsx|jsx)/g, "[file]");
  
  // Remove stack trace lines
  message = message.replace(/at\s+[^\n]+/g, "");
  
  // Remove internal variable names (e.g., "variable_name is not defined")
  message = message.replace(/\b[a-z_][a-z0-9_]*\b/gi, (match) => {
    // Keep common words
    const commonWords = ["is", "not", "defined", "null", "undefined", "error", "failed"];
    return commonWords.includes(match.toLowerCase()) ? match : "[variable]";
  });
  
  return message.trim();
}

/**
 * Check if message contains sensitive information
 */
function containsSensitiveInfo(message: string): boolean {
  const sensitivePatterns = [
    /api[_\-\s]?key/i,
    /password/i,
    /secret/i,
    /token/i,
    /\/[a-z0-9_-]+\/[a-z0-9_-]+\//i, // file paths
    /at\s+[^\n]+/i, // stack traces
  ];
  
  return sensitivePatterns.some((pattern) => pattern.test(message));
}

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error, c: Context): Response {
  // Generate request ID for tracing
  const requestId = crypto.randomUUID();
  
  // Log detailed error server-side
  console.error("[Error Handler]", {
    requestId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
    // Include user info if available
    user: c.get("user")?.id || "anonymous",
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      error: "Validation failed",
      code: ERROR_CODES.VALIDATION_FAILED,
      category: ERROR_CATEGORIES.VALIDATION,
      context: {
        fields: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
      },
    };
    
    return c.json(response, 400);
  }

  // Handle custom AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.message,
      code: err.code,
      category: err.category,
      context: err.context,
    };
    
    return c.json(response, err.statusCode as any);
  }

  // Handle unknown errors - sanitize for security
  const safeMessage = containsSensitiveInfo(err.message)
    ? "An unexpected error occurred"
    : sanitizeErrorMessage(err.message);
  
  const response: ErrorResponse = {
    error: safeMessage,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    category: ERROR_CATEGORIES.SYSTEM,
  };
  
  return c.json(response, 500);
}

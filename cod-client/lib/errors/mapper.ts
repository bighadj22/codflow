/**
 * Error Mapper Utility
 * 
 * Maps backend error codes to localized user-friendly messages.
 * Supports context interpolation and XSS prevention.
 */

import { ERROR_REGISTRY, FALLBACK_ERROR_MESSAGE } from "./registry";

export type Locale = "en" | "ar" | "fr";

export interface ErrorContext {
  [key: string]: any;
}

/**
 * Escape HTML special characters to prevent XSS attacks
 */
function escapeHtml(value: string): string {
  const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  
  return value.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Map error code to localized user message with context interpolation
 * 
 * @param code - Error code from backend
 * @param locale - User's language preference ("en" or "ar")
 * @param context - Optional context data for placeholder interpolation
 * @returns Localized error message with interpolated context values
 */
export function mapError(
  code: string,
  locale: Locale = "en",
  context?: ErrorContext
): string {
  // Get error message from registry or use fallback
  const errorMessage = ERROR_REGISTRY[code] || FALLBACK_ERROR_MESSAGE;
  // Fall back to English when the locale has no specific message
  let message = errorMessage[locale] ?? errorMessage["en"];
  
  // Interpolate context variables if provided
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      if (message.includes(placeholder)) {
        // Escape HTML special characters to prevent XSS
        const escapedValue = escapeHtml(String(value));
        message = message.replace(new RegExp(placeholder, "g"), escapedValue);
      }
    });
  }
  
  return message;
}

/**
 * Format validation errors for form display
 * 
 * @param fields - Array of validation errors with path and message
 * @param locale - User's language preference
 * @returns Map of field paths to error messages
 */
export function formatValidationErrors(
  fields: Array<{ path: string; message: string }>,
  locale: Locale = "en"
): Record<string, string> {
  const errors: Record<string, string> = {};
  
  fields.forEach((field) => {
    errors[field.path] = field.message;
  });
  
  return errors;
}

/**
 * Check if error is recoverable (user can retry)
 * 
 * @param code - Error code from backend
 * @returns True if error is recoverable
 */
export function isRecoverableError(code: string): boolean {
  const recoverableCodes = [
    "NETWORK_TIMEOUT",
    "SERVICE_UNAVAILABLE",
    "EXTERNAL_API_FAILURE",
  ];
  return recoverableCodes.includes(code);
}

/**
 * Check if error should block UI
 * 
 * @param code - Error code from backend
 * @returns True if error should block UI
 */
export function isBlockingError(code: string): boolean {
  const blockingCodes = [
    "PERMISSION_DENIED",
    "INVALID_API_KEY",
    "SESSION_EXPIRED",
    "UNAUTHORIZED",
  ];
  return blockingCodes.includes(code);
}

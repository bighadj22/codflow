/**
 * Error Toast Utility
 * 
 * Displays non-blocking errors as toast notifications with proper RTL support for Arabic.
 * Integrates with the error mapper and locale utilities.
 * 
 * Note: RTL text direction is automatically handled by the Toaster component based on
 * the user's locale preference. Individual toasts inherit the direction from the Toaster.
 */

import { toast } from "sonner";
import { isRecoverableError } from "./mapper";
import type { Locale } from "./mapper";

export interface ShowErrorToastOptions {
  /**
   * Error code from the backend (used to determine if error is recoverable)
   */
  code?: string;
  
  /**
   * Callback function to execute when the retry button is clicked
   */
  onRetry?: () => void;
  
  /**
   * Duration in milliseconds before the toast auto-dismisses
   * @default 5000 (5 seconds)
   */
  duration?: number;
  
  /**
   * Whether the toast can be dismissed by the user
   * @default true
   */
  dismissible?: boolean;
}

/**
 * Display an error message as a toast notification
 * 
 * Features:
 * - RTL text direction for Arabic locale (handled by Toaster component)
 * - Retry button for recoverable errors (network timeouts, service unavailable, etc.)
 * - Dismissible toasts for non-blocking errors
 * - Appropriate styling for error severity
 * 
 * @param message - The localized error message to display
 * @param locale - The user's language preference ("en" or "ar")
 * @param options - Additional options for the toast
 * 
 * @example
 * ```typescript
 * // Simple error toast
 * showErrorToast("Failed to save customer", "en");
 * 
 * // Error toast with retry button
 * showErrorToast(
 *   "Network timeout. Check your connection.",
 *   "en",
 *   {
 *     code: "NETWORK_TIMEOUT",
 *     onRetry: () => saveCustomer()
 *   }
 * );
 * 
 * // Arabic error toast with RTL (RTL handled automatically by Toaster)
 * showErrorToast("فشل حفظ العميل", "ar");
 * ```
 */
export function showErrorToast(
  message: string,
  locale: Locale = "en",
  options: ShowErrorToastOptions = {}
): void {
  const {
    code,
    onRetry,
    duration = 5000,
    dismissible = true,
  } = options;
  
  // Determine if this error is recoverable (can be retried)
  const isRecoverable = code ? isRecoverableError(code) : false;
  
  // Show error toast with appropriate configuration
  toast.error(message, {
    duration,
    dismissible,
    // Add retry action for recoverable errors
    action: isRecoverable && onRetry ? {
      label: locale === "ar" ? "إعادة المحاولة" : "Retry",
      onClick: onRetry,
    } : undefined,
    // Apply custom class for additional styling if needed
    className: locale === "ar" ? "font-arabic" : undefined,
  });
}

/**
 * Display a success message as a toast notification
 * 
 * @param message - The localized success message to display
 * @param locale - The user's language preference ("en" or "ar")
 * @param duration - Duration in milliseconds before auto-dismiss (default: 3000)
 */
export function showSuccessToast(
  message: string,
  locale: Locale = "en",
  duration: number = 3000
): void {
  toast.success(message, {
    duration,
    className: locale === "ar" ? "font-arabic" : undefined,
  });
}

/**
 * Display a warning message as a toast notification
 * 
 * @param message - The localized warning message to display
 * @param locale - The user's language preference ("en" or "ar")
 * @param duration - Duration in milliseconds before auto-dismiss (default: 4000)
 */
export function showWarningToast(
  message: string,
  locale: Locale = "en",
  duration: number = 4000
): void {
  toast.warning(message, {
    duration,
    className: locale === "ar" ? "font-arabic" : undefined,
  });
}

/**
 * Display an info message as a toast notification
 * 
 * @param message - The localized info message to display
 * @param locale - The user's language preference ("en" or "ar")
 * @param duration - Duration in milliseconds before auto-dismiss (default: 3000)
 */
export function showInfoToast(
  message: string,
  locale: Locale = "en",
  duration: number = 3000
): void {
  toast.info(message, {
    duration,
    className: locale === "ar" ? "font-arabic" : undefined,
  });
}

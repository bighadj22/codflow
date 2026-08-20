/**
 * Usage Examples for Error Toast Utility
 * 
 * This file demonstrates how to use the error toast utility in Server Actions
 * and client components to display user-friendly error messages.
 */

import { showErrorToast, showSuccessToast } from "./toast";
import { mapError } from "./mapper";
import { getLocale } from "../locale";
import { ApiClientError } from "../api-client";

// ============================================================================
// Example 1: Simple Error Toast in Server Action
// ============================================================================

/**
 * Display a simple error message when an operation fails
 */
export async function deleteCustomerExample(id: string) {
  try {
    // ... API call to delete customer
    throw new Error("Simulated error");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const message = mapError(error.code, locale, error.context);
      
      // Display error toast
      showErrorToast(message, locale);
    }
  }
}

// ============================================================================
// Example 2: Error Toast with Retry Button
// ============================================================================

/**
 * Display an error with a retry button for recoverable errors
 */
export async function saveCustomerWithRetry(customerData: any) {
  const attemptSave = async () => {
    try {
      // ... API call to save customer
      const locale = await getLocale();
      showSuccessToast("Customer saved successfully", locale);
    } catch (error) {
      if (error instanceof ApiClientError && error.code) {
        const locale = await getLocale();
        const message = mapError(error.code, locale, error.context);
        
        // Display error toast with retry button for recoverable errors
        showErrorToast(message, locale, {
          code: error.code,
          onRetry: attemptSave, // Retry the same operation
        });
      }
    }
  };
  
  await attemptSave();
}

// ============================================================================
// Example 3: Client Component Usage
// ============================================================================

/**
 * Example of using error toast in a client component
 * 
 * ```tsx
 * "use client";
 * 
 * import { showErrorToast } from "@/lib/errors/toast";
 * import { useLanguage } from "@/lib/i18n-context";
 * 
 * export function CustomerForm() {
 *   const { locale } = useLanguage();
 *   
 *   const handleSubmit = async (data: any) => {
 *     try {
 *       await saveCustomer(data);
 *       showSuccessToast("Customer saved successfully", locale);
 *     } catch (error) {
 *       if (error instanceof Error) {
 *         showErrorToast(error.message, locale);
 *       }
 *     }
 *   };
 *   
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {/* form fields *\/}
 *     </form>
 *   );
 * }
 * ```
 */

// ============================================================================
// Example 4: Custom Duration and Dismissible Options
// ============================================================================

/**
 * Display an error with custom duration and dismissible options
 */
export function showCriticalError(message: string, locale: "en" | "ar") {
  // Critical errors should stay longer and not be dismissible
  showErrorToast(message, locale, {
    duration: 10000, // 10 seconds
    dismissible: false, // User must wait for auto-dismiss
  });
}

// ============================================================================
// Example 5: Integration with Error Mapper
// ============================================================================

/**
 * Complete example showing integration with error mapper and locale detection
 */
export async function completeErrorHandlingExample(orderId: string) {
  try {
    // ... API call
    throw new ApiClientError(
      "Order already dispatched",
      409,
      "ORDER_ALREADY_DISPATCHED",
      "BUSINESS_LOGIC",
      { trackingNumber: "ZR123456" }
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      // Get user's locale preference
      const locale = await getLocale();
      
      // Map error code to localized message with context interpolation
      const message = mapError(error.code, locale, error.context);
      // Result (en): "This order is already dispatched to a delivery company (tracking: ZR123456). Driver assignment is not allowed."
      // Result (ar): "تم إرسال هذا الطلب بالفعل إلى شركة التوصيل (رقم التتبع: ZR123456). لا يُسمح بتعيين سائق."
      
      // Display error toast with retry button if recoverable
      showErrorToast(message, locale, {
        code: error.code,
        onRetry: error.code === "NETWORK_TIMEOUT" ? () => completeErrorHandlingExample(orderId) : undefined,
      });
    }
  }
}

// ============================================================================
// Example 6: Multiple Toast Types
// ============================================================================

/**
 * Example showing different toast types for different scenarios
 */
export async function orderWorkflowExample(orderId: string) {
  const locale = await getLocale();
  
  try {
    // Step 1: Show info toast
    // showInfoToast("Processing order...", locale);
    
    // Step 2: Process order
    // await processOrder(orderId);
    
    // Step 3: Show success toast
    showSuccessToast("Order processed successfully", locale);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const message = mapError(error.code, locale, error.context);
      
      // Show error toast
      showErrorToast(message, locale, {
        code: error.code,
      });
    }
  }
}

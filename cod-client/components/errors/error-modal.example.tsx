/**
 * ErrorModal Component Usage Examples
 * 
 * This file demonstrates various use cases for the ErrorModal component.
 */

"use client";

import { useState } from "react";
import { ErrorModal } from "./error-modal";
import { Button } from "@/components/ui/button";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { mapError } from "@/lib/errors/mapper";

/**
 * Example 1: Simple Error Modal (English)
 */
export function SimpleErrorExample() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useErrorLocale();
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Show Simple Error
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message="An unexpected error occurred. Please try again."
        locale={locale}
      />
    </>
  );
}

/**
 * Example 2: Error with Code (for debugging)
 */
export function ErrorWithCodeExample() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useErrorLocale();
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Show Error with Code
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message="Customer not found in the database."
        locale={locale}
        errorCode="CUSTOMER_NOT_FOUND"
      />
    </>
  );
}

/**
 * Example 3: Recoverable Error with Retry Button
 */
export function RecoverableErrorExample() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const locale = useErrorLocale();
  
  const handleRetry = async () => {
    setLoading(true);
    try {
      // Simulate API retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsOpen(false);
    } catch (error) {
      // Handle retry failure
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Show Recoverable Error
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message="Network timeout. Check your internet connection and try again."
        locale={locale}
        errorCode="NETWORK_TIMEOUT"
        onRetry={handleRetry}
      />
    </>
  );
}

/**
 * Example 4: Critical Error (Cannot be dismissed)
 */
export function CriticalErrorExample() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useErrorLocale();
  
  const handleRetry = () => {
    // Attempt to recover from critical error
    console.log("Attempting to recover...");
    // Note: Modal won't close automatically for critical errors
  };
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Show Critical Error
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message="Your session has expired. Please log in again."
        locale={locale}
        errorCode="SESSION_EXPIRED"
        isCritical={true}
        onRetry={handleRetry}
      />
    </>
  );
}

/**
 * Example 5: Error with Contact Support
 */
export function ErrorWithSupportExample() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useErrorLocale();
  
  const handleContactSupport = () => {
    // Custom support action (e.g., open chat widget, redirect to support page)
    window.open("https://support.example.com", "_blank");
  };
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Show Error with Support
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message="Database error. Please contact support if this persists."
        locale={locale}
        errorCode="DATABASE_ERROR"
        onContactSupport={handleContactSupport}
      />
    </>
  );
}

/**
 * Example 6: Using with Backend Error Response
 */
export function BackendErrorExample() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const locale = useErrorLocale();
  
  const handleApiCall = async () => {
    try {
      // Simulate API call that fails
      throw {
        code: "CUSTOMER_HAS_ORDERS",
        context: { customerId: "123", orderCount: 5 }
      };
    } catch (error: any) {
      // Map backend error code to user-friendly message
      const message = mapError(error.code, locale, error.context);
      setErrorMessage(message);
      setErrorCode(error.code);
      setIsOpen(true);
    }
  };
  
  return (
    <>
      <Button onClick={handleApiCall}>
        Trigger Backend Error
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message={errorMessage}
        locale={locale}
        errorCode={errorCode}
      />
    </>
  );
}

/**
 * Example 7: Arabic Locale (RTL Layout)
 */
export function ArabicErrorExample() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        عرض خطأ بالعربية
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message="لا يمكن حذف عميل لديه طلبات موجودة. قم بأرشفة العميل بدلاً من ذلك."
        locale="ar"
        errorCode="CUSTOMER_HAS_ORDERS"
      />
    </>
  );
}

/**
 * Example 8: Complete Error Handling Pattern
 */
export function CompleteErrorHandlingExample() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorState, setErrorState] = useState({
    message: "",
    code: "",
    isCritical: false,
  });
  const locale = useErrorLocale();
  
  const handleDeleteCustomer = async (customerId: string) => {
    try {
      // Simulate API call
      const response = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json() as { code: string; context?: Record<string, unknown> };
        
        // Map error code to user message
        const message = mapError(errorData.code, locale, errorData.context);
        
        setErrorState({
          message,
          code: errorData.code,
          isCritical: errorData.code === "SESSION_EXPIRED",
        });
        setIsOpen(true);
      }
    } catch (error) {
      // Network error
      setErrorState({
        message: mapError("NETWORK_TIMEOUT", locale),
        code: "NETWORK_TIMEOUT",
        isCritical: false,
      });
      setIsOpen(true);
    }
  };
  
  const handleRetry = () => {
    // Retry the operation
    handleDeleteCustomer("customer-id");
  };
  
  return (
    <>
      <Button onClick={() => handleDeleteCustomer("customer-id")}>
        Delete Customer
      </Button>
      
      <ErrorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        message={errorState.message}
        locale={locale}
        errorCode={errorState.code}
        isCritical={errorState.isCritical}
        onRetry={errorState.code === "NETWORK_TIMEOUT" ? handleRetry : undefined}
        onContactSupport={
          errorState.code === "DATABASE_ERROR" ? () => {} : undefined
        }
      />
    </>
  );
}

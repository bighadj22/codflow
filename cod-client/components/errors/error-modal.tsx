"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { Locale } from "@/lib/errors/mapper";

export interface ErrorModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
  /**
   * Callback when the modal should close
   * Note: For critical errors, this may not be called when user tries to dismiss
   */
  onClose: () => void;
  
  /**
   * The error message to display (already localized)
   */
  message: string;
  
  /**
   * User's language preference for RTL layout
   */
  locale: Locale;
  
  /**
   * Optional error code for debugging
   */
  errorCode?: string;
  
  /**
   * Optional retry callback
   */
  onRetry?: () => void;
  
  /**
   * Whether this is a critical error (prevents dismissal)
   * @default false
   */
  isCritical?: boolean;
  
  /**
   * Optional contact support callback
   */
  onContactSupport?: () => void;
}

/**
 * Error Modal Component
 * 
 * Displays blocking errors in a modal dialog with proper RTL support for Arabic.
 * Supports action buttons (Retry, Cancel, Contact Support) and prevents dismissal
 * for critical errors.
 * 
 * @example
 * ```tsx
 * <ErrorModal
 *   isOpen={true}
 *   onClose={() => setIsOpen(false)}
 *   message="Cannot delete customer with existing orders"
 *   locale="en"
 *   errorCode="CUSTOMER_HAS_ORDERS"
 *   isCritical={false}
 * />
 * ```
 */
export function ErrorModal({
  isOpen,
  onClose,
  message,
  locale,
  errorCode,
  onRetry,
  isCritical = false,
  onContactSupport,
}: ErrorModalProps) {
  const isRTL = locale === "ar";
  
  // For critical errors, prevent dismissal
  const handleOpenChange = (open: boolean) => {
    if (!open && !isCritical) {
      onClose();
    }
  };
  
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    if (!isCritical) {
      onClose();
    }
  };
  
  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      // Default behavior: open email client
      window.location.href = "mailto:support@example.com";
    }
  };
  
  // Localized button labels
  const labels = {
    title: locale === "ar" ? "خطأ" : "Error",
    retry: locale === "ar" ? "إعادة المحاولة" : "Retry",
    cancel: locale === "ar" ? "إلغاء" : "Cancel",
    close: locale === "ar" ? "إغلاق" : "Close",
    contactSupport: locale === "ar" ? "اتصل بالدعم" : "Contact Support",
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        dir={isRTL ? "rtl" : "ltr"}
        className="max-w-md bg-card border-border"
        showCloseButton={!isCritical}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-foreground font-black">
              {labels.title}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <p
            className={`text-sm text-foreground leading-relaxed ${
              isRTL ? "font-arabic text-right" : ""
            }`}
          >
            {message}
          </p>
          
          {errorCode && (
            <p className="text-xs text-muted-foreground font-mono">
              Code: {errorCode}
            </p>
          )}
        </div>
        
        <DialogFooter>
          {/* Contact Support button (leftmost in LTR, rightmost in RTL) */}
          {onContactSupport !== undefined && (
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-transparent hover:bg-muted text-foreground font-bold"
              onClick={handleContactSupport}
            >
              {labels.contactSupport}
            </Button>
          )}
          
          {/* Cancel/Close button (only show if not critical) */}
          {!isCritical && (
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-transparent hover:bg-muted text-foreground font-bold"
              onClick={onClose}
            >
              {onRetry ? labels.cancel : labels.close}
            </Button>
          )}
          
          {/* Retry button (rightmost in LTR, leftmost in RTL) */}
          {onRetry && (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black"
              onClick={handleRetry}
            >
              {labels.retry}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

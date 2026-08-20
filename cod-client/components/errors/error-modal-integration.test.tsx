/**
 * @vitest-environment jsdom
 *
 * Integration tests for ErrorModal usage in UI components
 *
 * Tests that components properly integrate the ErrorModal for blocking errors
 * and display localized messages with proper RTL support.
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ErrorModal } from "./error-modal";

describe("ErrorModal Integration", () => {
  it("should display error modal with English message", () => {
    const onClose = vi.fn();
    
    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="Cannot delete customer with existing orders"
        locale="en"
        errorCode="CUSTOMER_HAS_ORDERS"
      />
    );
    
    expect(screen.getByText("Cannot delete customer with existing orders")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Code: CUSTOMER_HAS_ORDERS")).toBeInTheDocument();
  });
  
  it("should display error modal with Arabic message and RTL layout", () => {
    const onClose = vi.fn();
    
    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="لا يمكن حذف عميل لديه طلبات موجودة"
        locale="ar"
        errorCode="CUSTOMER_HAS_ORDERS"
      />
    );
    
    expect(screen.getByText("لا يمكن حذف عميل لديه طلبات موجودة")).toBeInTheDocument();
    expect(screen.getByText("خطأ")).toBeInTheDocument();
    
    // Check RTL direction
    const content = screen.getByText("لا يمكن حذف عميل لديه طلبات موجودة").closest('[dir]');
    expect(content).toHaveAttribute('dir', 'rtl');
  });
  
  it("should show retry button for recoverable errors", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    
    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="Network timeout. Please try again."
        locale="en"
        errorCode="NETWORK_TIMEOUT"
        onRetry={onRetry}
      />
    );
    
    const retryButton = screen.getByText("Retry");
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  
  it("should show contact support button when provided", () => {
    const onClose = vi.fn();
    const onContactSupport = vi.fn();
    
    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="An unexpected error occurred"
        locale="en"
        errorCode="INTERNAL_SERVER_ERROR"
        onContactSupport={onContactSupport}
      />
    );
    
    const supportButton = screen.getByText("Contact Support");
    expect(supportButton).toBeInTheDocument();
    
    fireEvent.click(supportButton);
    expect(onContactSupport).toHaveBeenCalledTimes(1);
  });
  
  it("should prevent dismissal for critical errors", () => {
    const onClose = vi.fn();
    
    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="Permission denied"
        locale="en"
        errorCode="PERMISSION_DENIED"
        isCritical={true}
      />
    );
    
    // Close button should not be visible for critical errors
    const closeButton = screen.queryByRole('button', { name: /close/i });
    expect(closeButton).not.toBeInTheDocument();
  });
  
  it("should allow dismissal for non-critical errors", () => {
    const onClose = vi.fn();

    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="Cannot delete customer with existing orders"
        locale="en"
        errorCode="CUSTOMER_HAS_ORDERS"
        isCritical={false}
      />
    );

    // Two "Close" buttons exist for non-critical: header X (sr-only label)
    // and the footer action button. Click the footer one (visible text node).
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    const footerCloseButton = closeButtons.find(
      (btn) => btn.textContent?.trim() === "Close",
    );
    expect(footerCloseButton).toBeDefined();

    fireEvent.click(footerCloseButton!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  
  it("should display action buttons in correct order for English", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const onContactSupport = vi.fn();

    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="Error message"
        locale="en"
        onRetry={onRetry}
        onContactSupport={onContactSupport}
      />
    );

    // Dialog content renders in a portal, so query the document not the container
    const buttons = document.body.querySelectorAll("button");
    const buttonTexts = Array.from(buttons).map((btn) => btn.textContent?.trim());

    expect(buttonTexts).toContain("Contact Support");
    expect(buttonTexts).toContain("Cancel");
    expect(buttonTexts).toContain("Retry");
  });

  it("should display action buttons with RTL layout for Arabic", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();

    render(
      <ErrorModal
        isOpen={true}
        onClose={onClose}
        message="رسالة خطأ"
        locale="ar"
        onRetry={onRetry}
      />
    );

    // Dialog content lives in a portal — query the document body
    const dialogContent = document.body.querySelector('[dir="rtl"]');
    expect(dialogContent).toBeInTheDocument();

    expect(screen.getByText("إعادة المحاولة")).toBeInTheDocument();
    expect(screen.getByText("إلغاء")).toBeInTheDocument();
  });
});

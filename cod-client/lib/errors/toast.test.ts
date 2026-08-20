/**
 * Unit tests for error toast utility
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { showErrorToast, showSuccessToast, showWarningToast, showInfoToast } from "./toast";
import * as sonner from "sonner";
import * as mapper from "./mapper";

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock mapper
vi.mock("./mapper", () => ({
  isRecoverableError: vi.fn(),
}));

describe("showErrorToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display error toast with default options", () => {
    const message = "Failed to save customer";
    
    showErrorToast(message, "en");
    
    expect(sonner.toast.error).toHaveBeenCalledWith(message, {
      duration: 5000,
      dismissible: true,
      action: undefined,
      className: undefined,
    });
  });

  it("should display error toast with Arabic locale", () => {
    const message = "فشل حفظ العميل";
    
    showErrorToast(message, "ar");
    
    expect(sonner.toast.error).toHaveBeenCalledWith(message, {
      duration: 5000,
      dismissible: true,
      action: undefined,
      className: "font-arabic",
    });
  });

  it("should add retry button for recoverable errors", () => {
    const message = "Network timeout";
    const onRetry = vi.fn();
    
    vi.mocked(mapper.isRecoverableError).mockReturnValue(true);
    
    showErrorToast(message, "en", {
      code: "NETWORK_TIMEOUT",
      onRetry,
    });
    
    expect(sonner.toast.error).toHaveBeenCalledWith(message, {
      duration: 5000,
      dismissible: true,
      action: {
        label: "Retry",
        onClick: onRetry,
      },
      className: undefined,
    });
  });

  it("should add Arabic retry button for recoverable errors in Arabic", () => {
    const message = "انتهت مهلة الشبكة";
    const onRetry = vi.fn();
    
    vi.mocked(mapper.isRecoverableError).mockReturnValue(true);
    
    showErrorToast(message, "ar", {
      code: "NETWORK_TIMEOUT",
      onRetry,
    });
    
    expect(sonner.toast.error).toHaveBeenCalledWith(message, {
      duration: 5000,
      dismissible: true,
      action: {
        label: "إعادة المحاولة",
        onClick: onRetry,
      },
      className: "font-arabic",
    });
  });

  it("should not add retry button for non-recoverable errors", () => {
    const message = "Customer not found";
    const onRetry = vi.fn();
    
    vi.mocked(mapper.isRecoverableError).mockReturnValue(false);
    
    showErrorToast(message, "en", {
      code: "CUSTOMER_NOT_FOUND",
      onRetry,
    });
    
    expect(sonner.toast.error).toHaveBeenCalledWith(message, {
      duration: 5000,
      dismissible: true,
      action: undefined,
      className: undefined,
    });
  });

  it("should respect custom duration", () => {
    const message = "Error message";
    
    showErrorToast(message, "en", { duration: 10000 });
    
    expect(sonner.toast.error).toHaveBeenCalledWith(message, {
      duration: 10000,
      dismissible: true,
      action: undefined,
      className: undefined,
    });
  });

  it("should respect dismissible option", () => {
    const message = "Error message";
    
    showErrorToast(message, "en", { dismissible: false });
    
    expect(sonner.toast.error).toHaveBeenCalledWith(message, {
      duration: 5000,
      dismissible: false,
      action: undefined,
      className: undefined,
    });
  });
});

describe("showSuccessToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display success toast with default duration", () => {
    const message = "Customer saved successfully";
    
    showSuccessToast(message, "en");
    
    expect(sonner.toast.success).toHaveBeenCalledWith(message, {
      duration: 3000,
      className: undefined,
    });
  });

  it("should display success toast with Arabic locale", () => {
    const message = "تم حفظ العميل بنجاح";
    
    showSuccessToast(message, "ar");
    
    expect(sonner.toast.success).toHaveBeenCalledWith(message, {
      duration: 3000,
      className: "font-arabic",
    });
  });

  it("should respect custom duration", () => {
    const message = "Success message";
    
    showSuccessToast(message, "en", 5000);
    
    expect(sonner.toast.success).toHaveBeenCalledWith(message, {
      duration: 5000,
      className: undefined,
    });
  });
});

describe("showWarningToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display warning toast with default duration", () => {
    const message = "Low stock warning";
    
    showWarningToast(message, "en");
    
    expect(sonner.toast.warning).toHaveBeenCalledWith(message, {
      duration: 4000,
      className: undefined,
    });
  });

  it("should display warning toast with Arabic locale", () => {
    const message = "تحذير: مخزون منخفض";
    
    showWarningToast(message, "ar");
    
    expect(sonner.toast.warning).toHaveBeenCalledWith(message, {
      duration: 4000,
      className: "font-arabic",
    });
  });
});

describe("showInfoToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display info toast with default duration", () => {
    const message = "Order dispatched";
    
    showInfoToast(message, "en");
    
    expect(sonner.toast.info).toHaveBeenCalledWith(message, {
      duration: 3000,
      className: undefined,
    });
  });

  it("should display info toast with Arabic locale", () => {
    const message = "تم إرسال الطلب";
    
    showInfoToast(message, "ar");
    
    expect(sonner.toast.info).toHaveBeenCalledWith(message, {
      duration: 3000,
      className: "font-arabic",
    });
  });
});

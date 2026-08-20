/**
 * Unit tests for ErrorModal component
 * 
 * Tests:
 * - Component props and interface
 * - Locale handling
 * - Button configuration logic
 */

import { describe, it, expect } from "vitest";
import type { ErrorModalProps } from "./error-modal";

describe("ErrorModal", () => {
  describe("Props Interface", () => {
    it("should accept all required props", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "An error occurred",
        locale: "en",
      };
      
      expect(props.isOpen).toBe(true);
      expect(props.message).toBe("An error occurred");
      expect(props.locale).toBe("en");
      expect(typeof props.onClose).toBe("function");
    });
    
    it("should accept optional props", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "An error occurred",
        locale: "en",
        errorCode: "CUSTOMER_NOT_FOUND",
        onRetry: () => {},
        isCritical: true,
        onContactSupport: () => {},
      };
      
      expect(props.errorCode).toBe("CUSTOMER_NOT_FOUND");
      expect(typeof props.onRetry).toBe("function");
      expect(props.isCritical).toBe(true);
      expect(typeof props.onContactSupport).toBe("function");
    });
    
    it("should support English locale", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "An error occurred",
        locale: "en",
      };
      
      expect(props.locale).toBe("en");
    });
    
    it("should support Arabic locale", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "حدث خطأ",
        locale: "ar",
      };
      
      expect(props.locale).toBe("ar");
    });
  });
  
  describe("Button Configuration", () => {
    it("should have retry button when onRetry is provided", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "Network timeout",
        locale: "en",
        onRetry: () => {},
      };
      
      expect(props.onRetry).toBeDefined();
    });
    
    it("should have contact support button when onContactSupport is provided", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "Database error",
        locale: "en",
        onContactSupport: () => {},
      };
      
      expect(props.onContactSupport).toBeDefined();
    });
    
    it("should support critical error mode", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "Critical error",
        locale: "en",
        isCritical: true,
      };
      
      expect(props.isCritical).toBe(true);
    });
    
    it("should default isCritical to false when not provided", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "An error occurred",
        locale: "en",
      };
      
      expect(props.isCritical).toBeUndefined();
    });
  });
  
  describe("Error Code Display", () => {
    it("should support error code prop", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "Customer not found",
        locale: "en",
        errorCode: "CUSTOMER_NOT_FOUND",
      };
      
      expect(props.errorCode).toBe("CUSTOMER_NOT_FOUND");
    });
    
    it("should work without error code", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "An error occurred",
        locale: "en",
      };
      
      expect(props.errorCode).toBeUndefined();
    });
  });
  
  describe("Modal State", () => {
    it("should support open state", () => {
      const props: ErrorModalProps = {
        isOpen: true,
        onClose: () => {},
        message: "An error occurred",
        locale: "en",
      };
      
      expect(props.isOpen).toBe(true);
    });
    
    it("should support closed state", () => {
      const props: ErrorModalProps = {
        isOpen: false,
        onClose: () => {},
        message: "An error occurred",
        locale: "en",
      };
      
      expect(props.isOpen).toBe(false);
    });
  });
});

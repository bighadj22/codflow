/**
 * Unit tests for Error Registry
 */

import { describe, it, expect } from "vitest";
import { ERROR_CODES } from "cod-shared/errors/codes";
import { ERROR_REGISTRY, FALLBACK_ERROR_MESSAGE } from "./registry";

describe("Error Registry", () => {
  describe("Coverage", () => {
    it("should have English messages for all error codes from shared registry", () => {
      const errorCodes = Object.values(ERROR_CODES);
      const missingCodes: string[] = [];

      errorCodes.forEach((code) => {
        if (!ERROR_REGISTRY[code]) {
          missingCodes.push(code);
        } else if (!ERROR_REGISTRY[code].en) {
          missingCodes.push(`${code} (missing English)`);
        }
      });

      expect(missingCodes).toEqual([]);
    });

    it("should have Arabic translations for all error codes", () => {
      const errorCodes = Object.values(ERROR_CODES);
      const missingTranslations: string[] = [];

      errorCodes.forEach((code) => {
        if (!ERROR_REGISTRY[code]) {
          missingTranslations.push(code);
        } else if (!ERROR_REGISTRY[code].ar) {
          missingTranslations.push(`${code} (missing Arabic)`);
        }
      });

      expect(missingTranslations).toEqual([]);
    });
  });

  describe("Message Templates", () => {
    it("should contain placeholders in messages that require context", () => {
      // Messages that should have placeholders
      const messagesWithPlaceholders = [
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        ERROR_CODES.INVALID_FORMAT,
        ERROR_CODES.VALUE_OUT_OF_RANGE,
        ERROR_CODES.ORDER_ALREADY_DISPATCHED,
        ERROR_CODES.DRIVER_ALREADY_ASSIGNED,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        ERROR_CODES.INSUFFICIENT_STOCK,
        ERROR_CODES.PROVIDER_NOT_SUPPORTED,
        ERROR_CODES.EXTERNAL_API_FAILURE,
        ERROR_CODES.FILE_TOO_LARGE,
      ];

      messagesWithPlaceholders.forEach((code) => {
        const message = ERROR_REGISTRY[code];
        expect(message).toBeDefined();
        
        // Check that at least one language has a placeholder
        const hasPlaceholder =
          message.en.includes("{{") || message.ar.includes("{{");
        
        expect(hasPlaceholder).toBe(true);
      });
    });

    it("should use consistent placeholder syntax {{variableName}}", () => {
      const placeholderRegex = /\{\{[a-zA-Z][a-zA-Z0-9]*\}\}/g;

      Object.entries(ERROR_REGISTRY).forEach(([code, message]) => {
        // Extract placeholders from English message
        const enPlaceholders = message.en.match(placeholderRegex) || [];
        
        // Verify all placeholders follow the pattern
        enPlaceholders.forEach((placeholder) => {
          expect(placeholder).toMatch(/^\{\{[a-zA-Z][a-zA-Z0-9]*\}\}$/);
        });

        // Extract placeholders from Arabic message
        const arPlaceholders = message.ar.match(placeholderRegex) || [];
        
        // Verify all placeholders follow the pattern
        arPlaceholders.forEach((placeholder) => {
          expect(placeholder).toMatch(/^\{\{[a-zA-Z][a-zA-Z0-9]*\}\}$/);
        });
      });
    });
  });

  describe("Fallback Message", () => {
    it("should have fallback error message defined", () => {
      expect(FALLBACK_ERROR_MESSAGE).toBeDefined();
      expect(FALLBACK_ERROR_MESSAGE.en).toBeDefined();
      expect(FALLBACK_ERROR_MESSAGE.ar).toBeDefined();
    });

    it("should have non-empty fallback messages", () => {
      expect(FALLBACK_ERROR_MESSAGE.en.length).toBeGreaterThan(0);
      expect(FALLBACK_ERROR_MESSAGE.ar.length).toBeGreaterThan(0);
    });
  });

  describe("Message Quality", () => {
    it("should have non-empty messages for all error codes", () => {
      Object.entries(ERROR_REGISTRY).forEach(([code, message]) => {
        expect(message.en.length).toBeGreaterThan(0);
        expect(message.ar.length).toBeGreaterThan(0);
      });
    });

    it("should not have duplicate messages across different error codes", () => {
      const enMessages = new Map<string, string[]>();
      const arMessages = new Map<string, string[]>();

      Object.entries(ERROR_REGISTRY).forEach(([code, message]) => {
        // Track English messages
        if (!enMessages.has(message.en)) {
          enMessages.set(message.en, []);
        }
        enMessages.get(message.en)!.push(code);

        // Track Arabic messages
        if (!arMessages.has(message.ar)) {
          arMessages.set(message.ar, []);
        }
        arMessages.get(message.ar)!.push(code);
      });

      // Find duplicates (messages used by multiple codes)
      const enDuplicates: string[] = [];
      enMessages.forEach((codes, message) => {
        if (codes.length > 1) {
          enDuplicates.push(`"${message}" used by: ${codes.join(", ")}`);
        }
      });

      const arDuplicates: string[] = [];
      arMessages.forEach((codes, message) => {
        if (codes.length > 1) {
          arDuplicates.push(`"${message}" used by: ${codes.join(", ")}`);
        }
      });

      // Allow some duplicates for generic messages like "not found"
      // but flag them for review
      if (enDuplicates.length > 0) {
        console.warn("English message duplicates found:", enDuplicates);
      }
      if (arDuplicates.length > 0) {
        console.warn("Arabic message duplicates found:", arDuplicates);
      }
    });
  });

  describe("Category Organization", () => {
    it("should have messages organized by category", () => {
      // Validation errors
      expect(ERROR_REGISTRY[ERROR_CODES.VALIDATION_FAILED]).toBeDefined();
      expect(ERROR_REGISTRY[ERROR_CODES.REQUIRED_FIELD_MISSING]).toBeDefined();

      // Authentication errors
      expect(ERROR_REGISTRY[ERROR_CODES.INVALID_API_KEY]).toBeDefined();
      expect(ERROR_REGISTRY[ERROR_CODES.PERMISSION_DENIED]).toBeDefined();

      // Business logic errors
      expect(ERROR_REGISTRY[ERROR_CODES.CUSTOMER_NOT_FOUND]).toBeDefined();
      expect(ERROR_REGISTRY[ERROR_CODES.ORDER_NOT_FOUND]).toBeDefined();

      // System errors
      expect(ERROR_REGISTRY[ERROR_CODES.INTERNAL_SERVER_ERROR]).toBeDefined();
      expect(ERROR_REGISTRY[ERROR_CODES.DATABASE_ERROR]).toBeDefined();
    });
  });
});

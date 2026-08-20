/**
 * Integration Tests for Shipping Profiles Endpoint
 * 
 * Tests error scenarios for shipping profiles endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import * as handlers from "./handlers";
import * as queries from "./queries";

// Mock the queries module
vi.mock("./queries");

// Mock the database
const mockDb = {} as any;
vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

describe("Shipping Profiles Endpoint - Error Scenarios", () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    app = new Hono<AppContext>();
    
    // Add middleware to inject mock env and user
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "admin",
        status: "active",
        apiKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      await next();
    });
    
    app.onError(errorHandler);
    app.get("/shipping-profiles", handlers.listProfiles);
    app.get("/shipping-profiles/default/rules", handlers.getDefaultRules);
    app.get("/shipping-profiles/:id", handlers.getProfile);
    app.post("/shipping-profiles", handlers.createProfile);
    app.patch("/shipping-profiles/:id", handlers.updateProfile);
    app.delete("/shipping-profiles/:id", handlers.deleteProfile);
    app.put("/shipping-profiles/:id/rules", handlers.setProfileRules);
    
    vi.clearAllMocks();
  });

  describe("GET /shipping-profiles/:id", () => {
    it("should return 404 with PROFILE_NOT_FOUND code when profile does not exist", async () => {
      // Mock getProfileById to return null
      vi.mocked(queries.getProfileById).mockResolvedValue(null);

      const res = await app.request("/shipping-profiles/profile_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "shipping_profile with ID profile_nonexistent not found",
        code: "SHIPPING_PROFILE_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "shipping_profile",
          id: "profile_nonexistent",
        },
      });
    });

    it("should return 200 with profile data when profile exists", async () => {
      // Mock successful response
      vi.mocked(queries.getProfileById).mockResolvedValue({
        id: "profile_123",
        name: "Standard Rates",
        isDefault: false,
        notes: null,
        productCount: 3,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        rules: [],
      });

      const res = await app.request("/shipping-profiles/profile_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "profile_123",
          name: "Standard Rates",
        }),
      });
    });
  });

  describe("PATCH /shipping-profiles/:id", () => {
    it("should return 404 with PROFILE_NOT_FOUND code when profile does not exist", async () => {
      // Mock updateProfile to return null
      vi.mocked(queries.updateProfile).mockResolvedValue(null);

      const res = await app.request("/shipping-profiles/profile_nonexistent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "shipping_profile with ID profile_nonexistent not found",
        code: "SHIPPING_PROFILE_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "shipping_profile",
          id: "profile_nonexistent",
        },
      });
    });

    it("should return 200 when profile is updated successfully", async () => {
      // Mock successful update
      vi.mocked(queries.updateProfile).mockResolvedValue({
        id: "profile_123",
        name: "Updated Rates",
        isDefault: false,
        notes: null,
        productCount: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-02").toISOString(),
        rules: [],
      });

      const res = await app.request("/shipping-profiles/profile_123", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Rates",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          name: "Updated Rates",
        }),
      });
    });
  });

  describe("DELETE /shipping-profiles/:id", () => {
    it("should return 404 with PROFILE_NOT_FOUND code when profile does not exist", async () => {
      // Mock getProfileById to return null
      vi.mocked(queries.getProfileById).mockResolvedValue(null);

      const res = await app.request("/shipping-profiles/profile_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "shipping_profile with ID profile_nonexistent not found",
        code: "SHIPPING_PROFILE_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "shipping_profile",
          id: "profile_nonexistent",
        },
      });
    });

    it("should return 422 with PROFILE_IN_USE code when profile is used by products", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue({
        id: "profile_123",
        name: "Standard Rates",
        isDefault: false,
        notes: null,
        productCount: 3,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        rules: [],
      });

      const res = await app.request("/shipping-profiles/profile_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Cannot delete shipping profile that is in use",
        code: ERROR_CODES.PROFILE_IN_USE,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          profileId: "profile_123",
          profileName: "Standard Rates",
          productCount: 3,
        },
      });
    });

    it("should return 422 with DEFAULT_PROFILE_REQUIRED code when deleting the default profile", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue({
        id: "profile_123",
        name: "Default Rates",
        isDefault: true,
        notes: null,
        productCount: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        rules: [],
      });

      const res = await app.request("/shipping-profiles/profile_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DEFAULT_PROFILE_REQUIRED,
      });
    });

    it("should return 200 when profile is deleted successfully (not in use)", async () => {
      // Mock getProfileById to return a profile with no usage
      vi.mocked(queries.getProfileById).mockResolvedValue({
        id: "profile_123",
        name: "Unused Profile",
        isDefault: false,
        notes: null,
        productCount: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        rules: [],
      });
      vi.mocked(queries.deleteProfile).mockResolvedValue(true);

      const res = await app.request("/shipping-profiles/profile_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
      });
    });
  });

  describe("PUT /shipping-profiles/:id/rules", () => {
    it("should return 404 with PROFILE_NOT_FOUND code when profile does not exist", async () => {
      // Mock setProfileRules to return null
      vi.mocked(queries.setProfileRules).mockResolvedValue(null);

      const res = await app.request("/shipping-profiles/profile_nonexistent/rules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rules: [
            { wilayaId: 16, homePrice: 300, stopDeskPrice: 250 },
          ],
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "shipping_profile with ID profile_nonexistent not found",
        code: "SHIPPING_PROFILE_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "shipping_profile",
          id: "profile_nonexistent",
        },
      });
    });

    it("should return 200 when rules are set successfully", async () => {
      // Mock successful rules update
      vi.mocked(queries.setProfileRules).mockResolvedValue({
        id: "profile_123",
        name: "Standard Rates",
        isDefault: false,
        notes: null,
        productCount: 0,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-02").toISOString(),
        rules: [
          {
            id: "rule_1",
            profileId: "profile_123",
            wilayaId: 16,
            wilayaName: "Alger",
            wilayaNameAr: "الجزائر",
            homePrice: 300,
            stopDeskPrice: 250,
            homeEnabled: true,
            stopDeskEnabled: false,
            createdAt: new Date("2024-01-02").toISOString(),
          },
        ],
      });

      const res = await app.request("/shipping-profiles/profile_123/rules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rules: [
            { wilayaId: 16, homePrice: 300, stopDeskPrice: 250 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: "profile_123",
          rules: expect.arrayContaining([
            expect.objectContaining({
              wilayaId: 16,
              homePrice: 300,
            }),
          ]),
        }),
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue(null);

      const res = await app.request("/shipping-profiles/profile_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("code");
      expect(body).toHaveProperty("category");
      expect(typeof body.error).toBe("string");
      expect(typeof body.code).toBe("string");
      expect(typeof body.category).toBe("string");
    });

    it("should include context field when available", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue({
        id: "profile_123",
        name: "Standard Rates",
        isDefault: false,
        notes: null,
        productCount: 5,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString(),
        rules: [],
      });

      const res = await app.request("/shipping-profiles/profile_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toMatchObject({
        profileId: "profile_123",
        profileName: "Standard Rates",
        productCount: 5,
      });
    });
  });
});

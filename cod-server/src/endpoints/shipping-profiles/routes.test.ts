/**
 * Route-level integration tests for Shipping Profiles OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import { BusinessLogicError, ValidationError } from "@/lib/errors/classes";
import shippingProfilesRouter from "./routes";
import * as queries from "./queries";

const mockDb = {
  select: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");

const mockUser = {
  id: "user_admin_001",
  name: "Admin User",
  role: "admin",
  scopes: ["delivery:read", "delivery:manage"],
};

const NOW = new Date().toISOString();

function profileWithRules(overrides: Record<string, any> = {}) {
  return {
    id: "profile_123",
    name: "Standard Rates",
    isDefault: false,
    notes: null,
    productCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    rules: [],
    ...overrides,
  };
}

function ruleRow(overrides: Record<string, any> = {}) {
  return {
    id: "rule_1",
    profileId: "profile_123",
    wilayaId: 16,
    wilayaName: "Alger",
    wilayaNameAr: "الجزائر",
    homePrice: 400,
    stopDeskPrice: 250,
    homeEnabled: true,
    stopDeskEnabled: false,
    createdAt: NOW,
    ...overrides,
  };
}

describe("Shipping Profiles routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", mockUser as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/shipping-profiles", shippingProfilesRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/shipping-profiles", () => {
    it("returns 200 with profiles and count", async () => {
      vi.mocked(queries.getAllProfiles).mockResolvedValue([
        {
          id: "profile_123",
          name: "Standard Rates",
          isDefault: true,
          notes: null,
          ruleCount: 58,
          productCount: 3,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);

      const res = await app.request("/api/shipping-profiles");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.data[0].ruleCount).toBe(58);
    });
  });

  describe("POST /api/shipping-profiles", () => {
    it("creates a profile successfully and returns 201", async () => {
      const created = profileWithRules({ isDefault: false });
      vi.mocked(queries.createProfile).mockResolvedValue(created);

      const res = await app.request("/api/shipping-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Standard Rates" }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: created });
    });

    it("returns 400 when name is missing or empty", async () => {
      const res = await app.request("/api/shipping-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });
  });

  describe("GET /api/shipping-profiles/default/rules", () => {
    it("returns 200 with default profile rules", async () => {
      vi.mocked(queries.getDefaultProfileRules).mockResolvedValue([ruleRow()]);

      const res = await app.request("/api/shipping-profiles/default/rules");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: [ruleRow()] });
    });
  });

  describe("GET /api/shipping-profiles/:id", () => {
    it("returns 200 with profile including rules", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue(
        profileWithRules({ rules: [ruleRow()] })
      );

      const res = await app.request("/api/shipping-profiles/profile_123");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.rules).toHaveLength(1);
    });

    it("returns 404 when profile is not found", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue(null);

      const res = await app.request("/api/shipping-profiles/profile_missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "SHIPPING_PROFILE_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/shipping-profiles/:id", () => {
    it("updates profile successfully", async () => {
      vi.mocked(queries.updateProfile).mockResolvedValue(
        profileWithRules({ name: "Updated Rates" })
      );

      const res = await app.request("/api/shipping-profiles/profile_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Rates" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.name).toBe("Updated Rates");
    });

    it("returns 422 when unsetting the last default profile", async () => {
      vi.mocked(queries.updateProfile).mockRejectedValue(
        new BusinessLogicError(
          "Cannot unset the last default shipping profile",
          ERROR_CODES.DEFAULT_PROFILE_REQUIRED,
          { profileId: "profile_123", profileName: "Standard Rates" }
        )
      );

      const res = await app.request("/api/shipping-profiles/profile_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: false }),
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DEFAULT_PROFILE_REQUIRED,
      });
    });

    it("returns 404 when profile is not found", async () => {
      vi.mocked(queries.updateProfile).mockResolvedValue(null);

      const res = await app.request("/api/shipping-profiles/profile_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Whatever" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/shipping-profiles/:id", () => {
    it("deletes unused non-default profile successfully", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue(profileWithRules());
      vi.mocked(queries.deleteProfile).mockResolvedValue(true);

      const res = await app.request("/api/shipping-profiles/profile_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("returns 422 PROFILE_IN_USE when profile is referenced by products", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue(
        profileWithRules({ productCount: 3 })
      );

      const res = await app.request("/api/shipping-profiles/profile_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.PROFILE_IN_USE,
        context: {
          profileId: "profile_123",
          profileName: "Standard Rates",
          productCount: 3,
        },
      });
    });

    it("returns 422 DEFAULT_PROFILE_REQUIRED when deleting the default profile", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue(
        profileWithRules({ isDefault: true })
      );

      const res = await app.request("/api/shipping-profiles/profile_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DEFAULT_PROFILE_REQUIRED,
      });
    });

    it("returns 404 when profile is not found", async () => {
      vi.mocked(queries.getProfileById).mockResolvedValue(null);

      const res = await app.request("/api/shipping-profiles/profile_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/shipping-profiles/:id/rules", () => {
    it("replaces rules successfully and returns profile with new rules", async () => {
      vi.mocked(queries.setProfileRules).mockResolvedValue(
        profileWithRules({ rules: [ruleRow()] })
      );

      const res = await app.request("/api/shipping-profiles/profile_123/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [{ wilayaId: 16, homePrice: 400, stopDeskPrice: 250 }],
        }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.rules).toHaveLength(1);
    });

    it("returns 400 DUPLICATE_WILAYA_RULE on duplicate wilayaId", async () => {
      vi.mocked(queries.setProfileRules).mockRejectedValue(
        new ValidationError(
          "Each wilaya may appear at most once in the rules array",
          ERROR_CODES.DUPLICATE_WILAYA_RULE,
          { profileId: "profile_123", duplicateWilayaIds: [16] }
        )
      );

      const res = await app.request("/api/shipping-profiles/profile_123/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            { wilayaId: 16 },
            { wilayaId: 16 },
          ],
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DUPLICATE_WILAYA_RULE,
      });
    });

    it("returns 400 for wilayaId out of range (route-level validation)", async () => {
      const res = await app.request("/api/shipping-profiles/profile_123/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [{ wilayaId: 99 }],
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 404 when profile is not found", async () => {
      vi.mocked(queries.setProfileRules).mockResolvedValue(null);

      const res = await app.request("/api/shipping-profiles/profile_missing/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: [{ wilayaId: 16 }] }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/shipping-profiles/:id/rules/:wilayaId/communes", () => {
    it("returns 200 with communes and effective values", async () => {
      vi.mocked(queries.getWilayaRule).mockResolvedValue(ruleRow());
      vi.mocked(queries.getCommunesWithOverrides).mockResolvedValue([
        {
          communeId: "16001",
          communeName: "Bab Ezzouar",
          communeNameAr: "باب الزوار",
          postalCode: "16111",
          homeEnabled: null,
          stopDeskEnabled: null,
          homePrice: null,
          stopDeskPrice: null,
          effectiveHomeEnabled: true,
          effectiveStopDeskEnabled: false,
          effectiveHomePrice: 400,
          effectiveStopDeskPrice: 250,
          hasOverride: false,
        },
      ]);

      const res = await app.request("/api/shipping-profiles/profile_123/rules/16/communes");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].hasOverride).toBe(false);
      expect(queries.getWilayaRule).toHaveBeenCalledWith(mockDb, "profile_123", 16);
    });

    it("returns 404 when the profile has no rule for this wilaya", async () => {
      vi.mocked(queries.getWilayaRule).mockResolvedValue(undefined);

      const res = await app.request("/api/shipping-profiles/profile_123/rules/31/communes");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "SHIPPING_RULE_NOT_FOUND",
      });
    });
  });

  describe("PUT /api/shipping-profiles/:id/rules/:wilayaId/communes/:communeId", () => {
    it("sets an override successfully", async () => {
      vi.mocked(queries.getWilayaRule).mockResolvedValue(ruleRow());
      vi.mocked(queries.setCommuneOverride).mockResolvedValue(undefined);

      const res = await app.request(
        "/api/shipping-profiles/profile_123/rules/16/communes/16001",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homePrice: 500 }),
        }
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("returns 404 when the profile has no rule for this wilaya", async () => {
      vi.mocked(queries.getWilayaRule).mockResolvedValue(undefined);

      const res = await app.request(
        "/api/shipping-profiles/profile_123/rules/16/communes/16001",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homePrice: 500 }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/shipping-profiles/:id/rules/:wilayaId/communes/:communeId", () => {
    it("removes an override successfully", async () => {
      vi.mocked(queries.getWilayaRule).mockResolvedValue(ruleRow());
      vi.mocked(queries.deleteCommuneOverride).mockResolvedValue(true);

      const res = await app.request(
        "/api/shipping-profiles/profile_123/rules/16/communes/16001",
        { method: "DELETE" }
      );

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("returns 404 when no override exists for the commune", async () => {
      vi.mocked(queries.getWilayaRule).mockResolvedValue(ruleRow());
      vi.mocked(queries.deleteCommuneOverride).mockResolvedValue(false);

      const res = await app.request(
        "/api/shipping-profiles/profile_123/rules/16/communes/16001",
        { method: "DELETE" }
      );

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "COMMUNE_OVERRIDE_NOT_FOUND",
      });
    });
  });
});

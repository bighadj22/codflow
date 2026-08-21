/**
 * Route-level integration tests for Stores OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import storesRouter from "./routes";
import * as queries from "./queries";
import * as pixelConfigQueries from "../../../../cod-shared/queries/pixel-config";

const mockDb = {
  select: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/pixel-config");

const NOW = new Date().toISOString();

function storeRow(overrides: Record<string, any> = {}) {
  return {
    id: "store_1",
    name: "My Shop",
    domain: null,
    logoUrl: "https://cdn.example.com/logo.png",
    themeId: "theme01",
    primaryColor: "#3b82f6",
    accentColor: "#f97316",
    bgColor: "#ffffff",
    fontFamily: "Cairo",
    fontUrl: "https://fonts.googleapis.com/css2?family=Cairo",
    lang: "ar" as const,
    currency: "DZD",
    currencySymbol: "دج",
    contentJson: null,
    metaTitle: "My Shop — Best Products",
    metaDescription: "Find the best products at My Shop.",
    ogImage: "https://cdn.example.com/og.png",
    announcementBar: "Free delivery on orders above 3000 دج",
    reviewsEnabled: true,
    status: "active" as const,
    storeApiKey: "sk_store_abc123",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function pixelConfigRow(overrides: Record<string, any> = {}) {
  return {
    id: "pix_1",
    storeId: "store_1",
    pixelId: "1234567890123456",
    accessToken: "EAAG...",
    testEventCode: null,
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Stores routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", {
        id: "admin_user_001",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: null,
        createdAt: NOW,
        updatedAt: NOW,
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/stores", storesRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/stores/me", () => {
    it("returns 200 with store configuration", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(storeRow());

      const res = await app.request("/api/stores/me");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("My Shop");
      expect(body.data.themeId).toBe("theme01");
    });

    it("returns 404 when no store exists", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(undefined);

      const res = await app.request("/api/stores/me");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: "STORE_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/stores/me", () => {
    it("updates store configuration successfully", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(storeRow());
      vi.mocked(queries.updateStore).mockResolvedValue(
        storeRow({ name: "Updated Shop" })
      );

      const res = await app.request("/api/stores/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Shop" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.name).toBe("Updated Shop");
    });

    it("returns 400 for invalid hex color", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(storeRow());

      const res = await app.request("/api/stores/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor: "not-a-color" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 404 when no store exists", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(undefined);

      const res = await app.request("/api/stores/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Whatever" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/stores/pixel-config", () => {
    it("returns 200 with pixel configuration", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(storeRow());
      vi.mocked(pixelConfigQueries.getPixelConfig).mockResolvedValue(pixelConfigRow());

      const res = await app.request("/api/stores/pixel-config");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.pixelId).toBe("1234567890123456");
      expect(body.data.enabled).toBe(true);
    });

    it("returns 200 with null data when not configured", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(storeRow());
      vi.mocked(pixelConfigQueries.getPixelConfig).mockResolvedValue(undefined);

      const res = await app.request("/api/stores/pixel-config");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toBeNull();
    });

    it("returns 404 when no store exists", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(undefined);

      const res = await app.request("/api/stores/pixel-config");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/stores/pixel-config", () => {
    it("saves pixel configuration successfully", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(storeRow());
      vi.mocked(pixelConfigQueries.upsertPixelConfig).mockResolvedValue(pixelConfigRow());

      const res = await app.request("/api/stores/pixel-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelId: "1234567890123456" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.pixelId).toBe("1234567890123456");
    });

    it("returns 400 when pixelId is missing", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(storeRow());

      const res = await app.request("/api/stores/pixel-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 404 when no store exists", async () => {
      vi.mocked(queries.getStore).mockResolvedValue(undefined);

      const res = await app.request("/api/stores/pixel-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelId: "123" }),
      });

      expect(res.status).toBe(404);
    });
  });
});

/**
 * Route-level integration tests for upsell-config (stores router).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import storesRouter from "./routes";
import * as queries from "./queries";
import * as upsellConfigQueries from "../../../../cod-shared/queries/upsell-config";

const mockDb = {
  select: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/upsell-config");

const NOW = new Date().toISOString();

function upsellConfigRow(overrides: Record<string, any> = {}) {
  return {
    storeId: "store_1",
    showInInlineCheckout: true,
    showInConfirmModal: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Upsell config routes (OpenAPIHono)", () => {
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
    vi.mocked(queries.getStore).mockResolvedValue({ id: "store_1", name: "My Shop" } as any);
    vi.clearAllMocks();
  });

  describe("GET /api/stores/upsell-config", () => {
    it("returns 200 with the saved config", async () => {
      vi.mocked(upsellConfigQueries.getUpsellConfig).mockResolvedValue(upsellConfigRow() as any);

      const res = await app.request("/api/stores/upsell-config");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.showInInlineCheckout).toBe(true);
      expect(body.data.showInConfirmModal).toBe(false);
    });

    it("returns 200 with null when the store never configured upsells", async () => {
      vi.mocked(upsellConfigQueries.getUpsellConfig).mockResolvedValue(undefined as any);

      const res = await app.request("/api/stores/upsell-config");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toBeNull();
    });
  });

  describe("POST /api/stores/upsell-config", () => {
    it("saves the config and echoes the stored row", async () => {
      vi.mocked(upsellConfigQueries.upsertUpsellConfig).mockResolvedValue(
        upsellConfigRow({ showInConfirmModal: true }) as any
      );

      const res = await app.request("/api/stores/upsell-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showInInlineCheckout: true, showInConfirmModal: true }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.showInConfirmModal).toBe(true);
      expect(upsellConfigQueries.upsertUpsellConfig).toHaveBeenCalledWith(
        mockDb,
        "store_1",
        expect.objectContaining({ showInInlineCheckout: true, showInConfirmModal: true })
      );
    });

    it("accepts a partial update (absent fields keep their value)", async () => {
      vi.mocked(upsellConfigQueries.upsertUpsellConfig).mockResolvedValue(
        upsellConfigRow() as any
      );

      const res = await app.request("/api/stores/upsell-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showInConfirmModal: false }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.showInConfirmModal).toBe(false);
      expect(upsellConfigQueries.upsertUpsellConfig).toHaveBeenCalledWith(
        mockDb,
        "store_1",
        expect.objectContaining({ showInConfirmModal: false })
      );
    });

    it("defaults the save to both-enabled when nothing is sent", async () => {
      vi.mocked(upsellConfigQueries.upsertUpsellConfig).mockResolvedValue(upsellConfigRow() as any);

      const res = await app.request("/api/stores/upsell-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(upsellConfigQueries.upsertUpsellConfig).toHaveBeenCalledWith(
        mockDb,
        "store_1",
        {}
      );
    });
  });
});
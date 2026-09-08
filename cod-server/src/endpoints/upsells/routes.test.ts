/**
 * Route-level integration tests for Product Upsells OpenAPIHono router.
 * Mocks the cod-shared upsell queries + the parent-product existence lookup.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { makeMockDb, f } from "@/test-utils/mock-db";
import upsellsRouter from "./routes";
import * as queries from "./queries";
import * as productQueries from "../products/queries";

let mockDb: any;
vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");
vi.mock("../products/queries");

const NOW = new Date().toISOString();

function upsellRow(overrides: Record<string, any> = {}) {
  return {
    id: "up_1",
    productId: "prod_1",
    upsellProductId: "prod_2",
    name: "Samsung Galaxy Buds",
    description: null,
    sku: "BUDS-WHITE",
    hasVariants: false,
    price: 8500,
    overridePrice: null,
    compareAtPrice: 9500,
    variantId: null,
    variantLabel: null,
    primaryImageSrc: null,
    isActive: true,
    position: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Product Upsells routes (OpenAPIHono)", () => {
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
        apiKey: "cod_admin_key",
        scopes: ["*"],
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/products", upsellsRouter);
    mockDb = makeMockDb([]);
    vi.clearAllMocks();
    vi.mocked(productQueries.getProductById).mockResolvedValue({ id: "prod_1" } as any);
  });

  describe("GET /api/products/{productId}/upsells", () => {
    it("returns 200 with resolved upsell offers", async () => {
      vi.mocked(queries.listProductUpsells).mockResolvedValue([upsellRow()] as any);

      const res = await app.request("/api/products/prod_1/upsells");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.data[0].name).toBe("Samsung Galaxy Buds");
      expect(queries.listProductUpsells).toHaveBeenCalledWith(mockDb, "prod_1");
    });

    it("returns 404 when the parent product does not exist", async () => {
      vi.mocked(productQueries.getProductById).mockResolvedValue(null as any);

      const res = await app.request("/api/products/missing/upsells");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("PRODUCT_NOT_FOUND");
    });
  });

  describe("POST /api/products/{productId}/upsells", () => {
    it("creates an assignment and returns the full list with 201", async () => {
      mockDb = makeMockDb([f({ id: "prod_3" })]);
      vi.mocked(queries.createProductUpsell).mockResolvedValue({
        duplicated: false,
        offers: [upsellRow({ id: "up_new" })],
      } as any);

      const res = await app.request("/api/products/prod_1/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellProductId: "prod_3", price: 7999 }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.data[0].id).toBe("up_new");
      expect(queries.createProductUpsell).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          productId: "prod_1",
          upsellProductId: "prod_3",
          price: 7999,
          compareAtPrice: null,
          isActive: true,
          position: 1,
        })
      );
    });

    it("rejects a self-referencing assignment with 400", async () => {
      const res = await app.request("/api/products/prod_1/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellProductId: "prod_1" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_FAILED");
      expect(queries.createProductUpsell).not.toHaveBeenCalled();
    });

    it("returns 404 when the upsell product does not exist", async () => {
      mockDb = makeMockDb([f(null)]);
      vi.mocked(productQueries.getProductById).mockImplementation(async (_db, id) =>
        id === "prod_1" ? ({ id: "prod_1" } as any) : null
      );

      const res = await app.request("/api/products/prod_1/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellProductId: "prod_missing" }),
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("returns 409 for a duplicate (product, upsell) pair", async () => {
      mockDb = makeMockDb([f({ id: "prod_2" })]);
      vi.mocked(queries.createProductUpsell).mockResolvedValue({ duplicated: true } as any);

      const res = await app.request("/api/products/prod_1/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellProductId: "prod_2" }),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body.code).toBe("DUPLICATE_ENTITY");
    });
  });

  describe("PATCH /api/products/{productId}/upsells/{upsellId}", () => {
    it("updates fields and returns the full list", async () => {
      vi.mocked(queries.updateProductUpsell).mockResolvedValue({
        productId: "prod_1",
        offers: [upsellRow({ isActive: false })],
      } as any);

      const res = await app.request("/api/products/prod_1/upsells/up_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, price: null }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data[0].isActive).toBe(false);
      expect(queries.updateProductUpsell).toHaveBeenCalledWith(
        mockDb,
        "up_1",
        expect.objectContaining({ isActive: false, price: null })
      );
    });

    it("returns 404 when the assignment is missing", async () => {
      vi.mocked(queries.updateProductUpsell).mockResolvedValue(null as any);

      const res = await app.request("/api/products/prod_1/upsells/up_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("PRODUCTUPSELL_NOT_FOUND");
    });

    it("returns 404 when the assignment belongs to another product", async () => {
      vi.mocked(queries.updateProductUpsell).mockResolvedValue({
        productId: "prod_other",
        offers: [],
      } as any);

      const res = await app.request("/api/products/prod_1/upsells/up_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/products/{productId}/upsells/{upsellId}", () => {
    it("deletes the assignment and returns the remaining list", async () => {
      vi.mocked(queries.deleteProductUpsell).mockResolvedValue({
        productId: "prod_1",
        offers: [],
      } as any);

      const res = await app.request("/api/products/prod_1/upsells/up_1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toEqual([]);
      expect(queries.deleteProductUpsell).toHaveBeenCalledWith(mockDb, "up_1");
    });

    it("returns 404 when the assignment is missing", async () => {
      vi.mocked(queries.deleteProductUpsell).mockResolvedValue(null as any);

      const res = await app.request("/api/products/prod_1/upsells/up_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
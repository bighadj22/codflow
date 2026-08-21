/**
 * Route-level integration tests for Products OpenAPIHono router
 * (product CRUD + nested images + variants).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CATEGORIES, ERROR_CODES } from "../../../../cod-shared/errors/codes";
import productsRouter from "./routes";
import * as queries from "./queries";
import * as variantQueries from "../variants/queries";
import { NotFoundError, BusinessLogicError, ConflictError } from "@/lib/errors/classes";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");
vi.mock("../variants/queries");
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(async () => {}),
  ACTIONS: {
    PRODUCT_CREATED: "product.created",
    PRODUCT_UPDATED: "product.updated",
    PRODUCT_STATUS_CHANGED: "product.status_changed",
    PRODUCT_DELETED: "product.deleted",
  },
}));
vi.mock("../images/handlers", () => ({
  listProductImages: async (c: any) =>
    c.json({ success: true, data: [imageRow()] }, 200),
  saveProductImage: async (c: any) => c.json({ success: true, data: imageRow() }, 201),
  reorderProductImages: async (c: any) =>
    c.json({ success: true, data: [imageRow()] }, 200),
  deleteProductImage: async (c: any) => c.json({ success: true }, 200),
}));

const NOW = new Date().toISOString();

let mockDb: any;

function dbSelectReturning(result: any) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => result),
          all: vi.fn(async () => (result ? [result] : [])),
        })),
      })),
    })),
  };
}

function productRow(overrides: Record<string, any> = {}) {
  return {
    id: "prod_1",
    name: "Samsung Galaxy A54",
    description: "6.4-inch display",
    handle: "samsung-galaxy-a54-1a2b3c4d",
    currency: "DZD",
    price: 45000,
    compareAtPrice: null,
    costPrice: null,
    type: "PHYSICAL",
    hasVariants: true,
    variantOptions: [{ name: "Color", values: [{ value: "Red", hexColor: "#FF0000" }] }],
    sku: null,
    inventory: 0,
    lowStockThreshold: 5,
    trackInventory: true,
    categoryId: null,
    tags: ["samsung"],
    visibility: true,
    status: "ACTIVE",
    showInStore: true,
    storeFeatured: false,
    deletedAt: null,
    publishedAt: NOW,
    shippingProfileId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function productListRow(overrides: Record<string, any> = {}) {
  return {
    ...productRow(overrides),
    variantsCount: 2,
    totalInventory: 30,
    primaryImageSrc: "https://cdn.example.com/products/abc123.jpg",
    reviewCount: 4,
    avgRating: 4.5,
    variants: [variantRow()],
  };
}

function productDetailRow(overrides: Record<string, any> = {}) {
  return {
    ...productRow(overrides),
    category: null,
    images: [imageRow()],
    variantsCount: 2,
    totalInventory: 30,
    variants: [variantRow()],
  };
}

function imageRow(overrides: Record<string, any> = {}) {
  return {
    id: "img_1",
    productId: "prod_1",
    src: "https://cdn.example.com/products/abc123.jpg",
    r2Key: "products/abc123.jpg",
    srcSm: null,
    srcMd: null,
    srcLg: null,
    altText: null,
    width: null,
    height: null,
    type: 1,
    position: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function variantRow(overrides: Record<string, any> = {}) {
  return {
    id: "var_1",
    productId: "prod_1",
    variations: { Color: "Red" },
    currency: "DZD",
    price: 45000,
    compareAtPrice: null,
    sku: "GALAXY-A54-RED",
    barcode: null,
    inventory: 15,
    lowStockThreshold: 5,
    weightKg: null,
    imageId: null,
    isDefault: false,
    active: true,
    position: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Products routes (OpenAPIHono)", () => {
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
    app.route("/api/products", productsRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  // ─── Product CRUD ───────────────────────────────────────────────────────────

  describe("GET /api/products", () => {
    it("returns 200 with a paginated list", async () => {
      vi.mocked(queries.getAllProducts).mockResolvedValue([productListRow()] as any);

      const res = await app.request("/api/products");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.data[0].name).toBe("Samsung Galaxy A54");
      expect(body.data[0].primaryImageSrc).toContain("https://");
    });

    it("passes filters through to the query", async () => {
      vi.mocked(queries.getAllProducts).mockResolvedValue([] as any);

      const res = await app.request("/api/products?status=ACTIVE&limit=10&offset=5");

      expect(res.status).toBe(200);
      expect(queries.getAllProducts).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ status: "ACTIVE", limit: 10, offset: 5 })
      );
    });

    it("returns 400 for an unknown status filter", async () => {
      const res = await app.request("/api/products?status=BOGUS");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.category).toBe(ERROR_CATEGORIES.VALIDATION);
    });
  });

  describe("POST /api/products", () => {
    const validSimpleProduct = {
      name: "Plain Tee",
      price: 2500,
      sku: "TEE-BASIC",
      hasVariants: false,
    };

    it("creates a simple product and returns 201", async () => {
      vi.mocked(queries.createProduct).mockResolvedValue(
        productDetailRow({ hasVariants: false, sku: "TEE-BASIC", name: "Plain Tee" }) as any
      );
      mockDb = dbSelectReturning(undefined);

      const res = await app.request("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSimpleProduct),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(queries.createProduct).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ name: "Plain Tee", sku: "TEE-BASIC" })
      );
    });

    it("applies schema defaults on create", async () => {
      vi.mocked(queries.createProduct).mockResolvedValue(productDetailRow() as any);
      mockDb = dbSelectReturning(undefined);

      await app.request("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Vary", price: 100, hasVariants: true }),
      });

      expect(queries.createProduct).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          type: "PHYSICAL",
          inventory: 0,
          trackInventory: true,
          visibility: true,
          status: "ACTIVE",
          showInStore: true,
          storeFeatured: false,
        })
      );
    });

    it("returns 409 for a duplicate SKU", async () => {
      mockDb = dbSelectReturning(productRow({ id: "existing_1", sku: "TEE-BASIC" }));

      const res = await app.request("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSimpleProduct),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.DUPLICATE_SKU);
    });

    it("rejects a simple product without SKU (superRefine)", async () => {
      const res = await app.request("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Sku", price: 100 }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.category).toBe(ERROR_CATEGORIES.VALIDATION);
    });

    it("rejects a missing price", async () => {
      const res = await app.request("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Price" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/products/{id}", () => {
    it("returns 200 with full detail including category, variants and images", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(productDetailRow() as any);

      const res = await app.request("/api/products/prod_1");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body.data.variants)).toBe(true);
      expect(Array.isArray(body.data.images)).toBe(true);
      expect(body.data.variants[0].variations).toEqual({ Color: "Red" });
    });

    it("returns 404 when the product does not exist", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(null as any);

      const res = await app.request("/api/products/missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("PRODUCT_NOT_FOUND");
      expect(body.category).toBe(ERROR_CATEGORIES.BUSINESS_LOGIC);
    });
  });

  describe("PATCH /api/products/{id}", () => {
    it("updates a product and returns 200 with the full record", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(
        productDetailRow({ name: "Renamed" }) as any
      );

      const res = await app.request("/api/products/prod_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.name).toBe("Renamed");
    });

    it("returns 400 for an invalid field value", async () => {
      const res = await app.request("/api/products/prod_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: -5 }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when updating a missing product", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(null as any);

      const res = await app.request("/api/products/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/products/{id}/status", () => {
    it("updates status only", async () => {
      vi.mocked(queries.updateProduct).mockResolvedValue(
        productDetailRow({ status: "ARCHIVED" }) as any
      );

      const res = await app.request("/api/products/prod_1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      expect(res.status).toBe(200);
      expect(queries.updateProduct).toHaveBeenCalledWith(mockDb, "prod_1", { status: "ARCHIVED" });
    });

    it("returns 400 for an invalid status", async () => {
      const res = await app.request("/api/products/prod_1/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/products/{id}", () => {
    it("soft-deletes when no orders reference the product", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(productRow() as any);
      vi.mocked(queries.deleteProduct).mockResolvedValue(undefined as any);
      mockDb = dbSelectReturning(undefined);

      const res = await app.request("/api/products/prod_1", { method: "DELETE" });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.message).toBe("Product deleted");
    });

    it("returns 422 when the product has orders", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(productRow() as any);
      mockDb = dbSelectReturning({ orderId: "ord_1", productId: "prod_1" });

      const res = await app.request("/api/products/prod_1", { method: "DELETE" });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.PRODUCT_HAS_ORDERS);
    });

    it("returns 404 when the product does not exist", async () => {
      vi.mocked(queries.getProductById).mockResolvedValue(null as any);

      const res = await app.request("/api/products/missing", { method: "DELETE" });

      expect(res.status).toBe(404);
    });
  });

  // ─── Product images ─────────────────────────────────────────────────────────

  describe("images routes", () => {
    it("GET /{id}/images returns 200 with ordered images", async () => {
      const res = await app.request("/api/products/prod_1/images");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data[0].position).toBe(1);
    });

    it("POST /{id}/images returns 201 after saving", async () => {
      const res = await app.request("/api/products/prod_1/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "products/new.jpg",
          src: "https://cdn.example.com/products/new.jpg",
        }),
      });

      expect(res.status).toBe(201);
    });

    it("POST /{id}/images returns 400 when key or src is missing", async () => {
      const res = await app.request("/api/products/prod_1/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: "https://cdn.example.com/x.jpg" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.category).toBe(ERROR_CATEGORIES.VALIDATION);
    });

    it("PATCH /{id}/images/reorder returns 400 for an empty array", async () => {
      const res = await app.request("/api/products/prod_1/images/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [] }),
      });

      expect(res.status).toBe(400);
    });

    it("DELETE /{id}/images/{imageId} returns 200", async () => {
      const res = await app.request("/api/products/prod_1/images/img_1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });
  });

  // ─── Variants ───────────────────────────────────────────────────────────────

  describe("variants routes", () => {
    it("GET /{productId}/variants returns 200 with count", async () => {
      vi.mocked(variantQueries.getVariantsByProduct).mockResolvedValue([
        variantRow(),
      ] as any);

      const res = await app.request("/api/products/prod_1/variants");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.count).toBe(1);
      expect(body.data[0].sku).toBe("GALAXY-A54-RED");
    });

    it("POST /{productId}/variants returns 201", async () => {
      vi.mocked(variantQueries.createVariant).mockResolvedValue(variantRow() as any);

      const res = await app.request("/api/products/prod_1/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variations: { Color: "Blue" },
          price: 45000,
          sku: "GALAXY-A54-BLUE",
        }),
      });

      expect(res.status).toBe(201);
      expect(variantQueries.createVariant).toHaveBeenCalledWith(
        mockDb,
        "prod_1",
        expect.objectContaining({ sku: "GALAXY-A54-BLUE", isDefault: false, active: true, position: 1 })
      );
    });

    it("POST /{productId}/variants returns 400 without sku", async () => {
      const res = await app.request("/api/products/prod_1/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variations: { Color: "Blue" }, price: 45000 }),
      });

      expect(res.status).toBe(400);
    });

    it("GET /{productId}/variants/{variantId} returns 404 for a missing variant", async () => {
      vi.mocked(variantQueries.getVariantById).mockResolvedValue(null as any);

      const res = await app.request("/api/products/prod_1/variants/missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("VARIANT_NOT_FOUND");
    });

    it("DELETE /{productId}/variants/{variantId} maps VARIANT_HAS_ORDERS guard to 422", async () => {
      vi.mocked(variantQueries.getVariantById).mockResolvedValue(variantRow() as any);
      vi.mocked(variantQueries.deleteVariant).mockRejectedValue(
        new BusinessLogicError(
          "Cannot delete variant referenced by existing orders",
          ERROR_CODES.VARIANT_HAS_ORDERS
        )
      );

      const res = await app.request("/api/products/prod_1/variants/var_1", {
        method: "DELETE",
      });

      expect(res.status).toBe(422);
    });
  });
});

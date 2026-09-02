/**
 * Route-level integration tests for Store API OpenAPIHono router
 * (public storefront surface behind X-Store-API-Key).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import storeRouter from "./routes";
import * as queries from "./queries";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");
vi.mock("@/lib/capi", () => ({ sendCapiEvent: vi.fn(async () => ({ success: true })) }));
// OTP verification defaults to disabled in these fixtures — the gate must be
// inert (no config row), exactly like a store that never enabled the feature.
vi.mock("../../../../cod-shared/queries/otp-config");

const NOW = new Date().toISOString();

let mockDb: any;

function listProductRow(overrides: Record<string, any> = {}) {
  return {
    id: "prod_1",
    name: "Samsung Galaxy A54",
    description: null,
    handle: "samsung-galaxy-a54",
    currency: "DZD",
    price: 45000,
    compareAtPrice: null,
    costPrice: null,
    type: "PHYSICAL",
    hasVariants: false,
    variantOptions: null,
    sku: "A54",
    inventory: 10,
    trackInventory: true,
    lowStockThreshold: 5,
    categoryId: null,
    tags: null,
    visibility: true,
    status: "ACTIVE",
    showInStore: true,
    storeFeatured: false,
    deletedAt: null,
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    coverImage: { id: "img_1", src: "https://cdn.example.com/a.jpg", position: 1 },
    reviewStats: { avgRating: 4.5, reviewCount: 12 },
    ...overrides,
  };
}

function detailRow(overrides: Record<string, any> = {}) {
  return {
    ...listProductRow(overrides),
    variantOptions: [{ name: "Color", values: [{ value: "Red" }] }],
    tags: ["sale"],
    category: {
      id: "cat_1", name: "Electronics", slug: "electronics", description: null,
      parentId: null, imageUrl: null, position: 0, createdAt: NOW, updatedAt: NOW,
    },
    variants: [],
    images: [],
    offers: [
      {
        id: "off_1",
        name: "Buy 2 Get 1",
        discountType: "free",
        triggerQuantity: 2,
        triggerVariantId: null,
        rewardQuantity: 1,
        rewardProductId: "prod_2",
        rewardProductName: "Galaxy Buds",
        rewardVariantId: null,
        rewardVariantLabel: null,
      },
    ],
  };
}

describe("Store API routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("storeId", "store_1");
      await next();
    });
    app.onError(errorHandler);
    app.route("/store", storeRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  describe("GET /store/config", () => {
    it("returns 200 with storefront configuration", async () => {
      vi.mocked(queries.getStoreConfig).mockResolvedValue({
        id: "store_1",
        name: "متجري",
        lang: "ar",
        reviewsEnabled: true,
      } as any);

      const res = await app.request("/store/config");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.name).toBe("متجري");
    });

    it("returns 404 when the store is missing", async () => {
      vi.mocked(queries.getStoreConfig).mockResolvedValue(null as any);

      const res = await app.request("/store/config");

      expect(res.status).toBe(404);
      expect((await res.json() as any).code).toBe("STORE_NOT_FOUND");
    });
  });

  describe("GET /store/products", () => {
    it("returns 200 with catalog and count", async () => {
      vi.mocked(queries.getStoreProducts).mockResolvedValue([listProductRow()] as any);

      const res = await app.request("/store/products?featured=true&limit=12");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.count).toBe(1);
      expect(body.data[0].coverImage).toBeDefined();
      expect(body.data[0].reviewStats.avgRating).toBe(4.5);
      expect(queries.getStoreProducts).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ featured: true, limit: 12 })
      );
    });
  });

  describe("GET /store/products/{handle}", () => {
    it("returns 200 with parsed detail incl. offers", async () => {
      vi.mocked(queries.getStoreProductByHandle).mockResolvedValue(detailRow() as any);

      const res = await app.request("/store/products/samsung-galaxy-a54");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body.data.variantOptions)).toBe(true);
      expect(Array.isArray(body.data.tags)).toBe(true);
      expect(body.data.offers[0].rewardProductName).toBe("Galaxy Buds");
    });

    it("returns 404 for an unknown handle", async () => {
      vi.mocked(queries.getStoreProductByHandle).mockResolvedValue(null as any);

      const res = await app.request("/store/products/unknown");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /store/communes/{wilayaId}", () => {
    it("returns 400 for an out-of-range wilaya", async () => {
      const res = await app.request("/store/communes/99");

      // Route-level param validation now rejects before the handler's
      // VALUE_OUT_OF_RANGE fallback can fire.
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    });

    it("returns communes for a valid wilaya", async () => {
      vi.mocked(queries.getStoreCommunes).mockResolvedValue([
        { id: "c-16-001", name: "Bab El Oued", nameAr: "باب الوادي" },
      ] as any);

      const res = await app.request("/store/communes/16");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data[0].id).toBe("c-16-001");
    });
  });

  describe("POST /store/orders", () => {
    const validOrder = {
      customerName: "أحمد بن علي",
      phone: "0551234567",
      wilayaId: 16,
      communeId: "16001",
      address: "Algiers",
      productId: "prod_1",
      productName: "Galaxy A54",
      quantity: 2,
      pricePerUnit: 4500,
    };

    it("creates an order and returns totals with 201", async () => {
      vi.mocked(queries.validateOrderSkus).mockResolvedValue(null as any);
      vi.mocked(queries.checkStoreOrderStock).mockResolvedValue(null as any);
      vi.mocked(queries.findOrCreateCustomer).mockResolvedValue({
        id: "cust_1",
        name: "أحمد بن علي",
      } as any);
      vi.mocked(queries.getDeliveryFee).mockResolvedValue(600 as any);
      vi.mocked(queries.createStoreOrder).mockResolvedValue({
        id: "ord_1",
        orderNumber: "ORD-20260821-0001",
        price: 9000,
        deliveryFee: 600,
      } as any);

      const res = await app.request("/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validOrder),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.data.total).toBe(9600);
    });

    it("surfaces insufficient stock as 422", async () => {
      vi.mocked(queries.validateOrderSkus).mockResolvedValue(null as any);
      vi.mocked(queries.checkStoreOrderStock).mockResolvedValue(
        "Not enough stock — available: 1"
      );

      const res = await app.request("/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validOrder),
      });

      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.INSUFFICIENT_STOCK);
    });

    it("rejects a missing phone with 400", async () => {
      const { phone, ...withoutPhone } = validOrder;

      const res = await app.request("/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withoutPhone),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /store/reviews", () => {
    it("returns 200 with approved reviews and total", async () => {
      vi.mocked(queries.getApprovedProductReviews).mockResolvedValue({
        rows: [
          { id: "rev_1", customerName: "Karim", rating: 5, title: null, body: "Great", createdAt: NOW },
        ],
        total: 7,
      } as any);

      const res = await app.request("/store/reviews?productId=prod_1");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.total).toBe(7);
    });

    it("returns 400 when productId is missing", async () => {
      const res = await app.request("/store/reviews");

      expect(res.status).toBe(400);
    });
  });

  describe("POST /store/reviews", () => {
    const validReview = {
      orderNumber: "ORD-20260327-0042",
      productId: "prod_1",
      rating: 5,
      body: "منتج رائع، جودة عالية!",
    };

    it("submits a review (pending moderation) with 201", async () => {
      vi.mocked(queries.findOrderForReview).mockResolvedValue({
        id: "ord_internal",
        orderNumber: "ORD-20260327-0042",
        customerName: "Ahmed Benali",
      } as any);
      vi.mocked(queries.getExistingReviewByOrder).mockResolvedValue(null as any);
      vi.mocked(queries.createReview).mockResolvedValue({ id: "rev_new" } as any);

      const res = await app.request("/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validReview),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.data.id).toBe("rev_new");
    });

    it("rejects a malformed order number with 400", async () => {
      const res = await app.request("/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validReview, orderNumber: "42" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the order number is unknown in this store", async () => {
      vi.mocked(queries.findOrderForReview).mockResolvedValue(null as any);

      const res = await app.request("/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validReview),
      });

      expect(res.status).toBe(404);
    });

    it("returns 409 for a duplicate review", async () => {
      vi.mocked(queries.findOrderForReview).mockResolvedValue({
        id: "ord_internal",
        orderNumber: "ORD-20260327-0042",
        customerName: "Ahmed Benali",
      } as any);
      vi.mocked(queries.getExistingReviewByOrder).mockResolvedValue({ id: "rev_dup" } as any);

      const res = await app.request("/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validReview),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.ORDER_ALREADY_REVIEWED);
    });
  });
});

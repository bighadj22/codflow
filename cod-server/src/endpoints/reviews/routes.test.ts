/**
 * Route-level tests for the reviews OpenAPIHono router.
 *
 * Tests mounting the router with OpenAPIHono and verifying response contracts,
 * status validation, and error envelopes.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import reviewsRouter from "./routes";
import * as queries from "./queries";

const mockDb = {} as any;
vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");

const mockUser = {
  id: "user_admin_001",
  name: "Admin User",
  role: "admin",
};

const NOW = new Date().toISOString();

function reviewRow(overrides: Record<string, any> = {}) {
  return {
    id: "rev_1",
    storeId: "store_1",
    productId: "prod_1",
    orderId: "order_1",
    orderNumber: "ORD-20240101-0042",
    customerName: "أحمد بن علي",
    rating: 5,
    title: "منتج ممتاز",
    body: "جودة عالية وسعر مناسب",
    status: "pending" as const,
    helpfulCount: 0,
    productName: "ساعة ذكية",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Reviews routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", mockUser as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/reviews", reviewsRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/reviews", () => {
    it("returns 200 with list of reviews and metadata", async () => {
      vi.mocked(queries.getAllReviews).mockResolvedValue({
        rows: [reviewRow()],
        total: 1,
        pendingCount: 1,
      });

      const res = await app.request("/api/reviews");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: [reviewRow()],
        count: 1,
        total: 1,
        pendingCount: 1,
      });
    });

    it("passes query parameters (status, productId, limit, offset) to queries.getAllReviews", async () => {
      vi.mocked(queries.getAllReviews).mockResolvedValue({
        rows: [],
        total: 0,
        pendingCount: 0,
      });

      const res = await app.request(
        "/api/reviews?status=approved&productId=prod_1&limit=10&offset=5"
      );

      expect(res.status).toBe(200);
      expect(queries.getAllReviews).toHaveBeenCalledWith(mockDb, {
        status: "approved",
        productId: "prod_1",
        limit: 10,
        offset: 5,
      });
    });

    it("returns 400 for invalid status enum in query", async () => {
      const res = await app.request("/api/reviews?status=invalid_status");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });
  });

  describe("PATCH /api/reviews/:id", () => {
    it("updates review status successfully", async () => {
      vi.mocked(queries.getReviewById).mockResolvedValue(reviewRow() as any);
      vi.mocked(queries.updateReviewStatus).mockResolvedValue(
        reviewRow({ status: "approved" }) as any
      );

      const res = await app.request("/api/reviews/rev_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("approved");
      expect(queries.updateReviewStatus).toHaveBeenCalledWith(mockDb, "rev_1", "approved");
    });

    it("returns 404 if review does not exist", async () => {
      vi.mocked(queries.getReviewById).mockResolvedValue(undefined);

      const res = await app.request("/api/reviews/rev_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.REVIEW_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });

    it("returns 400 if status is invalid", async () => {
      const res = await app.request("/api/reviews/rev_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid_status" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.category).toBe(ERROR_CATEGORIES.VALIDATION);
    });
  });

  describe("DELETE /api/reviews/:id", () => {
    it("deletes review successfully", async () => {
      vi.mocked(queries.getReviewById).mockResolvedValue(reviewRow() as any);
      vi.mocked(queries.deleteReview).mockResolvedValue(undefined as any);

      const res = await app.request("/api/reviews/rev_1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true });
      expect(queries.deleteReview).toHaveBeenCalledWith(mockDb, "rev_1");
    });

    it("returns 404 if review does not exist", async () => {
      vi.mocked(queries.getReviewById).mockResolvedValue(undefined);

      const res = await app.request("/api/reviews/rev_missing", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.REVIEW_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });
});

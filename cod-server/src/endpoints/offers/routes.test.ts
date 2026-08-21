/**
 * Route-level integration tests for Offers OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import offersRouter from "./routes";
import * as queries from "./queries";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");

const NOW = new Date().toISOString();

let mockDb: any;

function offerRow(overrides: Record<string, any> = {}) {
  return {
    id: "off_1",
    name: "اشتري 2 واحصل على 1 مجاناً",
    status: "active",
    triggerQuantity: 2,
    rewardQuantity: 1,
    discountType: "free",
    startsAt: null,
    endsAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    triggerProduct: {
      id: "prod_1",
      name: "Samsung Galaxy A54",
      handle: "samsung-galaxy-a54",
    },
    triggerVariant: null,
    rewardProduct: {
      id: "prod_2",
      name: "Samsung Galaxy Buds",
      handle: "samsung-galaxy-buds",
    },
    rewardVariant: null,
    ...overrides,
  };
}

describe("Offers routes (OpenAPIHono)", () => {
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
    app.route("/api/offers", offersRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  describe("GET /api/offers", () => {
    it("returns 200 with all offers and count", async () => {
      vi.mocked(queries.listOffers).mockResolvedValue([offerRow()] as any);

      const res = await app.request("/api/offers");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.data[0].triggerProduct.name).toBe("Samsung Galaxy A54");
    });
  });

  describe("GET /api/offers/{id}", () => {
    it("returns 200 with a resolved offer", async () => {
      vi.mocked(queries.getOfferById).mockResolvedValue(offerRow() as any);

      const res = await app.request("/api/offers/off_1");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.rewardProduct.handle).toBe("samsung-galaxy-buds");
    });

    it("returns 404 when the offer does not exist", async () => {
      vi.mocked(queries.getOfferById).mockResolvedValue(null as any);

      const res = await app.request("/api/offers/missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("OFFER_NOT_FOUND");
    });
  });

  describe("POST /api/offers", () => {
    it("creates an offer and returns the resolved record with 201", async () => {
      vi.mocked(queries.createOffer).mockResolvedValue({ id: "off_new" } as any);
      vi.mocked(queries.getOfferById).mockResolvedValue(
        offerRow({ id: "off_new" }) as any
      );

      const res = await app.request("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Buy 2 Get 1",
          discountType: "free",
          triggerProductId: "prod_1",
          triggerQuantity: 2,
          rewardProductId: "prod_2",
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.data.id).toBe("off_new");
      expect(queries.createOffer).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          name: "Buy 2 Get 1",
          discountType: "free",
          status: "active",
          rewardQuantity: 1,
        })
      );
    });

    it("applies schema defaults (discountType, rewardQuantity, status)", async () => {
      vi.mocked(queries.createOffer).mockResolvedValue({ id: "off_new" } as any);
      vi.mocked(queries.getOfferById).mockResolvedValue(offerRow() as any);

      await app.request("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Free Ship",
          triggerProductId: "prod_1",
          triggerQuantity: 1,
          rewardQuantity: 0,
          discountType: "free_shipping",
        }),
      });

      expect(queries.createOffer).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ discountType: "free_shipping", status: "active" })
      );
    });

    it("rejects 'free' type without rewardProductId (superRefine)", async () => {
      const res = await app.request("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bad Offer",
          discountType: "free",
          triggerProductId: "prod_1",
          triggerQuantity: 2,
        }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects a name shorter than 2 chars", async () => {
      const res = await app.request("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "x",
          discountType: "free_shipping",
          triggerProductId: "prod_1",
          triggerQuantity: 1,
          rewardQuantity: 0,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/offers/{id}", () => {
    it("updates an offer and returns the fresh record", async () => {
      vi.mocked(queries.getOfferById)
        .mockResolvedValueOnce(offerRow() as any) // existence check
        .mockResolvedValueOnce(offerRow({ name: "Renamed" }) as any); // re-fetch
      vi.mocked(queries.updateOffer).mockResolvedValue(undefined as any);

      const res = await app.request("/api/offers/off_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.name).toBe("Renamed");
    });

    it("rejects an invalid discountType value", async () => {
      const res = await app.request("/api/offers/off_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountType: "half_price" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when updating a missing offer", async () => {
      vi.mocked(queries.getOfferById).mockResolvedValue(null as any);

      const res = await app.request("/api/offers/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ghost" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/offers/{id}", () => {
    it("deletes an existing offer and returns 200", async () => {
      vi.mocked(queries.getOfferById).mockResolvedValue(offerRow() as any);
      vi.mocked(queries.deleteOffer).mockResolvedValue(undefined as any);

      const res = await app.request("/api/offers/off_1", { method: "DELETE" });

      expect(res.status).toBe(200);
      expect(queries.deleteOffer).toHaveBeenCalledWith(mockDb, "off_1");
    });

    it("returns 404 when deleting a missing offer", async () => {
      vi.mocked(queries.getOfferById).mockResolvedValue(null as any);

      const res = await app.request("/api/offers/missing", { method: "DELETE" });

      expect(res.status).toBe(404);
    });
  });
});

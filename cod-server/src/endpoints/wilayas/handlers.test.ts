/**
 * Integration Tests for Wilayas Endpoint
 * 
 * Tests error scenarios for wilayas and communes endpoints.
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

describe("Wilayas Endpoint - Error Scenarios", () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    app = new Hono<AppContext>();
    
    // Add middleware to inject mock env
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      await next();
    });
    
    app.onError(errorHandler);
    app.get("/wilayas", handlers.listWilayas);
    app.get("/wilayas/:id/communes", handlers.listCommunes);
    vi.clearAllMocks();
  });

  describe("GET /wilayas/:id/communes", () => {
    it("should return 400 with INVALID_FORMAT code for invalid wilaya ID (non-numeric)", async () => {
      const res = await app.request("/wilayas/abc/communes", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: expect.stringContaining("Invalid wilaya ID"),
        code: ERROR_CODES.INVALID_FORMAT,
        category: ERROR_CATEGORIES.VALIDATION,
        context: {
          wilayaId: "abc",
        },
      });
    });

    it("should return 400 with INVALID_FORMAT code for wilaya ID out of range (< 1)", async () => {
      const res = await app.request("/wilayas/0/communes", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: expect.stringContaining("Invalid wilaya ID"),
        code: ERROR_CODES.INVALID_FORMAT,
        category: ERROR_CATEGORIES.VALIDATION,
        context: {
          wilayaId: "0",
        },
      });
    });

    it("should return 400 with INVALID_FORMAT code for wilaya ID out of range (> 58)", async () => {
      const res = await app.request("/wilayas/99/communes", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: expect.stringContaining("Invalid wilaya ID"),
        code: ERROR_CODES.INVALID_FORMAT,
        category: ERROR_CATEGORIES.VALIDATION,
        context: {
          wilayaId: "99",
        },
      });
    });

    it("should return 404 with WILAYA_NOT_FOUND code when wilaya does not exist", async () => {
      // Mock getWilayaById to return null
      vi.mocked(queries.getWilayaById).mockResolvedValue(undefined);

      const res = await app.request("/wilayas/25/communes", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Wilaya with ID 25 not found",
        code: ERROR_CODES.WILAYA_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Wilaya",
          id: "25",
        },
      });
    });

    it("should return 200 with communes when wilaya exists", async () => {
      // Mock successful responses
      vi.mocked(queries.getWilayaById).mockResolvedValue({
        id: 16,
        name: "Alger",
        nameAr: "الجزائر",
      });
      vi.mocked(queries.getCommunesByWilaya).mockResolvedValue([
        { id: "16001", wilayaId: 16, name: "Alger Centre", nameAr: "الجزائر الوسطى", postalCode: null },
        { id: "16002", wilayaId: 16, name: "Bab El Oued", nameAr: "باب الواد", postalCode: null },
      ]);

      const res = await app.request("/wilayas/16/communes", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ name: "Alger Centre" }),
          expect.objectContaining({ name: "Bab El Oued" }),
        ]),
        count: 2,
      });
    });
  });

  describe("GET /wilayas", () => {
    it("should return 200 with all wilayas", async () => {
      // Mock successful response
      vi.mocked(queries.getAllWilayas).mockResolvedValue([
        { id: 1, name: "Adrar", nameAr: "أدرار" },
        { id: 2, name: "Chlef", nameAr: "الشلف" },
      ]);

      const res = await app.request("/wilayas", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ name: "Adrar" }),
          expect.objectContaining({ name: "Chlef" }),
        ]),
        count: 2,
      });
    });

    it("should return 200 with filtered wilayas when search parameter is provided", async () => {
      // Mock filtered response
      vi.mocked(queries.getAllWilayas).mockResolvedValue([
        { id: 16, name: "Alger", nameAr: "الجزائر" },
      ]);

      const res = await app.request("/wilayas?search=Alger", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ name: "Alger" }),
        ]),
        count: 1,
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      const res = await app.request("/wilayas/abc/communes", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("code");
      expect(body).toHaveProperty("category");
      expect(typeof body.error).toBe("string");
      expect(typeof body.code).toBe("string");
      expect(typeof body.category).toBe("string");
    });

    it("should include context field when available", async () => {
      const res = await app.request("/wilayas/abc/communes", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toMatchObject({
        wilayaId: "abc",
      });
    });
  });
});

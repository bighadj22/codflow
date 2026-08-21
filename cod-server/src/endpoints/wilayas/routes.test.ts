/**
 * Route-level tests for the wilayas OpenAPIHono router.
 *
 * Mounts the router the same way src/index.ts does (minus auth) and
 * asserts that the migration to @hono/zod-openapi preserved the exact
 * response/error contracts of the previous hand-routed version —
 * including the parseInt-based wilaya ID semantics.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import wilayasRouter from "./routes";
import * as queries from "./queries";

const mockDb = {} as any;
vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");

describe("Wilayas routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>();
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/wilayas", wilayasRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/wilayas", () => {
    it("returns 200 with the list envelope", async () => {
      vi.mocked(queries.getAllWilayas).mockResolvedValue([
        { id: 1, name: "Adrar", nameAr: "أدرار" },
        { id: 16, name: "Alger", nameAr: "الجزائر" },
      ]);

      const res = await app.request("/api/wilayas");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({
        success: true,
        data: [
          { id: 1, name: "Adrar", nameAr: "أدرار" },
          { id: 16, name: "Alger", nameAr: "الجزائر" },
        ],
        count: 2,
      });
    });

    it("passes the search filter through to the query", async () => {
      vi.mocked(queries.getAllWilayas).mockResolvedValue([]);

      const res = await app.request("/api/wilayas?search=Alger");

      expect(res.status).toBe(200);
      expect(queries.getAllWilayas).toHaveBeenCalledWith(mockDb, {
        search: "Alger",
      });
    });

    it("accepts unknown query params (stripped, not rejected)", async () => {
      vi.mocked(queries.getAllWilayas).mockResolvedValue([]);

      const res = await app.request("/api/wilayas?foo=bar");

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/wilayas/:id/communes", () => {
    it("returns 200 with communes for a valid wilaya", async () => {
      vi.mocked(queries.getWilayaById).mockResolvedValue({
        id: 16,
        name: "Alger",
        nameAr: "الجزائر",
      });
      vi.mocked(queries.getCommunesByWilaya).mockResolvedValue([
        { id: "16001", wilayaId: 16, name: "Alger Centre", nameAr: "الجزائر الوسطى", postalCode: null },
      ]);

      const res = await app.request("/api/wilayas/16/communes");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({ success: true, count: 1 });
      expect(queries.getWilayaById).toHaveBeenCalledWith(mockDb, 16);
    });

    it("returns 400 INVALID_FORMAT for a non-numeric ID", async () => {
      const res = await app.request("/api/wilayas/abc/communes");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Invalid wilaya ID — must be an integer between 1 and 58",
        code: ERROR_CODES.INVALID_FORMAT,
        category: ERROR_CATEGORIES.VALIDATION,
        context: { wilayaId: "abc" },
      });
      expect(queries.getWilayaById).not.toHaveBeenCalled();
    });

    it("returns 400 INVALID_FORMAT for ID below range", async () => {
      const res = await app.request("/api/wilayas/0/communes");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.INVALID_FORMAT,
        context: { wilayaId: "0" },
      });
    });

    it("returns 400 INVALID_FORMAT for ID above range", async () => {
      const res = await app.request("/api/wilayas/99/communes");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.INVALID_FORMAT,
        context: { wilayaId: "99" },
      });
    });

    it("preserves parseInt semantics for trailing garbage ('16abc' → wilaya 16)", async () => {
      vi.mocked(queries.getWilayaById).mockResolvedValue({
        id: 16,
        name: "Alger",
        nameAr: "الجزائر",
      });
      vi.mocked(queries.getCommunesByWilaya).mockResolvedValue([]);

      const res = await app.request("/api/wilayas/16abc/communes");

      expect(res.status).toBe(200);
      expect(queries.getWilayaById).toHaveBeenCalledWith(mockDb, 16);
    });

    it("returns 404 WILAYA_NOT_FOUND for a valid but missing wilaya", async () => {
      vi.mocked(queries.getWilayaById).mockResolvedValue(undefined);

      const res = await app.request("/api/wilayas/25/communes");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Wilaya with ID 25 not found",
        code: ERROR_CODES.WILAYA_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: { entity: "Wilaya", id: "25" },
      });
    });
  });
});

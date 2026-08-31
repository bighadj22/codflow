/**
 * Route-level integration tests for the Activity Logs defineRoute() router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import activityLogsRouter from "./routes";
import {
  listActivityLogs as queryActivityLogs,
  getUserActivityLogs as queryUserActivityLogs,
} from "../../../../cod-shared/queries/activity-logs";

const mockDb = { select: vi.fn() } as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("../../../../cod-shared/queries/activity-logs", () => ({
  listActivityLogs: vi.fn(),
  getUserActivityLogs: vi.fn(),
}));

const admin = { id: "user_admin_001", name: "Admin User", role: "admin", scopes: [] };
const staff = { id: "user_staff_001", name: "Amira Khalil", role: "staff", scopes: [] };

function makeApp(user: any) {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: mockDb } as any;
    if (user) c.set("user", user);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/activity-logs", activityLogsRouter);
  return app;
}

describe("Activity Logs routes (defineRoute)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/activity-logs", () => {
    it("returns 200 with logs for an admin", async () => {
      const rows = [{ id: "log_001" }];
      vi.mocked(queryActivityLogs).mockResolvedValue(rows as any);
      const app = makeApp(admin);

      const res = await app.request("/api/activity-logs?actorId=u1&entityType=order&limit=10&offset=5");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: rows, count: 1 });
      expect(queryActivityLogs).toHaveBeenCalledWith(mockDb, {
        actorId: "u1",
        entityType: "order",
        limit: 10,
        offset: 5,
      });
    });

    it("returns 400 for invalid query parameter (limit > 100)", async () => {
      const app = makeApp(admin);

      const res = await app.request("/api/activity-logs?limit=200");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.VALIDATION_FAILED,
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });

    it("returns 403 with the PERMISSION_DENIED envelope for non-admin", async () => {
      const app = makeApp(staff);

      const res = await app.request("/api/activity-logs");

      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.PERMISSION_DENIED,
        category: ERROR_CATEGORIES.AUTHENTICATION,
      });
      expect(queryActivityLogs).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/activity-logs/users/:userId", () => {
    it("returns 200 with user logs for an admin", async () => {
      const rows = [{ id: "log_002" }];
      vi.mocked(queryUserActivityLogs).mockResolvedValue(rows as any);
      const app = makeApp(admin);

      const res = await app.request("/api/activity-logs/users/u1?limit=5&offset=1");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ success: true, data: rows, count: 1 });
      expect(queryUserActivityLogs).toHaveBeenCalledWith(mockDb, "u1", { limit: 5, offset: 1 });
    });

    it("returns 403 with the PERMISSION_DENIED envelope for non-admin", async () => {
      const app = makeApp(staff);

      const res = await app.request("/api/activity-logs/users/u1");

      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.PERMISSION_DENIED,
        category: ERROR_CATEGORIES.AUTHENTICATION,
      });
      expect(queryUserActivityLogs).not.toHaveBeenCalled();
    });
  });
});

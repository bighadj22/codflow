/**
 * Route-level integration tests for the Analytics OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import analyticsRouter from "./routes";
import { getOrderStatusStats } from "../../../../cod-shared/queries/analytics";

const mockDb = {
  select: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("../../../../cod-shared/queries/analytics", () => ({
  getOrderStatusStats: vi.fn(),
}));

function makeApp(user: any) {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: mockDb } as any;
    if (user) c.set("user", user);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/analytics", analyticsRouter);
  return app;
}

describe("Analytics routes (defineRoute)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with status breakdown for a user holding dashboard:view", async () => {
    vi.mocked(getOrderStatusStats).mockResolvedValue([
      { status: "new", count: 12 },
      { status: "delivered", count: 5 },
    ]);
    const app = makeApp({ id: "u1", name: "Viewer", role: "viewer", scopes: ["dashboard:view"] });

    const res = await app.request("/api/analytics/dashboard-stats");

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toEqual({
      success: true,
      data: [
        { status: "new", count: 12 },
        { status: "delivered", count: 5 },
      ],
    });
    expect(getOrderStatusStats).toHaveBeenCalledWith(mockDb);
  });

  it("allows admin without explicit dashboard:view scope", async () => {
    vi.mocked(getOrderStatusStats).mockResolvedValue([]);
    const app = makeApp({ id: "u1", name: "Admin", role: "admin", scopes: [] });

    const res = await app.request("/api/analytics/dashboard-stats");

    expect(res.status).toBe(200);
  });

  it("returns 403 when the user lacks dashboard:view", async () => {
    const app = makeApp({ id: "u1", name: "Viewer", role: "viewer", scopes: ["orders:read"] });

    const res = await app.request("/api/analytics/dashboard-stats");

    expect(res.status).toBe(403);
    expect(getOrderStatusStats).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    const app = makeApp(null);

    const res = await app.request("/api/analytics/dashboard-stats");

    expect(res.status).toBe(401);
  });
});

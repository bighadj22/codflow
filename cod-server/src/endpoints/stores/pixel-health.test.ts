/**
 * GET /api/stores/pixel-config/health — admin-only delivery health.
 *
 * The route answers "did Meta accept our last event, and if not, why?" from
 * `capi_event_log`. It must stay admin-only (it is operational detail about the
 * ad account) and must never widen what the log already contains.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import storesRouter from "./routes";
import * as queries from "./queries";
import * as healthQueries from "../../../../cod-shared/queries/capi-health";

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({})),
}));
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/capi-health");

const NOW = "2026-10-26T12:00:00.000Z";

function healthFixture() {
  return {
    lastAttemptAt: NOW,
    lastSuccessAt: null,
    lastFailure: {
      eventName: "Purchase",
      stage: "checkout",
      httpStatus: 401,
      message: "Invalid OAuth access token - Cannot parse access token",
      at: NOW,
    },
    consecutiveFailures: 12,
    sentLast30Days: 0,
    failedLast30Days: 12,
  };
}

function buildApp(user: { role: string } | null) {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {} } as any;
    if (user) {
      c.set("user", {
        id: "user_1",
        email: "user@example.com",
        name: "User",
        role: user.role,
        status: "active",
        apiKey: null,
        createdAt: NOW,
        updatedAt: NOW,
      } as any);
    }
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/stores", storesRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/stores/pixel-config/health", () => {
  it("returns the delivery health for an admin", async () => {
    vi.mocked(queries.getStore).mockResolvedValue({ id: "store_1" } as any);
    vi.mocked(healthQueries.getCapiHealth).mockResolvedValue(healthFixture());

    const res = await buildApp({ role: "admin" }).request("/api/stores/pixel-config/health");

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(healthFixture());
  });

  it("refuses staff — the health of the ad account is admin detail", async () => {
    const res = await buildApp({ role: "viewer" }).request("/api/stores/pixel-config/health");

    expect(res.status).toBe(403);
    expect(healthQueries.getCapiHealth).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    const res = await buildApp(null).request("/api/stores/pixel-config/health");

    expect(res.status).toBe(401);
    expect(healthQueries.getCapiHealth).not.toHaveBeenCalled();
  });

  it("returns 404 when no store exists", async () => {
    vi.mocked(queries.getStore).mockResolvedValue(undefined);

    const res = await buildApp({ role: "admin" }).request("/api/stores/pixel-config/health");

    expect(res.status).toBe(404);
    expect(healthQueries.getCapiHealth).not.toHaveBeenCalled();
  });

  it("returns no token and no order identifier", async () => {
    vi.mocked(queries.getStore).mockResolvedValue({ id: "store_1" } as any);
    vi.mocked(healthQueries.getCapiHealth).mockResolvedValue(healthFixture());

    const res = await buildApp({ role: "admin" }).request("/api/stores/pixel-config/health");
    const raw = JSON.stringify(await res.json());

    expect(raw).not.toContain("EAA");
    expect(raw).not.toContain("order_");
    expect(raw).not.toContain("access_token");
  });
});

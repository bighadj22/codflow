/**
 * Delivery Companies — testCompanyConnection Handler Tests
 *
 * POST /api/delivery-companies/:id/test-connection
 * Covers: 404 unknown company, 422 no token, 422 provider without support,
 * 200 negative outcome (invalid token — check succeeded, not an error),
 * 200 positive outcome with EcoTrack enrichment passthrough,
 * 502 on carrier transport failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import deliveryCompaniesRouter from "./routes";
import * as queries from "./queries";
import * as registry from "./providers/registry";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("./queries");
vi.mock("./providers/registry");

function companyRow(overrides: Record<string, any> = {}) {
  return {
    id: "comp_1",
    name: "DHD Livraison",
    nameAr: "دي إتش دي للتوصيل",
    code: "dhd_ecotrack",
    website: null,
    active: true,
    apiEndpoint: "https://dhd.ecotrack.dz",
    apiToken: "tok",
    apiUserGuid: null,
    supportsHomeDelivery: 1,
    supportsStopDesk: 1,
    supportsTracking: 1,
    webhookSecret: null,
    webhookEndpointId: null,
    webhookStatusMapping: null,
    autoValidate: 0,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("POST /api/delivery-companies/:id/reconcile-orders", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: {} } as any;
      c.set("user", {
        id: "admin_1",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: "cod_key",
        scopes: ["*"],
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/delivery-companies", deliveryCompaniesRouter);
  });

  it("returns 400 when the company has no API token", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(
      companyRow({ apiToken: null, code: "dhd_ecotrack" }) as any
    );

    const res = await app.request("/api/delivery-companies/comp_1/reconcile-orders", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.MISSING_API_CREDENTIALS);
  });

  it("returns 422 for a non-EcoTrack provider (webhook-driven)", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(
      companyRow({ code: "noest" }) as any
    );
    vi.mocked(registry.isEcotrackCompany).mockReturnValue(false);

    const res = await app.request("/api/delivery-companies/comp_1/reconcile-orders", {
      method: "POST",
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OPERATION_NOT_SUPPORTED);
    expect(body.error).toMatch(/EcoTrack-only/i);
  });
});

describe("POST /api/delivery-companies/:id/test-connection", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: {} } as any;
      c.set("user", {
        id: "admin_1",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: "cod_key",
        scopes: ["*"],
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/delivery-companies", deliveryCompaniesRouter);
  });

  it("returns 404 for an unknown company", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(null as any);

    const res = await app.request("/api/delivery-companies/missing/test-connection", {
      method: "POST",
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 when the company has no API token (same as sibling sync handler)", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(
      companyRow({ apiToken: null }) as any
    );

    const res = await app.request("/api/delivery-companies/comp_1/test-connection", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.MISSING_API_CREDENTIALS);
  });

  it("returns 422 when the provider does not support connection testing", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(
      companyRow({ code: "noest" }) as any
    );
    vi.mocked(registry.getProvider).mockReturnValue({
      verifyConnection: undefined,
    } as any);

    const res = await app.request("/api/delivery-companies/comp_1/test-connection", {
      method: "POST",
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.OPERATION_NOT_SUPPORTED);
  });

  it("returns 200 with ok:false for an invalid token (negative check ≠ error)", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(companyRow() as any);
    vi.mocked(registry.getProvider).mockReturnValue({
      verifyConnection: vi.fn(async () => ({
        ok: false,
        code: "invalid_token",
        message: "Token is invalid",
      })),
    } as any);

    const res = await app.request("/api/delivery-companies/comp_1/test-connection", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.ok).toBe(false);
    expect(body.data.code).toBe("invalid_token");
    expect(body.data.companyCode).toBe("dhd_ecotrack");
  });

  it("returns 200 with enrichment details for a valid EcoTrack connection", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(companyRow() as any);
    vi.mocked(registry.getProvider).mockReturnValue({
      verifyConnection: vi.fn(async () => ({
        ok: true,
        code: "valid",
        message: "Token is valid",
        details: { servedWilayaIds: [1, 16, 31], servedWilayaCount: 3 },
      })),
    } as any);

    const res = await app.request("/api/delivery-companies/comp_1/test-connection", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.ok).toBe(true);
    expect(body.data.details.servedWilayaCount).toBe(3);
    expect(body.data.companyName).toBe("DHD Livraison");
  });

  it("returns 502 EXTERNAL_API_FAILURE when the carrier is unreachable", async () => {
    vi.mocked(queries.getDeliveryCompanyRaw).mockResolvedValue(companyRow() as any);
    vi.mocked(registry.getProvider).mockReturnValue({
      verifyConnection: vi.fn(async () => {
        throw new Error("EcoTrack HTTP 502 — response is not valid JSON");
      }),
    } as any);

    const res = await app.request("/api/delivery-companies/comp_1/test-connection", {
      method: "POST",
    });

    expect(res.status).toBe(502);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.EXTERNAL_API_FAILURE);
  });
});

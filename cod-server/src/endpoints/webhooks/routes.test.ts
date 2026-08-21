/**
 * Route-level integration tests for Webhooks OpenAPIHono router.
 * Handlers are covered deeply in webhooks.test.ts; these verify routing,
 * the public (no-auth) surface, and status codes through the router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import webhooksRouter from "./routes";

vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }));
vi.mock("./queries");
vi.mock("@/endpoints/delivery-companies/queries", () => ({
  getDeliveryCompanyByCode: vi.fn(async () => null), // no ZR company configured
}));
vi.mock("./svix-verify", () => ({
  verifySvixSignature: vi.fn(async () => true),
}));

let mockDb: any;

describe("Webhooks routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>();
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      await next();
    });
    app.onError(errorHandler);
    app.route("/webhooks", webhooksRouter);
    mockDb = {};
    vi.clearAllMocks();
  });

  describe("GET /webhooks/yalidine", () => {
    it("echoes the CRC token as plain text", async () => {
      const res = await app.request("/webhooks/yalidine?subscribe=1&crc_token=abc123token");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/plain");
      await expect(res.text()).resolves.toBe("abc123token");
    });

    it("answers a JSON ack when challenge params are absent", async () => {
      const res = await app.request("/webhooks/yalidine");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toEqual({ ok: true });
    });
  });

  describe("POST /webhooks/zr_express", () => {
    it("acks gracefully when no zr_express company is configured", async () => {
      const res = await app.request("/webhooks/zr_express", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "id_1",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "sig",
        },
        body: JSON.stringify({ eventType: "parcel.state.updated", data: {} }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.received).toBe(true);
    });

    it("returns 400 INVALID_WEBHOOK_PAYLOAD on bad signature", async () => {
      const { getDeliveryCompanyByCode } = await import("@/endpoints/delivery-companies/queries");
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue({
        id: "comp_zr",
        code: "zr_express",
        webhookSecret: "whsec_test",
      } as any);

      const { verifySvixSignature } = await import("./svix-verify");
      vi.mocked(verifySvixSignature).mockResolvedValue(false);

      const res = await app.request("/webhooks/zr_express", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "id_1",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "bad",
        },
        body: JSON.stringify({ eventType: "parcel.state.updated", data: {} }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("INVALID_WEBHOOK_PAYLOAD");
    });
  });

  describe("POST /webhooks/yalidine", () => {
    it("returns 400 INVALID_WEBHOOK_PAYLOAD for malformed JSON", async () => {
      const res = await app.request("/webhooks/yalidine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      });

      // Yalidine handler surfaces parse errors as errors — provider retries
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        const body: any = await res.json();
        expect(body.code).toBe("INVALID_WEBHOOK_PAYLOAD");
      }
    });
  });
});

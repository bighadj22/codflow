/**
 * Integration Tests for Webhooks Endpoint
 * 
 * Tests error scenarios for webhook endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import * as handlers from "./handlers";

// Mock the database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  all: vi.fn(),
  get: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn(),
  delete: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock delivery companies queries
vi.mock("@/endpoints/delivery-companies/queries", () => ({
  getDeliveryCompanyByCode: vi.fn(),
}));

// Mock webhook queries
vi.mock("./queries", () => ({
  insertWebhookEvent: vi.fn(),
  updateWebhookEvent: vi.fn(),
  getOrderByTracking: vi.fn(),
  getOrderByReference: vi.fn(),
}));

// Mock order queries
vi.mock("@/endpoints/orders/queries", () => ({
  updateOrderStatusWebhook: vi.fn(),
  incrementDeliveryAttempts: vi.fn(),
}));

// Mock Svix verification
vi.mock("./svix-verify", () => ({
  verifySvixSignature: vi.fn(),
}));

// Mock status mappers
vi.mock("./zr-status-mapper", () => ({
  mapZrStateName: vi.fn(),
  parseCustomMapping: vi.fn(),
}));

vi.mock("./yalidine-status-mapper", () => ({
  mapYalidineStatus: vi.fn(),
}));

vi.mock("@/workflows/capi-helpers", () => ({
  shouldTriggerCapiPurchase: vi.fn().mockReturnValue(false),
  resolveCapiDispatch: vi.fn(() => ({ send: false, reason: "tracking-disabled", message: "mock skip" })),
}));

import { getDeliveryCompanyByCode } from "@/endpoints/delivery-companies/queries";
import {
  insertWebhookEvent,
  updateWebhookEvent,
  getOrderByTracking,
  getOrderByReference,
} from "./queries";
import { updateOrderStatusWebhook } from "@/endpoints/orders/queries";
import { verifySvixSignature } from "./svix-verify";
import { mapZrStateName, parseCustomMapping } from "./zr-status-mapper";
import { mapYalidineStatus } from "./yalidine-status-mapper";

describe("Webhooks Endpoint - Error Scenarios", () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    app = new Hono<AppContext>();
    
    // Add middleware to inject mock env
    app.use("*", async (c, next) => {
      c.env = { 
        DB: mockDb,
      } as any;
      await next();
    });
    
    app.onError(errorHandler);
    app.post("/webhooks/zr_express", handlers.handleZrWebhook);
    app.get("/webhooks/yalidine", handlers.handleYalidineChallenge);
    app.post("/webhooks/yalidine", handlers.handleYalidineWebhook);
    
    vi.clearAllMocks();
  });

  describe("POST /webhooks/zr_express", () => {
    it("should return 400 with INVALID_WEBHOOK_PAYLOAD code when signature verification fails", async () => {
      const mockCompany = {
        id: "company_123",
        code: "zr_express",
        webhookSecret: "whsec_test123",
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);
      vi.mocked(verifySvixSignature).mockResolvedValue(false);

      const payload = {
        eventType: "parcel.state.updated",
        occurredAt: "2024-01-15T10:30:00.000Z",
        data: {
          trackingNumber: "ZR123456",
          state: { name: "Delivered" }
        }
      };

      const res = await app.request("/webhooks/zr_express", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test123",
          "svix-timestamp": "1234567890",
          "svix-signature": "v1,invalid_signature",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Invalid webhook signature",
        code: ERROR_CODES.INVALID_WEBHOOK_PAYLOAD,
        category: ERROR_CATEGORIES.VALIDATION,
        context: {
          provider: "zr_express",
        },
      });
    });

    it("should return 400 with INVALID_WEBHOOK_PAYLOAD code when JSON parsing fails", async () => {
      const mockCompany = {
        id: "company_123",
        code: "zr_express",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);

      const res = await app.request("/webhooks/zr_express", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test123",
          "svix-timestamp": "1234567890",
          "svix-signature": "v1,signature",
        },
        body: "invalid json {",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Invalid JSON payload",
        code: ERROR_CODES.INVALID_WEBHOOK_PAYLOAD,
        category: ERROR_CATEGORIES.VALIDATION,
        context: {
          provider: "zr_express",
        },
      });
    });

    it("should return 502 with EXTERNAL_API_FAILURE code when webhook processing fails", async () => {
      const mockCompany = {
        id: "company_123",
        code: "zr_express",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);
      vi.mocked(insertWebhookEvent).mockResolvedValue({
        id: "webhook_123",
        isDuplicate: false,
      } as any);
      vi.mocked(parseCustomMapping).mockReturnValue({});
      vi.mocked(mapZrStateName).mockReturnValue("delivered");
      vi.mocked(getOrderByTracking).mockRejectedValue(new Error("Database connection failed"));
      vi.mocked(updateWebhookEvent).mockResolvedValue(undefined as any);

      const payload = {
        eventType: "parcel.state.updated",
        occurredAt: "2024-01-15T10:30:00.000Z",
        data: {
          trackingNumber: "ZR123456",
          state: { name: "Delivered" }
        }
      };

      const res = await app.request("/webhooks/zr_express", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test123",
          "svix-timestamp": "1234567890",
          "svix-signature": "v1,signature",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(502);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "External API failure: zr_express - Webhook processing failed",
        code: ERROR_CODES.EXTERNAL_API_FAILURE,
        category: ERROR_CATEGORIES.SYSTEM,
      });
      expect(body.context).toHaveProperty("provider", "zr_express");
      expect(body.context).toHaveProperty("webhookId");
      expect(body.context).toHaveProperty("trackingNumber", "ZR123456");
      expect(body.context).toHaveProperty("errorMsg");
    });

    it("should return 200 when webhook is processed successfully", async () => {
      const mockCompany = {
        id: "company_123",
        code: "zr_express",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);
      vi.mocked(insertWebhookEvent).mockResolvedValue({
        id: "webhook_123",
        isDuplicate: false,
      } as any);
      vi.mocked(parseCustomMapping).mockReturnValue({});
      vi.mocked(mapZrStateName).mockReturnValue("delivered");
      vi.mocked(getOrderByTracking).mockResolvedValue({
        id: "order_123",
        trackingNumber: "ZR123456",
      } as any);
      vi.mocked(updateOrderStatusWebhook).mockResolvedValue({
        updated: true,
      } as any);
      vi.mocked(updateWebhookEvent).mockResolvedValue(undefined as any);

      const payload = {
        eventType: "parcel.state.updated",
        occurredAt: "2024-01-15T10:30:00.000Z",
        data: {
          trackingNumber: "ZR123456",
          state: { name: "Delivered" }
        }
      };

      const res = await app.request("/webhooks/zr_express", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test123",
          "svix-timestamp": "1234567890",
          "svix-signature": "v1,signature",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        received: true,
      });
    });
  });

  describe("GET /webhooks/yalidine", () => {
    it("should return 200 with crc_token when challenge is valid", async () => {
      const res = await app.request("/webhooks/yalidine?subscribe=true&crc_token=test_token_123", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("test_token_123");
    });

    it("should return 200 with ok when challenge params are missing", async () => {
      const res = await app.request("/webhooks/yalidine", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({ ok: true });
    });
  });

  describe("POST /webhooks/yalidine", () => {
    it("should return 400 with INVALID_WEBHOOK_PAYLOAD code when JSON parsing fails", async () => {
      const mockCompany = {
        id: "company_123",
        code: "yalidine",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);

      const res = await app.request("/webhooks/yalidine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json {",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Invalid JSON payload",
        code: ERROR_CODES.INVALID_WEBHOOK_PAYLOAD,
        category: ERROR_CATEGORIES.VALIDATION,
        context: {
          provider: "yalidine",
        },
      });
    });

    it("should return 502 with EXTERNAL_API_FAILURE code when webhook processing fails", async () => {
      const mockCompany = {
        id: "company_123",
        code: "yalidine",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);
      vi.mocked(insertWebhookEvent).mockResolvedValue({
        id: "webhook_123",
        isDuplicate: false,
      } as any);
      vi.mocked(mapYalidineStatus).mockReturnValue({
        status: "delivered",
        incrementAttempts: false,
      });
      vi.mocked(getOrderByTracking).mockRejectedValue(new Error("Database connection failed"));
      vi.mocked(updateWebhookEvent).mockResolvedValue(undefined as any);

      const payload = {
        type: "parcel_status_updated",
        events: [
          {
            event_id: "evt_test123",
            occurred_at: "2024-01-15 10:30:00",
            data: {
              tracking: "YAL123456",
              status: "41",
            }
          }
        ]
      };

      const res = await app.request("/webhooks/yalidine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(502);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "External API failure: yalidine - Webhook processing failed",
        code: ERROR_CODES.EXTERNAL_API_FAILURE,
        category: ERROR_CATEGORIES.SYSTEM,
      });
      expect(body.context).toHaveProperty("provider", "yalidine");
      expect(body.context).toHaveProperty("webhookId");
      expect(body.context).toHaveProperty("tracking", "YAL123456");
      expect(body.context).toHaveProperty("errorMsg");
    });

    it("should return 200 when webhook is processed successfully", async () => {
      const mockCompany = {
        id: "company_123",
        code: "yalidine",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);
      vi.mocked(insertWebhookEvent).mockResolvedValue({
        id: "webhook_123",
        isDuplicate: false,
      } as any);
      vi.mocked(mapYalidineStatus).mockReturnValue({
        status: "delivered",
        incrementAttempts: false,
      });
      vi.mocked(getOrderByTracking).mockResolvedValue({
        id: "order_123",
        trackingNumber: "YAL123456",
      } as any);
      vi.mocked(updateOrderStatusWebhook).mockResolvedValue({
        updated: true,
      } as any);
      vi.mocked(updateWebhookEvent).mockResolvedValue(undefined as any);

      const payload = {
        type: "parcel_status_updated",
        events: [
          {
            event_id: "evt_test123",
            occurred_at: "2024-01-15 10:30:00",
            data: {
              tracking: "YAL123456",
              status: "41",
            }
          }
        ]
      };

      const res = await app.request("/webhooks/yalidine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        received: true,
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      const mockCompany = {
        id: "company_123",
        code: "zr_express",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);

      const res = await app.request("/webhooks/zr_express", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test123",
          "svix-timestamp": "1234567890",
          "svix-signature": "v1,signature",
        },
        body: "invalid json {",
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

    it("should include context field with provider information", async () => {
      const mockCompany = {
        id: "company_123",
        code: "yalidine",
        webhookSecret: null,
      };
      
      vi.mocked(getDeliveryCompanyByCode).mockResolvedValue(mockCompany as any);

      const res = await app.request("/webhooks/yalidine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json {",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toHaveProperty("provider", "yalidine");
    });
  });
});

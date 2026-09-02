/**
 * OTP config endpoints — handler tests
 *
 * Covers the merchant settings surface:
 *   - scope guard (403 without SETTINGS_VERIFICATION, pass with it)
 *   - GET returns null when unconfigured, masked shape when configured
 *   - POST keeps the stored key on empty apiKey, rejects enabling with no key
 *   - test-connection outcome matrix (quota ok / invalid key / scope-missing
 *     quota / out of credits) — negative outcomes are 200s with ok:false
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import storesRouter from "./routes";
import * as storeQueries from "./queries";
import * as otpConfigQueries from "../../../../cod-shared/queries/otp-config";
import * as dzverify from "@/endpoints/store-otp/dzverify";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/otp-config");

function appWithUser(user: Record<string, unknown> | null) {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: {} } as any;
    if (user) c.set("user", user as any);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/stores", storesRouter);
  return app;
}

const ADMIN = { id: "u1", role: "admin", scopes: ["*"] };
const STAFF_WITH_SCOPE = { id: "u2", role: "staff", scopes: ["settings:verification"] };
const STAFF_WITHOUT_SCOPE = { id: "u3", role: "staff", scopes: ["orders:read"] };

const STORE = { id: "store-1", name: "Store" };

describe("OTP config endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storeQueries.getStore).mockResolvedValue(STORE as any);
  });

  describe("GET /api/stores/otp-config", () => {
    it("denies staff without the settings:verification scope (403)", async () => {
      const app = appWithUser(STAFF_WITHOUT_SCOPE);
      const res = await app.request("/api/stores/otp-config");
      expect(res.status).toBe(403);
    });

    it("allows staff holding the scope", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(STAFF_WITH_SCOPE);
      const res = await app.request("/api/stores/otp-config");
      expect(res.status).toBe(200);
    });

    it("returns null when never configured", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config");
      const body: any = await res.json();
      expect(body.data).toBeNull();
    });

    it("returns the masked shape — the API key never leaves the server", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
        storeId: "store-1",
        apiKey: "dz-super-secret-a9f2",
        language: "ar",
        enabled: true,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      } as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config");
      const body: any = await res.json();
      expect(body.data.apiKeyMasked).toBe("••••a9f2");
      expect(JSON.stringify(body)).not.toContain("dz-super-secret");
    });
  });

  describe("POST /api/stores/otp-config", () => {
    it("keeps the stored key when apiKey is empty", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
        storeId: "store-1", apiKey: "stored-key", language: "fr", enabled: false,
      } as any);
      vi.mocked(otpConfigQueries.upsertOtpConfig).mockResolvedValue({
        storeId: "store-1", language: "fr", enabled: true,
        createdAt: "t", updatedAt: "t",
      } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "", enabled: true }),
      });

      expect(res.status).toBe(200);
      expect(otpConfigQueries.upsertOtpConfig).toHaveBeenCalledWith(
        expect.anything(),
        "store-1",
        { apiKey: "stored-key", language: undefined, enabled: true }
      );
      const body: any = await res.json();
      expect(body.data.enabled).toBe(true);
    });

    it("rejects saving with no key at all (400 REQUIRED_FIELD_MISSING)", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.REQUIRED_FIELD_MISSING);
    });
  });

  describe("POST /api/stores/otp-config/test", () => {
    it("returns the quota snapshot for a valid key", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
        storeId: "store-1", apiKey: "stored-key", language: "ar", enabled: true,
      } as any);
      const quota = vi.fn(async () => ({
        balanceCentimes: 5000, balanceDa: 50, otpEstimate: 10, plan: "trial",
        trialGrantedAt: null, grantedAt: 1, updatedAt: 1,
      }));
      vi.spyOn(dzverify, "createDzverifyClient").mockReturnValue({ getQuota: quota } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body: any = await res.json();
      expect(body.data).toMatchObject({ ok: true, balanceDa: 50, otpEstimate: 10, plan: "trial" });
    });

    it("reports an invalid key as ok:false — the check succeeded", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
        storeId: "store-1", apiKey: "bad-key", language: "ar", enabled: true,
      } as any);
      const quota = vi.fn(async () => {
        throw new dzverify.DzverifyError("UNAUTHORIZED", "bad key", 401);
      });
      vi.spyOn(dzverify, "createDzverifyClient").mockReturnValue({ getQuota: quota } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.ok).toBe(false);
      expect(body.data.reason).toBe("invalid_key");
    });

    it("treats a valid key without usage:read as ok with a reason", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
        storeId: "store-1", apiKey: "scoped-key", language: "ar", enabled: true,
      } as any);
      const quota = vi.fn(async () => {
        throw new dzverify.DzverifyError("FORBIDDEN", "missing scope", 403);
      });
      vi.spyOn(dzverify, "createDzverifyClient").mockReturnValue({ getQuota: quota } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body: any = await res.json();
      expect(body.data.ok).toBe(true);
      expect(body.data.reason).toBe("quota_scope_missing");
    });

    it("flags out-of-credits distinctly (merchant needs to top up)", async () => {
      vi.mocked(otpConfigQueries.getOtpConfigRaw).mockResolvedValue({
        storeId: "store-1", apiKey: "broke-key", language: "ar", enabled: true,
      } as any);
      const quota = vi.fn(async () => {
        throw new dzverify.DzverifyError("OUT_OF_CREDITS", "no money", 402, { reason: "exhausted" });
      });
      vi.spyOn(dzverify, "createDzverifyClient").mockReturnValue({ getQuota: quota } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/otp-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body: any = await res.json();
      expect(body.data.ok).toBe(false);
      expect(body.data.outOfCredits).toBe(true);
    });
  });
});

/**
 * Email config endpoints — handler tests
 *
 * Covers the merchant settings surface:
 *   - scope guard (403 without SETTINGS_EMAIL, pass with it)
 *   - GET returns null when unconfigured, masked shape when configured
 *   - POST keeps the stored key on empty apiKey, rejects saving with no key,
 *     validates the from address
 *   - test-connection outcome matrix (account ok with domains for the
 *     picker / invalid key / forbidden / out of credits) — negative
 *     outcomes are 200s with ok:false
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import storesRouter from "./routes";
import * as storeQueries from "./queries";
import * as emailConfigQueries from "../../../../cod-shared/queries/email-config";
import * as sendili from "../../../../cod-shared/lib/sendili";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/email-config");

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
const STAFF_WITH_SCOPE = { id: "u2", role: "staff", scopes: ["settings:email"] };
const STAFF_WITHOUT_SCOPE = { id: "u3", role: "staff", scopes: ["orders:read"] };

const STORE = { id: "store-1", name: "Store" };

function storedConfig(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "store-1",
    apiKey: "sk_live_super-secret-a9f2",
    fromEmail: "noreply@acme.com",
    fromName: "Acme",
    enabled: true,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function mockAccount(domains: string[] = ["acme.com"]) {
  return vi.fn(async () => ({ domains, raw: { domains } }));
}

describe("Email config endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storeQueries.getStore).mockResolvedValue(STORE as any);
  });

  describe("GET /api/stores/email-config", () => {
    it("denies staff without the settings:email scope (403)", async () => {
      const app = appWithUser(STAFF_WITHOUT_SCOPE);
      const res = await app.request("/api/stores/email-config");
      expect(res.status).toBe(403);
    });

    it("allows staff holding the scope", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(STAFF_WITH_SCOPE);
      const res = await app.request("/api/stores/email-config");
      expect(res.status).toBe(200);
    });

    it("returns null when never configured", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config");
      const body: any = await res.json();
      expect(body.data).toBeNull();
    });

    it("returns the masked shape — the API key never leaves the server", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config");
      const body: any = await res.json();
      expect(body.data.apiKeyMasked).toBe("••••a9f2");
      expect(body.data.fromEmail).toBe("noreply@acme.com");
      expect(JSON.stringify(body)).not.toContain("sk_live_super-secret");
    });
  });

  describe("POST /api/stores/email-config", () => {
    it("keeps the stored key when apiKey is empty", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(
        storedConfig({ enabled: false }) as any
      );
      vi.mocked(emailConfigQueries.upsertEmailConfig).mockResolvedValue({
        storeId: "store-1",
        fromEmail: "noreply@acme.com",
        fromName: "Acme",
        enabled: true,
        createdAt: "t",
        updatedAt: "t",
      } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "", fromEmail: "noreply@acme.com", enabled: true }),
      });

      expect(res.status).toBe(200);
      expect(emailConfigQueries.upsertEmailConfig).toHaveBeenCalledWith(
        expect.anything(),
        "store-1",
        { apiKey: "sk_live_super-secret-a9f2", fromEmail: "noreply@acme.com", fromName: undefined, enabled: true }
      );
    });

    it("rejects saving with no key at all (400 REQUIRED_FIELD_MISSING)", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromEmail: "noreply@acme.com", enabled: true }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.REQUIRED_FIELD_MISSING);
    });

    it("rejects an invalid from address (400 validation)", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "", fromEmail: "not-an-email", enabled: true }),
      });

      expect(res.status).toBe(400);
      expect(emailConfigQueries.upsertEmailConfig).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/stores/email-config/test", () => {
    it("returns ok with the verified domains for the picker", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      const getAccount = mockAccount(["acme.com", "mail.acme.com"]);
      vi.spyOn(sendili, "createSendiliClient").mockReturnValue({ getAccount } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body: any = await res.json();
      expect(body.data.ok).toBe(true);
      expect(body.data.domains).toEqual(["acme.com", "mail.acme.com"]);
    });

    it("prefers a submitted key over the stored one (pre-save validation)", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      const getAccount = mockAccount();
      vi.spyOn(sendili, "createSendiliClient").mockReturnValue({ getAccount } as any);

      const app = appWithUser(ADMIN);
      await app.request("/api/stores/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "sk_live_submitted" }),
      });

      expect(sendili.createSendiliClient).toHaveBeenCalledWith("sk_live_submitted");
    });

    it("reports an invalid key as ok:false — the check succeeded", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      const getAccount = vi.fn(async () => {
        throw new sendili.SendiliError("UNAUTHORIZED", "Unknown API key", 401);
      });
      vi.spyOn(sendili, "createSendiliClient").mockReturnValue({ getAccount } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.ok).toBe(false);
      expect(body.data.reason).toBe("invalid_key");
    });

    it("surfaces FORBIDDEN (domain unverified / sending disabled) as ok:false with the code", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      const getAccount = vi.fn(async () => {
        throw new sendili.SendiliError("FORBIDDEN", "sender domain not verified", 403);
      });
      vi.spyOn(sendili, "createSendiliClient").mockReturnValue({ getAccount } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body: any = await res.json();
      expect(body.data.ok).toBe(false);
      expect(body.data.reason).toBe("FORBIDDEN");
    });

    it("flags out-of-credits distinctly (merchant needs to top up)", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(storedConfig() as any);
      const getAccount = vi.fn(async () => {
        throw new sendili.SendiliError("OUT_OF_CREDITS", "cost 1, balance 0", 402);
      });
      vi.spyOn(sendili, "createSendiliClient").mockReturnValue({ getAccount } as any);

      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body: any = await res.json();
      expect(body.data.ok).toBe(false);
      expect(body.data.outOfCredits).toBe(true);
    });

    it("requires a stored or submitted key (400 REQUIRED_FIELD_MISSING)", async () => {
      vi.mocked(emailConfigQueries.getEmailConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.REQUIRED_FIELD_MISSING);
    });
  });
});

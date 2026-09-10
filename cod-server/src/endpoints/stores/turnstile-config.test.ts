/**
 * Turnstile config endpoints — handler tests
 *
 * Covers the merchant settings surface:
 *   - scope guard (403 without SETTINGS_VERIFICATION, pass with it)
 *   - GET returns null when unconfigured, masked shape when configured
 *   - POST keeps stored site/secret keys on empty fields
 *   - POST rejects enabling with no keys stored or submitted
 *   - the secret key never leaves the server (masked hint only)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import storesRouter from "./routes";
import * as storeQueries from "./queries";
import * as turnstileConfigQueries from "../../../../cod-shared/queries/turnstile-config";

vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("./queries");
vi.mock("../../../../cod-shared/queries/turnstile-config");

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

function configuredRow() {
  return {
    storeId: "store-1",
    siteKey: "0x4AAA-site-key",
    secretKey: "0x4AAA-super-secret-a9f2",
    enabled: true,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };
}

describe("Turnstile config endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storeQueries.getStore).mockResolvedValue(STORE as any);
  });

  describe("GET /api/stores/turnstile-config", () => {
    it("denies staff without the settings:verification scope (403)", async () => {
      const app = appWithUser(STAFF_WITHOUT_SCOPE);
      const res = await app.request("/api/stores/turnstile-config");
      expect(res.status).toBe(403);
    });

    it("allows staff holding the scope", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(STAFF_WITH_SCOPE);
      const res = await app.request("/api/stores/turnstile-config");
      expect(res.status).toBe(200);
    });

    it("returns null when never configured", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config");
      const body: any = await res.json();
      expect(body.data).toBeNull();
    });

    it("returns the masked shape — the secret never leaves the server", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(configuredRow() as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config");
      const body: any = await res.json();
      expect(body.data.secretKeyMasked).toBe("••••a9f2");
      expect(body.data.siteKey).toBe("0x4AAA-site-key");
      expect(body.data.enabled).toBe(true);
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("0x4AAA-super-secret-a9f2");
      expect(serialized).not.toContain("secretKey\"");
    });

    it("returns 404 when the store does not exist", async () => {
      vi.mocked(storeQueries.getStore).mockResolvedValue(null as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/stores/turnstile-config", () => {
    it("denies staff without the settings:verification scope (403)", async () => {
      const app = appWithUser(STAFF_WITHOUT_SCOPE);
      const res = await app.request("/api/stores/turnstile-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteKey: "0x4AAA-site", secretKey: "0x4AAA-secret", enabled: true }),
      });
      expect(res.status).toBe(403);
    });

    it("saves a full configuration and returns the masked shape", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(undefined as any);
      vi.mocked(turnstileConfigQueries.upsertTurnstileConfig).mockResolvedValue({
        storeId: "store-1",
        siteKey: "0x4AAA-site",
        enabled: true,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      } as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteKey: "0x4AAA-site", secretKey: "0x4AAA-secret", enabled: true }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toMatchObject({ siteKey: "0x4AAA-site", enabled: true, secretKeyMasked: "••••cret" });
      expect(turnstileConfigQueries.upsertTurnstileConfig).toHaveBeenCalledWith(
        expect.anything(),
        "store-1",
        { siteKey: "0x4AAA-site", secretKey: "0x4AAA-secret", enabled: true }
      );
    });

    it("keeps the stored site/secret keys when the fields are empty", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(configuredRow() as any);
      vi.mocked(turnstileConfigQueries.upsertTurnstileConfig).mockResolvedValue({
        storeId: "store-1",
        siteKey: "0x4AAA-site-key",
        enabled: false,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      } as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      expect(turnstileConfigQueries.upsertTurnstileConfig).toHaveBeenCalledWith(
        expect.anything(),
        "store-1",
        { siteKey: "0x4AAA-site-key", secretKey: "0x4AAA-super-secret-a9f2", enabled: false }
      );
      const body: any = await res.json();
      expect(body.data.secretKeyMasked).toBe("••••a9f2");
    });

    it("rejects enabling with no keys stored or submitted (400 REQUIRED_FIELD_MISSING)", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("REQUIRED_FIELD_MISSING");
      expect(turnstileConfigQueries.upsertTurnstileConfig).not.toHaveBeenCalled();
    });

    it("rejects a secret-only save with no stored site key (both keys are required)", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(undefined as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: "0x4AAA-secret", enabled: true }),
      });

      expect(res.status).toBe(400);
      expect(turnstileConfigQueries.upsertTurnstileConfig).not.toHaveBeenCalled();
    });

    it("keeps stored keys when saving with whitespace-only fields", async () => {
      vi.mocked(turnstileConfigQueries.getTurnstileConfigRaw).mockResolvedValue(configuredRow() as any);
      vi.mocked(turnstileConfigQueries.upsertTurnstileConfig).mockResolvedValue({
        storeId: "store-1",
        siteKey: "0x4AAA-site-key",
        enabled: true,
        createdAt: "t",
        updatedAt: "t",
      } as any);
      const app = appWithUser(ADMIN);
      const res = await app.request("/api/stores/turnstile-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteKey: "   ", secretKey: "", enabled: true }),
      });

      expect(res.status).toBe(200);
      expect(turnstileConfigQueries.upsertTurnstileConfig).toHaveBeenCalledWith(
        expect.anything(),
        "store-1",
        { siteKey: "0x4AAA-site-key", secretKey: "0x4AAA-super-secret-a9f2", enabled: true }
      );
    });
  });
});

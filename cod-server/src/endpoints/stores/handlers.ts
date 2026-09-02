import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { updateStoreSchema } from "./validation";
import { NotFoundError, SystemError, ValidationError, ExternalApiError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { getPixelConfig as queryPixelConfig, upsertPixelConfig } from "../../../../cod-shared/queries/pixel-config";
import { getOtpConfigRaw, upsertOtpConfig } from "../../../../cod-shared/queries/otp-config";
import { createDzverifyClient, DzverifyError, DZVERIFY_ERRORS } from "@/endpoints/store-otp/dzverify";
import { z } from "zod";

export async function getMyStore(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  
  if (!store) {
    throw new NotFoundError("Store");
  }
  
  return c.json({ success: true, data: store }, 200);
}

export async function updateMyStore(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);

  if (!store) {
    throw new NotFoundError("Store");
  }

  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? updateStoreSchema.parse(await c.req.json());
  const updated = await queries.updateStore(db, store.id, validated);
  if (!updated) {
    throw new SystemError("Failed to update store");
  }
  return c.json({ success: true, data: updated }, 200);
}

const pixelConfigSchema = z.object({
  pixelId: z.string().min(1),
  accessToken: z.string().default(""),
  testEventCode: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export async function getPixelConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");
  const config = await queryPixelConfig(db, store.id);
  return c.json({ success: true, data: config ?? null }, 200);
}

export async function savePixelConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");
  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? pixelConfigSchema.parse(await c.req.json());
  const result = await upsertPixelConfig(db, store.id, validated);
  if (!result) {
    throw new SystemError("Failed to save pixel config");
  }
  return c.json({ success: true, data: result }, 200);
}

// ─── WhatsApp OTP verification config (dzverify) ──────────────────────────────

const otpConfigSchema = z.object({
  /** Empty string = keep the existing stored key (dashboard never re-sends it). */
  apiKey: z.string().default(""),
  language: z.enum(["en", "fr", "ar"]).optional(),
  enabled: z.boolean().optional(),
});

/** Response shape: the safe config plus a masked key hint for the UI. */
function maskApiKey(key: string): string {
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

export async function getOtpConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");

  const raw = await getOtpConfigRaw(db, store.id);
  if (!raw) return c.json({ success: true, data: null }, 200);

  return c.json(
    {
      success: true,
      data: {
        language: raw.language,
        enabled: raw.enabled,
        apiKeyMasked: maskApiKey(raw.apiKey),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
    },
    200
  );
}

export async function saveOtpConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");

  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? otpConfigSchema.parse(await c.req.json());

  const existing = await getOtpConfigRaw(db, store.id);
  const apiKey = validated.apiKey.trim() || existing?.apiKey || "";
  if (!apiKey) {
    throw new ValidationError(
      "A dzverify API key is required to enable WhatsApp OTP verification",
      ERROR_CODES.REQUIRED_FIELD_MISSING
    );
  }

  const result = await upsertOtpConfig(db, store.id, {
    apiKey,
    language: validated.language,
    enabled: validated.enabled,
  });

  return c.json(
    {
      success: true,
      data: {
        language: result.language,
        enabled: result.enabled,
        apiKeyMasked: maskApiKey(apiKey),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    },
    200
  );
}

/**
 * POST /api/stores/otp-config/test
 * Checks the stored (or submitted) dzverify key against the quota endpoint.
 * A working key without the usage:read scope is reported as
 * "key valid, quota unavailable" rather than a failure.
 */
export async function testOtpConnection(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");

  const jsonBody: any = (c.req as any).valid?.("json");
  const submittedKey = (jsonBody?.apiKey ?? "").trim();
  const existing = await getOtpConfigRaw(db, store.id);
  const apiKey = submittedKey || existing?.apiKey;
  if (!apiKey) {
    throw new ValidationError(
      "Save a dzverify API key first",
      ERROR_CODES.REQUIRED_FIELD_MISSING
    );
  }

  const client = createDzverifyClient(apiKey);
  try {
    const quota = await client.getQuota();
    return c.json(
      {
        success: true,
        data: {
          ok: true,
          balanceDa: quota.balanceDa,
          otpEstimate: quota.otpEstimate,
          plan: quota.plan,
        },
      },
      200
    );
  } catch (err) {
    if (err instanceof DzverifyError) {
      if (err.code === DZVERIFY_ERRORS.UNAUTHORIZED) {
        return c.json(
          { success: true, data: { ok: false, reason: "invalid_key", message: "The API key was rejected by dzverify" } },
          200
        );
      }
      if (err.code === DZVERIFY_ERRORS.FORBIDDEN) {
        return c.json(
          {
            success: true,
            data: {
              ok: true,
              reason: "quota_scope_missing",
              message: "Key is valid but lacks the usage:read scope — quota preview unavailable",
            },
          },
          200
        );
      }
      return c.json(
        {
          success: true,
          data: {
            ok: false,
            reason: err.code,
            message: err.message,
            ...(err.isOutOfCredits ? { outOfCredits: true } : {}),
          },
        },
        200
      );
    }
    throw new ExternalApiError("dzverify", err instanceof Error ? err.message : "Connection check failed");
  }
}

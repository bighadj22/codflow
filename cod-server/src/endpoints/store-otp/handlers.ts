/**
 * Storefront OTP — route handlers
 *
 * Both handlers share one shape: load the raw config (key never exposed),
 * normalize the phone, act via the dzverify client, map outcomes onto the
 * platform error contract. Fail-open only where PLAN.md §5 says so.
 */

import type { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { getOtpConfigRaw } from "../../../../cod-shared/queries/otp-config";
import { BusinessLogicError, ValidationError, ExternalApiError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { createDzverifyClient, DzverifyError, DZVERIFY_ERRORS } from "./dzverify";
import { normalizeAlgerianPhone } from "./phone";
import { signOtpToken } from "./token";
import { createOtpSendGuards, recordOtpSend } from "./guards";

function clientIp(c: Context<AppContext>): string | null {
  return (
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null
  );
}

async function loadEnabledConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const storeId = c.get("storeId")!;
  const config = await getOtpConfigRaw(db, storeId);
  if (!config || !config.enabled) {
    throw new BusinessLogicError(
      "WhatsApp verification is not enabled for this store",
      ERROR_CODES.OTP_NOT_ENABLED,
      { storeId }
    );
  }
  return { db, storeId, config };
}

function requireNormalizedPhone(raw: string): string {
  const phone = normalizeAlgerianPhone(raw);
  if (!phone) {
    throw new ValidationError(
      "Enter a valid Algerian mobile phone number (e.g. 0551234567)",
      ERROR_CODES.INVALID_PHONE_FORMAT
    );
  }
  return phone;
}

export async function sendOtp(c: Context<AppContext>) {
  const { storeId, config } = await loadEnabledConfig(c);

  const body = (c.req as any).valid?.("json") ?? (await c.req.json());
  const phone = requireNormalizedPhone(String(body.phone ?? ""));

  const guards = createOtpSendGuards();
  const tripped = await guards.check(c.env.RATE_LIMIT, storeId, phone, clientIp(c));
  if (tripped) {
    throw new BusinessLogicError(
      "Too many verification requests — try again shortly",
      ERROR_CODES.OTP_RATE_LIMITED,
    { reason: tripped.reason, windowSeconds: tripped.windowSeconds }
    );
  }

  const client = createDzverifyClient(config.apiKey);
  try {
    const request = await client.sendOtp(phone, { language: config.language });
    await recordOtpSend(c.env.RATE_LIMIT, storeId, phone, clientIp(c));

    return c.json(
      {
        success: true,
        data: {
          status: "sent" as const,
          requestId: request.id,
          expiresAt: request.expiresAt,
          maxAttempts: request.maxAttempts,
        },
      },
      200
    );
  } catch (err) {
    // Fail-open: quota exhausted or provider outage → order proceeds unverified.
    if (
      (err instanceof DzverifyError && (err.isOutOfCredits || err.statusCode >= 500)) ||
      err instanceof TypeError
    ) {
      const reason = err instanceof DzverifyError && err.isOutOfCredits ? "out_of_credits" : "provider_unavailable";
      const bypassToken = await signOtpToken(config.apiKey, phone, "b");
      console.warn(`[store-otp] send failed open store=${storeId} reason=${reason}`);
      return c.json({ success: true, data: { status: "unavailable" as const, reason, bypassToken } }, 200);
    }

    if (err instanceof DzverifyError) {
      // Rate limit → customer waits (no bypass: protects merchant money).
      if (err.code === DZVERIFY_ERRORS.BUSINESS_RULE_VIOLATION) {
        const windowSeconds = typeof err.details?.windowSeconds === "number" ? err.details.windowSeconds : 60;
        throw new BusinessLogicError(
          "Too many verification requests — try again shortly",
          ERROR_CODES.OTP_RATE_LIMITED,
          { windowSeconds, limit: err.details?.limit }
        );
      }
      // Delivery failed / validation → surface the provider's message.
      throw new BusinessLogicError(err.message, ERROR_CODES.VALIDATION_FAILED, { code: err.code });
    }

    const message = err instanceof Error ? err.message : "OTP send failed";
    throw new ExternalApiError("dzverify", message);
  }
}

export async function verifyOtp(c: Context<AppContext>) {
  const { config } = await loadEnabledConfig(c);

  const body = (c.req as any).valid?.("json") ?? (await c.req.json());
  const phone = requireNormalizedPhone(String(body.phone ?? ""));
  const requestId = String(body.requestId ?? "");
  const code = String(body.code ?? "");

  const client = createDzverifyClient(config.apiKey);
  try {
    const request = await client.verifyOtp(requestId, code);
    if (request.status !== "VERIFIED") {
      throw new BusinessLogicError(
        "The code could not be verified — request a new one",
        ERROR_CODES.VALIDATION_FAILED,
        { status: request.status }
      );
    }

    const otpToken = await signOtpToken(config.apiKey, phone, "v");
    return c.json({ success: true, data: { status: "verified" as const, otpToken } }, 200);
  } catch (err) {
    if (err instanceof DzverifyError) {
      if (err.code === DZVERIFY_ERRORS.VALIDATION_ERROR) {
        throw new BusinessLogicError(
          "Wrong code — check WhatsApp and try again",
          ERROR_CODES.VALIDATION_FAILED,
          { attemptsRemaining: err.details?.attemptsRemaining }
        );
      }
      if (err.code === DZVERIFY_ERRORS.CONFLICT || err.code === DZVERIFY_ERRORS.NOT_FOUND) {
        throw new BusinessLogicError(
          "This code is no longer usable — request a new one",
          ERROR_CODES.VALIDATION_FAILED,
          { terminal: true, code: err.code }
        );
      }
      if (err.code === DZVERIFY_ERRORS.BUSINESS_RULE_VIOLATION) {
        throw new BusinessLogicError(
          "Too many verification attempts — try again shortly",
          ERROR_CODES.OTP_RATE_LIMITED,
          { windowSeconds: err.details?.windowSeconds }
        );
      }
      throw new ExternalApiError("dzverify", err.message);
    }
    const message = err instanceof Error ? err.message : "OTP verification failed";
    throw new ExternalApiError("dzverify", message);
  }
}

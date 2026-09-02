/**
 * Order-creation OTP gate
 *
 * The single enforcement point of the verification contract. When the store's
 * OTP feature is enabled, an order must carry a token:
 *   - type "v": phone verified via WhatsApp code → must match the order phone
 *     (both normalized to E.164, so "0551234567" == "+213551234567")
 *   - type "b": server-attested bypass (dzverify quota/outage at send time)
 *     → accepted, order proceeds unverified (fail-open, PLAN.md §5)
 *
 * Disabled (no row / enabled=false) → zero behavior change. Dashboard-created
 * orders never pass through here.
 */

import type { Context } from "hono";
import type { AppContext } from "@/types";
import type { AppDb } from "@/db";
import type { StoreOrderInput } from "./validation";
import { getOtpConfigRaw } from "../../../../cod-shared/queries/otp-config";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { verifyOtpToken } from "@/endpoints/store-otp/token";
import { normalizeAlgerianPhone } from "@/endpoints/store-otp/phone";

export async function assertOtpVerification(
  c: Context<AppContext>,
  db: AppDb,
  data: Pick<StoreOrderInput, "phone" | "otpToken">
): Promise<void> {
  const storeId = c.get("storeId")!;
  const config = await getOtpConfigRaw(db, storeId);
  if (!config || !config.enabled) return;

  if (!data.otpToken) {
    throw new BusinessLogicError(
      "Phone verification is required — request a WhatsApp code and enter it to place your order",
      ERROR_CODES.OTP_VERIFICATION_REQUIRED,
      { storeId }
    );
  }

  const payload = await verifyOtpToken(config.apiKey, data.otpToken);
  if (!payload) {
    throw new BusinessLogicError(
      "Your verification code has expired — request a new one",
      ERROR_CODES.OTP_TOKEN_INVALID,
      { storeId }
    );
  }

  if (payload.type === "b") {
    // Server-attested bypass: dzverify could not serve the send. The order
    // proceeds unverified — the merchant's chosen trade-off.
    console.info(`[store-otp] order placed with bypass token store=${storeId} phone=${payload.phone}`);
    return;
  }

  const orderPhone = normalizeAlgerianPhone(data.phone);
  if (!orderPhone || orderPhone !== payload.phone) {
    throw new BusinessLogicError(
      "The verified phone does not match the order's phone number",
      ERROR_CODES.OTP_PHONE_MISMATCH,
      { storeId }
    );
  }
}

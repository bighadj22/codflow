/**
 * Order-creation Turnstile gate
 *
 * The single enforcement point of the checkout bot-protection contract. When
 * the store's Turnstile feature is enabled, an order must carry a widget token
 * that Cloudflare's siteverify accepts:
 *   - no row / enabled=false → zero behavior change (feature inert);
 *   - missing token → TURNSTILE_VERIFICATION_REQUIRED (fail-closed);
 *   - siteverify success:false (invalid / expired / already redeemed) →
 *     TURNSTILE_TOKEN_INVALID (fail-closed — that IS the feature working);
 *   - siteverify unreachable (network, timeout, non-200) → fail-open with a
 *     console.error: orders are never blocked by a provider outage
 *     (revenue-first precedent, TURNSTILE_INTEGRATION_PLAN.md §2.2).
 *
 * Runs BEFORE the SKU/stock lookups in createStoreOrder so bot traffic is
 * rejected before spending D1 reads. Independent of the OTP gate — the two
 * features compose.
 */

import type { Context } from "hono";
import type { AppDb } from "@/db";
import type { StoreOrderInput } from "./validation";
import { getTurnstileConfigRaw } from "../../../../cod-shared/queries/turnstile-config";
import { verifyTurnstileToken } from "../../../../cod-shared/lib/turnstile";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

function forwardedClientIp(c: Context): string | undefined {
  // X-Forwarded-For first: the storefront worker forwards the shopper's IP
  // there — CF-Connecting-IP on this hop is the worker itself.
  return (
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    c.req.header("CF-Connecting-IP") ||
    undefined
  );
}

export async function assertTurnstile(
  c: Context,
  db: AppDb,
  data: Pick<StoreOrderInput, "turnstileToken">
): Promise<void> {
  const storeId = c.get("storeId")!;
  const config = await getTurnstileConfigRaw(db, storeId);
  if (!config || !config.enabled) return;

  if (!data.turnstileToken) {
    throw new BusinessLogicError(
      "Verification failed — please retry submitting the order",
      ERROR_CODES.TURNSTILE_VERIFICATION_REQUIRED,
      { storeId }
    );
  }

  let result;
  try {
    result = await verifyTurnstileToken(config.secretKey, data.turnstileToken, {
      remoteip: forwardedClientIp(c),
    });
  } catch (err) {
    console.error(
      `[turnstile] siteverify unreachable — failing open store=${storeId}:`,
      (err as Error)?.message
    );
    return;
  }

  if (result.success) return;

  const expired = result.errorCodes.includes("timeout-or-duplicate");
  throw new BusinessLogicError(
    expired
      ? "Your verification has expired — please retry submitting the order"
      : "Verification failed — please retry submitting the order",
    ERROR_CODES.TURNSTILE_TOKEN_INVALID,
    { storeId, errorCodes: result.errorCodes }
  );
}

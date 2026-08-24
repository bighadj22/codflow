/**
 * Delivery fee resolution utility.
 *
 * Single authoritative function for determining deliveryFee at order creation:
 *   1. Find active profile (first product's override OR store default)
 *   2. Look up wilaya rule
 *   3. Check commune override (sparse)
 *   4. Apply to order's deliveryType — reject if mode disabled
 *   5. Free-shipping offer override → fee = 0
 */

import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/db/schema";
import {
  shippingProfiles,
  shippingRules,
  shippingRuleCommunes,
  offers,
  products,
} from "@/db/schema";
import { BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

type DB = DrizzleD1Database<typeof schema>;

export interface ResolveFeeInput {
  wilayaId: number;
  communeId: string | null;
  deliveryType: "home" | "stop_desk";
  /** Product IDs in this order — used to find product-level profile overrides. */
  productIds: string[];
}

export interface ResolveFeeResult {
  /** DZD amount charged to the customer. 0 when no profile is configured. */
  deliveryFee: number;
  /** The profile used for resolution, or null if none found. */
  profileId: string | null;
}

/**
 * Resolves the customer delivery fee for an order.
 *
 * Steps:
 *  1. If the FIRST product of the order has shippingProfileId set, use that
 *     profile (product override). Later products' profiles are ignored.
 *  2. Otherwise, use the store default profile (isDefault=true).
 *  3. If no profile found, return fee=0 (no shipping config).
 *  4. Find wilaya rule — if not found, reject (mode not available here).
 *  5. Check commune override (sparse) — any NULL field inherits from the wilaya rule,
 *     including per-commune price overrides (homePrice / stopDeskPrice).
 *  6. Apply delivery mode check — reject if disabled for this commune/wilaya.
 *  7. Return effective fee.
 */
export async function resolveDeliveryFee(
  db: DB,
  input: ResolveFeeInput,
): Promise<ResolveFeeResult> {
  const { wilayaId, communeId, deliveryType, productIds } = input;

  // Step 1 — Find active profile via product override.
  let profileId: string | null = null;

  if (productIds.length > 0) {
    const productRow = await db
      .select({ shippingProfileId: products.shippingProfileId })
      .from(products)
      .where(eq(products.id, productIds[0]))
      .get();

    if (productRow?.shippingProfileId) {
      const profile = await db
        .select({ id: shippingProfiles.id })
        .from(shippingProfiles)
        .where(eq(shippingProfiles.id, productRow.shippingProfileId))
        .get();
      if (profile) {
        profileId = profile.id;
      }
    }
  }

  // Step 2 — Fall back to store default profile.
  if (!profileId) {
    const defaultProfile = await db
      .select({ id: shippingProfiles.id })
      .from(shippingProfiles)
      .where(eq(shippingProfiles.isDefault, true))
      .get();
    if (defaultProfile) {
      profileId = defaultProfile.id;
    }
  }

  // Step 3 — No profile found: return 0, no restriction.
  if (!profileId) {
    return { deliveryFee: 0, profileId: null };
  }

  // Step 4 — Look up wilaya rule.
  const wilayaRule = await db
    .select({
      id: shippingRules.id,
      homePrice: shippingRules.homePrice,
      stopDeskPrice: shippingRules.stopDeskPrice,
      homeEnabled: shippingRules.homeEnabled,
      stopDeskEnabled: shippingRules.stopDeskEnabled,
    })
    .from(shippingRules)
    .where(
      and(
        eq(shippingRules.profileId, profileId),
        eq(shippingRules.wilayaId, wilayaId),
      ),
    )
    .get();

  if (!wilayaRule) {
    throw new BusinessLogicError(
      deliveryType === "home"
        ? "Home delivery is not available to this wilaya"
        : "Stop-desk delivery is not available to this wilaya",
      ERROR_CODES.DELIVERY_NOT_AVAILABLE,
      { wilayaId, deliveryType },
    );
  }

  // Step 5 — Check commune override (sparse: most communes have no row).
  let effectiveHomeEnabled = wilayaRule.homeEnabled;
  let effectiveStopDeskEnabled = wilayaRule.stopDeskEnabled;
  let effectiveHomePrice = wilayaRule.homePrice;
  let effectiveStopDeskPrice = wilayaRule.stopDeskPrice;

  if (communeId) {
    const communeOverride = await db
      .select({
        homeEnabled: shippingRuleCommunes.homeEnabled,
        stopDeskEnabled: shippingRuleCommunes.stopDeskEnabled,
        homePrice: shippingRuleCommunes.homePrice,
        stopDeskPrice: shippingRuleCommunes.stopDeskPrice,
      })
      .from(shippingRuleCommunes)
      .where(
        and(
          eq(shippingRuleCommunes.ruleId, wilayaRule.id),
          eq(shippingRuleCommunes.communeId, communeId),
        ),
      )
      .get();

    if (communeOverride) {
      // NULL = inherit from wilaya rule
      // For booleans: explicitly check for null/undefined to handle SQLite 0/1 correctly
      effectiveHomeEnabled = communeOverride.homeEnabled !== null && communeOverride.homeEnabled !== undefined
        ? Boolean(communeOverride.homeEnabled)
        : wilayaRule.homeEnabled;
      effectiveStopDeskEnabled = communeOverride.stopDeskEnabled !== null && communeOverride.stopDeskEnabled !== undefined
        ? Boolean(communeOverride.stopDeskEnabled)
        : wilayaRule.stopDeskEnabled;
      effectiveHomePrice = communeOverride.homePrice ?? wilayaRule.homePrice;
      effectiveStopDeskPrice = communeOverride.stopDeskPrice ?? wilayaRule.stopDeskPrice;
    }
  }

  // Step 6 — Reject if delivery mode disabled for this location.
  if (deliveryType === "home" && !effectiveHomeEnabled) {
    throw new BusinessLogicError(
      "Home delivery is not available to this commune",
      ERROR_CODES.DELIVERY_NOT_AVAILABLE,
      { wilayaId, communeId, deliveryType },
    );
  }

  if (deliveryType === "stop_desk" && !effectiveStopDeskEnabled) {
    throw new BusinessLogicError(
      "Stop-desk pickup is not available to this commune",
      ERROR_CODES.DELIVERY_NOT_AVAILABLE,
      { wilayaId, communeId, deliveryType },
    );
  }

  // Step 7 — Return effective fee (commune override if set, else wilaya default).
  const fee = deliveryType === "home" ? effectiveHomePrice : effectiveStopDeskPrice;
  return { deliveryFee: fee, profileId };
}

/**
 * Apply free-shipping offer override after resolveDeliveryFee.
 * Returns 0 if an active free_shipping offer applies to any product in the order.
 * Returns the original fee otherwise.
 */
export async function applyFreeShippingOffer(
  db: DB,
  fee: number,
  productIds: string[],
  productQuantities: Map<string, number>,
): Promise<number> {
  if (fee === 0 || productIds.length === 0) return fee;

  const now = new Date().toISOString();

  for (const productId of productIds) {
    const offer = await db
      .select({
        triggerQuantity: offers.triggerQuantity,
      })
      .from(offers)
      .where(
        and(
          eq(offers.triggerProductId, productId),
          eq(offers.discountType, "free_shipping"),
          eq(offers.status, "active"),
        ),
      )
      .get();

    if (offer) {
      const qty = productQuantities.get(productId) ?? 0;
      if (qty >= offer.triggerQuantity) {
        return 0;
      }
    }
  }

  return fee;
}

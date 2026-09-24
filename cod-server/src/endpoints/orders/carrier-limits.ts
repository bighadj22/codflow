/**
 * Per-carrier payload limits, and the two things we must do about them.
 *
 * A basket can carry an order past what a carrier will accept. Discovering
 * that from a raw provider error — after the customer has been promised a
 * delivery — is the worst place to find out, so the checks run before the
 * call is made and say plainly what the merchant should do instead.
 *
 * Only limits we can point at documentation for are enforced. A carrier with
 * no published ceiling gets `maxAmount: null` and is never blocked: inventing
 * a cap would refuse orders the carrier would have accepted, which is a worse
 * failure than the one being prevented.
 *
 * This is where Q3 lives. The carrier is not known at checkout — the
 * storefront leaves `orders.company_id` null and the merchant assigns it later
 * — so dispatch is the only point in the lifecycle where these can be tested.
 */

export interface CarrierLimits {
  /** Maximum parcel value in DZD, or null when the carrier documents none. */
  maxAmount: number | null;
  /** Maximum length of the product-description field. */
  maxDescription: number;
}

/**
 * Yalidine documents `price` and `declared_value` as 0–150000 (inclusive).
 * The others publish no value ceiling, so none is enforced for them.
 *
 * 255 for descriptions is a conservative default across providers — long
 * enough for a real basket, short enough that no carrier truncates it for us
 * in a way that loses the order number.
 */
export const CARRIER_LIMITS: Record<string, CarrierLimits> = {
  yalidine: { maxAmount: 150_000, maxDescription: 255 },
  zr_express: { maxAmount: null, maxDescription: 255 },
  noest: { maxAmount: null, maxDescription: 255 },
};

const DEFAULT_LIMITS: CarrierLimits = { maxAmount: null, maxDescription: 255 };

export function limitsFor(carrierCode: string): CarrierLimits {
  return CARRIER_LIMITS[carrierCode] ?? DEFAULT_LIMITS;
}

/**
 * Whether a parcel value is acceptable to this carrier.
 *
 * The boundary is inclusive: Yalidine documents 0–150000, so exactly 150,000
 * is allowed and 150,001 is not.
 */
export function exceedsAmountCeiling(
  amount: number,
  limits: CarrierLimits,
): boolean {
  return limits.maxAmount != null && amount > limits.maxAmount;
}

/**
 * Build the carrier's product-description string, never losing the order
 * number.
 *
 * The order number is what support and the merchant use to find the parcel, so
 * it is appended last and protected: when the names do not fit, the NAMES are
 * truncated, never the suffix. If even the suffix alone exceeds the limit
 * (no real carrier limit is that small) the suffix wins and is returned as-is
 * — losing traceability is worse than one over-long field.
 */
export function buildProductDescription(
  productNames: string[],
  orderNumber: string,
  maxLength: number,
): string {
  const unique = [...new Set(productNames.filter(Boolean))];
  if (unique.length === 0) return orderNumber;

  const suffix = ` — ${orderNumber}`;
  const full = `${unique.join(", ")}${suffix}`;
  if (full.length <= maxLength) return full;

  const room = maxLength - suffix.length - 1; // -1 for the ellipsis
  if (room <= 0) return orderNumber;

  return `${unique.join(", ").slice(0, room)}…${suffix}`;
}

/**
 * Total parcel weight in kg from per-variant weights.
 *
 * Returns undefined when nothing is known, which is what the providers already
 * expect for an unweighed parcel — guessing a number would be worse than
 * sending none. Lines whose variant has no weight contribute nothing rather
 * than zeroing the total.
 */
export function sumParcelWeight(
  lines: Array<{ variantId: string | null; quantity: number }>,
  weightByVariant: Map<string, number | null>,
): number | undefined {
  let total = 0;
  let known = false;

  for (const line of lines) {
    if (!line.variantId) continue;
    const weight = weightByVariant.get(line.variantId);
    if (weight == null) continue;
    total += weight * line.quantity;
    known = true;
  }

  if (!known) return undefined;
  // Two decimals: carriers bill in fractional kg and floating-point sums of
  // values like 0.1 otherwise leak 0.30000000000000004 into the payload.
  return Math.round(total * 100) / 100;
}

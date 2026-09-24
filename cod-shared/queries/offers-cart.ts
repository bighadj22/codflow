/**
 * Which offers a basket has earned.
 *
 * Pure: no database, no clock. Candidates are loaded once by the catalog
 * snapshot and the decision is made here, so every rule below is testable
 * exhaustively rather than through a seeded database.
 *
 * The rules, and why each one is what it is:
 *
 *  1. A product is evaluated against its own offers using its TOTAL quantity
 *     across the basket. Two variants of one shirt are two shirts, so a
 *     "buy 2" offer fires — a shopper picking different sizes has still bought
 *     two.
 *
 *  2. The highest satisfied triggerQuantity wins for a product. A shopper who
 *     qualifies for "buy 4" should not be given the "buy 2" reward.
 *
 *  3. An explicit offerId is honoured only if it independently qualifies. The
 *     client may say which tier it *thinks* applies; it may not elect one it
 *     has not earned.
 *
 *  4. free_shipping zeroes the fee only when the basket holds ONE distinct
 *     product. In a multi-product basket free delivery is earned by the
 *     store's basket threshold instead — otherwise a 200 DZD promotional item
 *     ships a 50,000 DZD basket for free (plan Q2).
 *
 *  5. Rewards are OUTPUT, never input. A free unit can never satisfy another
 *     offer's trigger, so "buy 2 get 1 free" cannot cascade into an infinite
 *     ladder of free stock.
 *
 *  6. Evaluation follows the basket's own order, so the same basket always
 *     produces the same result.
 */

import type { CartLine } from "./cart";
import { quantityByProduct } from "./cart";
import type { CatalogOffer } from "./catalog-snapshot";

export interface EarnedOffer {
  offer: CatalogOffer;
  /** The first basket line of the triggering product — carries its variant. */
  line: CartLine;
}

export interface CartOfferResult {
  /** Offers that produce a reward line, in basket order. */
  earned: EarnedOffer[];
  freeShipping: boolean;
  /** Ids of every offer applied, for display and audit. */
  appliedOfferIds: string[];
}

/**
 * `candidates` must already be filtered to active, in-schedule offers — that
 * is the snapshot's job, because "now" belongs to the caller.
 */
export function resolveCartOffers(
  lines: CartLine[],
  candidates: CatalogOffer[],
): CartOfferResult {
  const totals = quantityByProduct(lines);

  // First line per product, in basket order: it carries the variant a
  // same-product reward should mirror.
  const firstLineOf = new Map<string, CartLine>();
  for (const line of lines) {
    if (!firstLineOf.has(line.productId)) firstLineOf.set(line.productId, line);
  }

  const singleProductBasket = totals.size === 1;
  const earned: EarnedOffer[] = [];
  const appliedOfferIds: string[] = [];
  let freeShipping = false;

  for (const [productId, quantity] of totals) {
    const line = firstLineOf.get(productId)!;

    const qualifying = candidates
      .filter((o) => o.triggerProductId === productId && o.triggerQuantity <= quantity)
      // Highest tier first; id breaks ties so two offers with the same trigger
      // resolve the same way on every run.
      .sort((a, b) =>
        b.triggerQuantity - a.triggerQuantity || a.id.localeCompare(b.id),
      );

    // A variant-locked offer needs that variant actually present in the basket.
    const variantMatches = (offer: CatalogOffer) =>
      !offer.triggerVariantId ||
      lines.some(
        (l) => l.productId === productId && l.variantId === offer.triggerVariantId,
      );

    const requested =
      line.offerId &&
      qualifying.find((o) => o.id === line.offerId && variantMatches(o));
    const chosen = requested || qualifying.find(variantMatches);

    if (!chosen) continue;

    appliedOfferIds.push(chosen.id);

    if (chosen.discountType === "free_shipping") {
      // Rule 4. Recorded as applied either way so the merchant can see the
      // offer fired even where it did not change the fee.
      if (singleProductBasket) freeShipping = true;
      continue;
    }

    earned.push({ offer: chosen, line });
  }

  return { earned, freeShipping, appliedOfferIds };
}

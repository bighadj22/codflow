/**
 * Meta Pixel events for the cart.
 *
 * `fbq` only exists when the merchant configured a pixel — BaseHead.astro
 * installs it and nothing else does. Every call here goes through `fbqSafe()`
 * for that reason: a store without a pixel must behave as if this file did not
 * exist, not throw in the middle of an add-to-cart.
 *
 * `value` is always money the server agrees with where we have it. Teaching
 * Meta a price the catalog disagrees with is worse than sending nothing: the
 * optimiser bids against numbers that never existed.
 *
 * Currency is the ISO code Meta expects, not a user-facing string.
 */

import type { CartLine } from "./cart";

const CURRENCY = "DZD";

export type FbqFn = (...args: unknown[]) => void;

export function fbqSafe(): FbqFn | null {
  return typeof (window as unknown as { fbq?: unknown }).fbq === "function"
    ? ((window as unknown as { fbq: FbqFn }).fbq)
    : null;
}

/**
 * Fire an event at one named pixel.
 *
 * `fbq('track', …)` reaches every pixel initialised on the page. On a landing
 * page with its own pixel that is the same thing today, because exactly one is
 * initialised — but a second one appearing later would silently start
 * reporting the same events into an ad account with no Conversions API mirror
 * behind them, and Meta deduplicates per pixel (capi-deduplication.md).
 * `trackSingle` costs one argument and removes the whole class.
 */
export function trackAt(
  pixelId: string,
  eventName: string,
  params: Record<string, unknown>,
): void {
  if (!pixelId) return;
  fbqSafe()?.("trackSingle", pixelId, eventName, params);
}

/** The `contents` shape Meta's catalogue events expect. */
function contentsOf(lines: CartLine[]) {
  return lines.map((line) => ({
    id: line.productId,
    quantity: line.quantity,
    item_price: line.unitPrice,
  }));
}

function unitsOf(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

function valueOf(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}

/**
 * What the shopper just put in the basket — not the whole basket.
 *
 * Meta's AddToCart means "these items were added", so sending the full basket
 * on every tap would double-count everything already in it.
 */
export function trackAddToCart(lines: CartLine[]): void {
  if (lines.length === 0) return;
  fbqSafe()?.("track", "AddToCart", {
    content_ids: [...new Set(lines.map((line) => line.productId))],
    content_type: "product",
    contents: contentsOf(lines),
    num_items: unitsOf(lines),
    value: valueOf(lines),
    currency: CURRENCY,
  });
}

/**
 * The shopper started checking out with this basket.
 *
 * `value` is passed in rather than computed, because the checkout page knows
 * the server-validated subtotal and that is the number worth reporting.
 */
export function trackInitiateCheckout(lines: CartLine[], value: number): void {
  if (lines.length === 0) return;
  fbqSafe()?.("track", "InitiateCheckout", {
    content_ids: [...new Set(lines.map((line) => line.productId))],
    content_type: "product",
    contents: contentsOf(lines),
    num_items: unitsOf(lines),
    value,
    currency: CURRENCY,
  });
}

/**
 * Checkout page controller.
 *
 * The basket lives in this browser, so the page arrives as a shell and this
 * fills it: lines from localStorage first so there is something to look at
 * immediately, then the server's verdict on prices, stock and offers.
 *
 * Delivery is the one number neither side knows up front — it depends on the
 * wilaya and the delivery type the shopper is choosing on this very page — so
 * it is recomputed locally from the merchant's rate table as they choose, and
 * the order total follows it live.
 *
 * Nothing here is trusted for money. The server re-prices every line and
 * re-resolves delivery when the order is placed; this is what the shopper
 * sees, and it is built from the same rules so the two cannot disagree.
 */

import {
  getCart,
  cartCount,
  cartSubtotal,
  lineKey,
  subscribe,
  isCartAvailable,
  toOrderItems,
} from "./cart";
import {
  createValidator,
  renderCartLine,
  validatedByKey,
  hasBlocker,
  renderFreeDelivery,
  moneyFormatter,
  bindLineControls,
  fill,
  type ValidationResult,
} from "./cart-render";
import {
  bindDeliveryFields,
  watchShippingRates,
  rateFor,
  selectedWilayaId,
  currentDeliveryType,
  type ShippingRates,
} from "./delivery-fields";
import { trackInitiateCheckout } from "./pixel";

/** One controller per page, so a second call is a no-op rather than a duplicate. */
const controllers = new WeakMap<HTMLElement, () => void>();

export function initCheckout(): () => void {
  const noop = () => {};
  const root = document.getElementById("checkout-root");
  if (!root) return noop;

  const existing = controllers.get(root);
  if (existing) return existing;

  const loading = document.getElementById("checkout-loading");
  const emptyState = document.getElementById("checkout-empty");
  const main = document.getElementById("checkout-main");
  const list = document.getElementById("checkout-line-list");
  const template = document.getElementById("checkout-line-template") as HTMLTemplateElement | null;
  const itemsLabel = document.getElementById("checkout-items-label");
  const blockedNote = document.getElementById("checkout-blocked-note");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const deliveryEl = document.getElementById("checkout-delivery");
  const totalEl = document.getElementById("checkout-total");
  const freeWrap = document.getElementById("checkout-free-delivery");
  const freeText = document.getElementById("checkout-free-delivery-text");
  const freeBar = document.getElementById("checkout-free-delivery-bar");
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
  const form = document.getElementById("checkout-form") as HTMLFormElement | null;
  const itemsInput = document.getElementById("cart-items-input") as HTMLInputElement | null;

  if (!list || !template) return noop;

  const currency = root.dataset.currency ?? "";
  // Every string comes from the content pack via the markup. Nothing here
  // invents user-facing text; an absent key degrades to empty, never to a
  // hardcoded fallback in a language the shopper may not read.
  const copy = {
    items: root.dataset.copyItems ?? "",
    outOfStock: root.dataset.copyOutOfStock ?? "",
    unavailable: root.dataset.copyUnavailable ?? "",
    freeEarned: root.dataset.copyFreeEarned ?? "",
    freeRemaining: root.dataset.copyFreeRemaining ?? "",
    shippingCalculated: root.dataset.copyShippingCalculated ?? "",
    shippingFree: root.dataset.copyShippingFree ?? "",
  };

  const aborter = new AbortController();
  const { signal } = aborter;
  const money = moneyFormatter(currency);
  const validate = createValidator();
  const isRTL = document.documentElement.dir === "rtl";

  let validated: ValidationResult | null = null;
  let rates: ShippingRates = {};

  /**
   * NaN until the shopper has picked a wilaya the merchant priced — shown as
   * "calculated after selecting wilaya" rather than as free.
   */
  function deliveryFee(): number {
    if (validated?.freeDelivery.qualified) return 0;
    return rateFor(rates, selectedWilayaId(), currentDeliveryType());
  }

  function render(): void {
    const lines = getCart();
    if (loading) loading.hidden = true;

    const empty = lines.length === 0;
    if (emptyState) emptyState.hidden = !empty;
    if (main) main.hidden = empty;
    if (empty) {
      list!.replaceChildren();
      // Nothing in the basket, nothing to make progress towards.
      if (freeWrap) freeWrap.hidden = true;
      return;
    }

    if (itemsLabel) itemsLabel.textContent = fill(copy.items, { n: cartCount(lines) });

    const byKey = validatedByKey(validated);
    list!.replaceChildren(
      ...lines.map((line) =>
        renderCartLine(template!, line, byKey.get(lineKey(line.productId, line.variantId)), copy, money),
      ),
    );

    const blocked = hasBlocker(validated);
    if (blockedNote) blockedNote.hidden = !blocked;
    if (submitBtn) submitBtn.disabled = blocked;

    const subtotal = validated?.subtotal ?? cartSubtotal(lines);
    const delivery = deliveryFee();

    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (deliveryEl) {
      deliveryEl.textContent = Number.isNaN(delivery)
        ? copy.shippingCalculated
        : delivery === 0
          ? copy.shippingFree
          : money(delivery);
    }
    // An unknown delivery fee adds nothing rather than guessing: the shopper
    // sees the basket total and is told delivery is still to be calculated.
    if (totalEl) totalEl.textContent = money(subtotal + (Number.isFinite(delivery) ? delivery : 0));

    renderFreeDelivery(
      { wrap: freeWrap, text: freeText, bar: freeBar },
      validated,
      subtotal,
      { earned: copy.freeEarned, remaining: copy.freeRemaining },
      currency,
    );
  }

  async function revalidate(): Promise<void> {
    const result = await validate(getCart());
    // `undefined` means the answer is stale or the request failed — the
    // optimistic view stands rather than flickering to a worse one.
    if (result === undefined) return;
    validated = result;
    render();
  }

  // A browser blocking storage cannot hold a basket, so there is nothing to
  // check out. Say so with the empty state rather than an endless spinner.
  if (!isCartAvailable()) {
    if (loading) loading.hidden = true;
    if (emptyState) emptyState.hidden = false;
    if (main) main.hidden = true;
    const teardownEarly = () => controllers.delete(root);
    controllers.set(root, teardownEarly);
    return teardownEarly;
  }

  bindLineControls(list, () => {
    render();
    void revalidate();
  }, signal);

  const unbindDelivery = bindDeliveryFields(
    {
      communeLoading: root.dataset.copyCommuneLoading ?? "",
      communePlaceholder: root.dataset.copyCommunePlaceholder ?? "",
      communeDisabled: root.dataset.copyCommuneDisabled ?? "",
    },
    { isRTL, onChange: render },
  );

  const unwatchRates = watchShippingRates((loaded) => {
    rates = loaded;
    render();
  });

  // ─── InitiateCheckout ──────────────────────────────────────────────────────
  //
  // Fires once, on the first real interaction with the form — the same rule
  // the product page uses: arriving on a checkout page is not starting
  // checkout, typing into it is. Without this the basket journey reported
  // nothing to Meta while product pages reported every one.
  let checkoutStarted = false;
  const fireInitiateCheckout = () => {
    if (checkoutStarted) return;
    checkoutStarted = true;
    const lines = getCart();
    // Prefer the price the server stands behind; the optimistic subtotal is
    // only used if validation has not answered yet.
    trackInitiateCheckout(lines, validated?.subtotal ?? cartSubtotal(lines));
  };
  for (const event of ["focusin", "input", "change"] as const) {
    form?.addEventListener(event, fireInitiateCheckout, { signal });
  }

  // Serialised at submit time, not earlier: the shopper can still change the
  // basket from the summary above, and the order must equal what they see.
  form?.addEventListener(
    "submit",
    () => {
      if (itemsInput) itemsInput.value = JSON.stringify(toOrderItems());
    },
    { signal },
  );

  // Another tab — or the drawer on this page — changing the basket.
  const unsubscribe = subscribe(() => {
    validated = null;
    render();
    void revalidate();
  });

  render();
  void revalidate();

  const teardown = () => {
    aborter.abort();
    unbindDelivery();
    unwatchRates();
    unsubscribe();
    controllers.delete(root);
  };
  controllers.set(root, teardown);
  return teardown;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initCheckout());
  } else {
    initCheckout();
  }
}

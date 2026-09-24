/**
 * Cart drawer controller.
 *
 * Renders the drawer from the browser cart, then reconciles it against the
 * server. Two passes on purpose:
 *
 *   1. Optimistic, from localStorage, so the drawer opens instantly. A shopper
 *      on a slow Algerian mobile connection should never watch a spinner to
 *      see what they just added.
 *   2. Authoritative, from POST /store/cart/validate, which replaces prices,
 *      caps quantities, and marks anything that can no longer be ordered.
 *
 * The second pass is what makes the drawer honest: it uses the same snapshot,
 * pricing and offer rules the order engine uses, so what is shown here and
 * what checkout charges cannot drift.
 *
 * The drawer shows the basket; it does not take the order. Checkout is its own
 * page, because a basket of three products cannot be ordered honestly through
 * a form built around one of them.
 *
 * Every listener is bound to one AbortController, and every root is
 * initialised at most once. Binding twice is not a theoretical worry: the
 * module self-initialises on import (the pattern `product.ts` documents, since
 * ClientRouter was removed and `astro:page-load` never fires), so a layout that
 * also calls `initCart()` would double every handler — one tap adding two
 * units, `+` stepping by two.
 */

import {
  getCart,
  lineKey,
  cartCount,
  cartSubtotal,
  subscribe,
  isCartAvailable,
  addLine,
  MAX_LINE_QUANTITY,
  type CartLine,
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
import { trackAddToCart } from "./pixel";

/** Where the basket is actually ordered. */
const CHECKOUT_URL = "/checkout";

/** How long the sheet takes to slide out; mirrors the transition in the markup. */
const CLOSE_MS = 200;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** One controller per root, so a second `initCart()` is a no-op rather than a duplicate. */
const controllers = new WeakMap<HTMLElement, () => void>();

function fieldValue(id: string): string {
  const input = document.getElementById(id) as HTMLInputElement | null;
  return input?.value?.trim() ?? "";
}

function toPrice(raw: string | undefined): number {
  const value = Number(raw ?? "");
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function toQuantity(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LINE_QUANTITY);
}

/**
 * The order form for this product, when the shopper is on its page.
 *
 * `product.ts` keeps the shopper's live choices in that form's hidden inputs,
 * rewriting them on every tap. The add button's own `data-*` attributes are
 * only the server-rendered defaults, correct until the shopper touches
 * anything — so the form wins whenever it is describing this same product, and
 * the attributes serve listings and landing pages that have no form.
 */
function liveFormFor(productId: string): HTMLFormElement | null {
  const priceInput = document.getElementById("price-input") as HTMLInputElement | null;
  const form = priceInput?.closest("form") ?? null;
  if (!form) return null;
  const formProduct = form.querySelector<HTMLInputElement>('input[name="productId"]');
  return formProduct?.value === productId ? form : null;
}

function parseSelections(raw: string): Array<{ variantId: string; variantLabel?: string }> {
  if (!raw || raw === "[]") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is { variantId: string; variantLabel?: string } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { variantId?: unknown }).variantId === "string" &&
        (entry as { variantId: string }).variantId.length > 0,
    );
  } catch {
    return [];
  }
}

/** What one tap on an add button should put in the basket. */
export function linesForButton(button: HTMLElement): CartLine[] {
  const productId = button.dataset.productId ?? "";
  const productName = button.dataset.productName ?? "";
  if (!productId || !productName) return [];

  const base = {
    productId,
    productName,
    href: button.dataset.productHref || undefined,
    image: button.dataset.image || undefined,
  };

  if (!liveFormFor(productId)) {
    return [
      {
        ...base,
        variantId: button.dataset.variantId || null,
        variantLabel: button.dataset.variantLabel || null,
        quantity: 1,
        unitPrice: toPrice(button.dataset.unitPrice),
      },
    ];
  }

  const unitPrice = toPrice(fieldValue("price-input")) || toPrice(button.dataset.unitPrice);

  // A multi-unit offer tier lets the shopper pick a variant per unit. One cart
  // line per distinct variant is the honest representation — a basket line
  // cannot mean "three units, three different colours".
  const selections = parseSelections(fieldValue("variant-selections-input"));
  if (selections.length > 0) {
    const byVariant = new Map<string, { label: string | null; quantity: number }>();
    for (const selection of selections) {
      const existing = byVariant.get(selection.variantId);
      if (existing) existing.quantity += 1;
      else byVariant.set(selection.variantId, { label: selection.variantLabel || null, quantity: 1 });
    }
    return [...byVariant].map(([variantId, entry]) => ({
      ...base,
      variantId,
      variantLabel: entry.label,
      quantity: entry.quantity,
      unitPrice,
    }));
  }

  return [
    {
      ...base,
      variantId: fieldValue("variant-id-input") || null,
      variantLabel: fieldValue("variant-label-input") || null,
      quantity: toQuantity(fieldValue("qty-input")),
      unitPrice,
    },
  ];
}

/** Returns a teardown. Calling it twice on the same root is a no-op. */
export function initCart(): () => void {
  const noop = () => {};
  const root = document.getElementById("cart-root");
  if (!root) return noop;

  const existing = controllers.get(root);
  if (existing) return existing;

  const badge = document.getElementById("cart-badge");
  const badgeCount = document.getElementById("cart-badge-count");
  const scrim = document.getElementById("cart-scrim");
  const drawer = document.getElementById("cart-drawer");
  const closeBtn = document.getElementById("cart-close");
  const continueBtn = document.getElementById("cart-continue");
  const emptyState = document.getElementById("cart-empty");
  const linesWrap = document.getElementById("cart-lines");
  const list = document.getElementById("cart-line-list");
  const footer = document.getElementById("cart-footer");
  const subtotalEl = document.getElementById("cart-subtotal");
  const itemsLabel = document.getElementById("cart-items-label");
  const blockedNote = document.getElementById("cart-blocked-note");
  const checkoutBtn = document.getElementById("cart-checkout") as HTMLButtonElement | null;
  const freeWrap = document.getElementById("cart-free-delivery");
  const freeText = document.getElementById("cart-free-delivery-text");
  const freeBar = document.getElementById("cart-free-delivery-bar");
  const template = document.getElementById("cart-line-template") as HTMLTemplateElement | null;

  if (!drawer || !list || !template) return noop;

  // A browser blocking storage cannot hold a cart. Leave the direct order form
  // as the only path rather than offering a control that silently forgets.
  if (!isCartAvailable()) return noop;

  root.hidden = false;
  // Revealed here rather than in the markup: without JS, or with storage
  // blocked, both returns above leave the shopper with no dead cart control.
  if (badge) badge.hidden = false;

  const currency = root.dataset.currency ?? "";
  // Read once from the markup the content pack rendered. Nothing here invents
  // user-facing text; an absent key degrades to an empty string, never to a
  // hardcoded fallback in a language the shopper may not read.
  const copy = {
    items: root.dataset.copyItems ?? "",
    outOfStock: root.dataset.copyOutOfStock ?? "",
    unavailable: root.dataset.copyUnavailable ?? "",
    freeEarned: root.dataset.copyFreeEarned ?? "",
    freeRemaining: root.dataset.copyFreeRemaining ?? "",
  };

  const aborter = new AbortController();
  const { signal } = aborter;
  const money = moneyFormatter(currency);
  const validate = createValidator();

  let validated: ValidationResult | null = null;
  let lastFocused: HTMLElement | null = null;
  let closeTimer: number | null = null;
  let openFrame: number | null = null;

  const isOpen = () => !drawer.hidden;
  const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  function render(): void {
    const lines = getCart();
    const count = cartCount(lines);

    // The trigger itself stays put once the cart is available — only the count
    // bubble comes and goes, so the header never reflows under the shopper.
    if (badgeCount) {
      badgeCount.textContent = String(count);
      badgeCount.hidden = count === 0;
    }

    const empty = lines.length === 0;
    if (emptyState) emptyState.hidden = !empty;
    if (linesWrap) linesWrap.hidden = empty;
    if (footer) footer.hidden = empty;
    if (itemsLabel) itemsLabel.textContent = empty ? "" : fill(copy.items, { n: count });

    if (empty) {
      list!.replaceChildren();
      // An emptied basket has no progress to show. Without this the banner
      // kept whatever the last non-empty render left behind.
      if (freeWrap) freeWrap.hidden = true;
      return;
    }

    const byKey = validatedByKey(validated);
    list!.replaceChildren(
      ...lines.map((line) =>
        renderCartLine(
          template!,
          line,
          byKey.get(lineKey(line.productId, line.variantId)),
          copy,
          money,
          { linkToProduct: true },
        ),
      ),
    );

    const blocked = hasBlocker(validated);
    if (blockedNote) blockedNote.hidden = !blocked;
    // Only the state changes here; `disabled:` styling lives with the button.
    if (checkoutBtn) checkoutBtn.disabled = blocked;

    const subtotal = validated?.subtotal ?? cartSubtotal(lines);
    if (subtotalEl) subtotalEl.textContent = money(subtotal);

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

  // ─── Open / close ──────────────────────────────────────────────────────────

  function open(): void {
    // A close already in flight must not hide the sheet we are about to show.
    if (closeTimer !== null) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }

    const reopening = isOpen();
    if (!reopening) lastFocused = document.activeElement as HTMLElement | null;

    if (scrim) scrim.hidden = false;
    drawer!.hidden = false;
    // Next frame: the sheet is leaving `display: none`, and flipping its state
    // in the same frame would skip the transition entirely. CSS owns both
    // positions — see the style block in CartDrawer.astro for why nothing here
    // assigns an inline transform.
    if (openFrame !== null) cancelAnimationFrame(openFrame);
    openFrame = requestAnimationFrame(() => {
      openFrame = null;
      scrim?.setAttribute("data-open", "");
      drawer!.setAttribute("data-open", "");
    });
    badge?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    // Adding while the sheet is already open must not yank focus back.
    if (!reopening) closeBtn?.focus();
    void revalidate();
  }

  function close(): void {
    if (!isOpen()) return;
    // A queued open frame would otherwise re-open the sheet after this.
    if (openFrame !== null) {
      cancelAnimationFrame(openFrame);
      openFrame = null;
    }
    scrim?.removeAttribute("data-open");
    drawer!.removeAttribute("data-open");
    badge?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";

    const finish = () => {
      closeTimer = null;
      drawer!.hidden = true;
      if (scrim) scrim.hidden = true;
    };
    if (prefersReducedMotion()) finish();
    else closeTimer = window.setTimeout(finish, CLOSE_MS);

    lastFocused?.focus();
  }

  badge?.addEventListener("click", open, { signal });
  closeBtn?.addEventListener("click", close, { signal });
  continueBtn?.addEventListener("click", close, { signal });
  scrim?.addEventListener("click", close, { signal });

  // ─── Keyboard ──────────────────────────────────────────────────────────────
  //
  // `aria-modal="true"` is a promise to assistive tech that the rest of the
  // page is unreachable. Tab has to honour it, or the claim is a lie and a
  // keyboard shopper tabs into a form they cannot see.

  function focusablesInDrawer(): HTMLElement[] {
    return [...drawer!.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (node) => !node.hasAttribute("hidden") && !node.closest("[hidden]"),
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isOpen()) return;

      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab") return;
      const nodes = focusablesInDrawer();
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !drawer!.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal },
  );

  // ─── Line controls ─────────────────────────────────────────────────────────

  bindLineControls(
    list,
    () => {
      render();
      void revalidate();
    },
    signal,
  );

  // ─── Add to cart ───────────────────────────────────────────────────────────

  document.addEventListener(
    "click",
    (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>("[data-add-to-cart]");
      if (!button) return;
      // Harmless on a bare `type="button"`, and it keeps an add button placed
      // inside a linked product card from navigating away mid-add.
      event.preventDefault();

      const lines = linesForButton(button);
      if (lines.length === 0) return;
      for (const line of lines) addLine(line);

      // What was just added, not the whole basket — see pixel.ts.
      trackAddToCart(lines);

      render();
      open();
    },
    { signal },
  );

  // ─── Checkout ──────────────────────────────────────────────────────────────

  checkoutBtn?.addEventListener(
    "click",
    () => {
      if (checkoutBtn.disabled) return;
      // Already on the checkout page: the basket and the form are both on
      // screen, so closing the sheet is the whole job.
      if (document.getElementById("checkout-root")) {
        close();
        return;
      }
      window.location.href = CHECKOUT_URL;
    },
    { signal },
  );

  // Another tab changing the cart keeps this one honest.
  const unsubscribe = subscribe(() => {
    validated = null;
    render();
    if (isOpen()) void revalidate();
  });

  render();

  const teardown = () => {
    aborter.abort();
    unsubscribe();
    if (closeTimer !== null) window.clearTimeout(closeTimer);
    if (openFrame !== null) cancelAnimationFrame(openFrame);
    controllers.delete(root);
  };
  controllers.set(root, teardown);
  return teardown;
}

/**
 * Self-initialising, like `product.ts` and `turnstile-field.ts`.
 *
 * ClientRouter was removed from this theme, so `astro:page-load` never fires
 * and DOMContentLoaded is the only signal. `initCart()` guards against a second
 * call, so importing this module is all a layout needs to do.
 */
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initCart());
  } else {
    initCart();
  }
}

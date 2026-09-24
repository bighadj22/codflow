/**
 * Basket rendering, shared by the cart drawer and the checkout page.
 *
 * Both surfaces show the same thing — the same lines, the same server verdict,
 * the same free-delivery progress — in two different frames. The markup they
 * clone differs; the contract does not, and it is the contract that matters:
 * every row exposes the same `data-cart-*` hooks, so one renderer fills both.
 *
 * The alternative was two copies of "which line did the server mark
 * out of stock", and two chances for the drawer and the checkout page to tell
 * a shopper different things about the same basket.
 */

import { getCart, lineKey, setQuantity, removeLine, toOrderItems, type CartLine } from "./cart";

/** Mirrors the /store/cart/validate response the proxy returns. */
export interface ValidatedLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  maxQuantity: number | null;
  blocker: "missing" | "unlisted" | "out_of_stock" | null;
}

export interface ValidationResult {
  lines: ValidatedLine[];
  subtotal: number;
  freeDelivery: {
    fromOffer: boolean;
    threshold: number | null;
    qualified: boolean;
    remaining: number;
  };
}

export interface LineCopy {
  outOfStock: string;
  unavailable: string;
}

export interface FreeDeliveryCopy {
  earned: string;
  remaining: string;
}

export const VALIDATE_URL = "/api/cart/validate";

/** Replace `{name}` placeholders, leaving unknown ones visible rather than blank. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

export function moneyFormatter(currency: string): (n: number) => string {
  return (n) => `${n.toLocaleString("ar-DZ")} ${currency}`;
}

/**
 * Asks the server for the truth about a basket.
 *
 * Holds its own request counter so a slow earlier answer can never overwrite a
 * newer one — the shopper tapping `+` three times must end on the third
 * answer, not on whichever response happens to land last.
 */
export function createValidator(url: string = VALIDATE_URL) {
  let latest = 0;

  return async function validate(lines: CartLine[]): Promise<ValidationResult | null | undefined> {
    if (lines.length === 0) return null;
    const id = ++latest;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toOrderItems(lines) }),
      });
      if (!res.ok) return undefined;
      const payload = await res.json();
      // `undefined` means "nothing to apply"; `null` means "known to be empty".
      if (id !== latest) return undefined;
      return (payload?.data as ValidationResult | undefined) ?? null;
    } catch {
      // Offline or blocked. The basket still works from local state, and
      // checkout re-checks everything server-side regardless.
      return undefined;
    }
  };
}

export function validatedByKey(result: ValidationResult | null): Map<string, ValidatedLine> {
  return new Map((result?.lines ?? []).map((l) => [lineKey(l.productId, l.variantId), l]));
}

/** Whether anything in the basket can no longer be ordered. */
export function hasBlocker(result: ValidationResult | null): boolean {
  return (result?.lines ?? []).some((l) => l.blocker !== null);
}

/**
 * Clone one row and fill it.
 *
 * Warnings come from the server pass only: the optimistic render never invents
 * a problem it has not been told about.
 */
export function renderCartLine(
  template: HTMLTemplateElement,
  line: CartLine,
  server: ValidatedLine | undefined,
  copy: LineCopy,
  money: (n: number) => string,
  options: { linkToProduct?: boolean } = {},
): HTMLElement {
  const node = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  node.dataset.key = lineKey(line.productId, line.variantId);

  const img = node.querySelector<HTMLImageElement>("[data-cart-image]");
  if (img && line.image) {
    img.src = line.image;
    img.hidden = false;
  }

  const name = node.querySelector<HTMLElement>("[data-cart-name]")!;
  name.textContent = line.productName;

  // The drawer links back to the product; the checkout page does not. Sending
  // a shopper away from a half-filled order form loses what they typed, and on
  // that page their job is to finish, not to browse.
  if (options.linkToProduct && line.href) {
    const imageLink = node.querySelector<HTMLAnchorElement>("[data-cart-image-link]");
    if (name instanceof HTMLAnchorElement) name.href = line.href;
    if (imageLink) imageLink.href = line.href;
  }

  const variantEl = node.querySelector<HTMLElement>("[data-cart-variant]")!;
  if (line.variantLabel) {
    variantEl.textContent = line.variantLabel;
    variantEl.hidden = false;
  }

  const unit = server?.unitPrice ?? line.unitPrice;
  node.querySelector("[data-cart-qty]")!.textContent = String(line.quantity);
  node.querySelector("[data-cart-total]")!.textContent = money(unit * line.quantity);

  const warn = node.querySelector<HTMLElement>("[data-cart-warning]")!;
  if (server?.blocker === "out_of_stock" && server.maxQuantity != null) {
    warn.textContent = fill(copy.outOfStock, { n: server.maxQuantity });
    warn.hidden = false;
  } else if (server?.blocker) {
    warn.textContent = copy.unavailable;
    warn.hidden = false;
  }

  const increase = node.querySelector<HTMLButtonElement>("[data-cart-increase]")!;
  if (server?.maxQuantity != null && line.quantity >= server.maxQuantity) {
    increase.disabled = true;
  }

  return node;
}

/**
 * Quantity and remove controls, by delegation on the list.
 *
 * Delegation rather than per-row listeners because the rows are replaced
 * wholesale on every render; the list element itself is stable.
 */
export function bindLineControls(
  list: HTMLElement,
  onChange: () => void,
  signal?: AbortSignal,
): void {
  list.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLElement>("[data-cart-line]");
      if (!row?.dataset.key) return;
      const key = row.dataset.key;
      const current = getCart().find((l) => lineKey(l.productId, l.variantId) === key);
      if (!current) return;

      if (target.closest("[data-cart-remove]")) {
        removeLine(key);
      } else if (target.closest("[data-cart-increase]")) {
        setQuantity(key, current.quantity + 1);
      } else if (target.closest("[data-cart-decrease]")) {
        setQuantity(key, current.quantity - 1);
      } else {
        return;
      }
      onChange();
    },
    { signal },
  );
}

/**
 * Free-delivery progress, or nothing when the merchant set no threshold.
 *
 * `qualified` comes from the server rather than being inferred from the
 * subtotal, because an offer can grant free delivery without one.
 */
export function renderFreeDelivery(
  elements: { wrap: HTMLElement | null; text: HTMLElement | null; bar: HTMLElement | null },
  result: ValidationResult | null,
  subtotal: number,
  copy: FreeDeliveryCopy,
  currency: string,
): void {
  const { wrap, text, bar } = elements;
  const info = result?.freeDelivery;
  if (!wrap || !text || !bar || !info || info.threshold == null) {
    if (wrap) wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  // The state attribute is the whole contract with the stylesheet: the icon,
  // the colour and whether the stripes keep moving all follow from it. See
  // FreeDeliveryBar.astro.
  wrap.dataset.state = info.qualified ? "earned" : "progress";

  if (info.qualified) {
    text.textContent = copy.earned;
    bar.style.width = "100%";
    return;
  }

  text.textContent = fill(copy.remaining, {
    amount: info.remaining.toLocaleString("ar-DZ"),
    currency,
  });
  bar.style.width = `${Math.max(0, Math.min(100, (subtotal / info.threshold) * 100))}%`;
}

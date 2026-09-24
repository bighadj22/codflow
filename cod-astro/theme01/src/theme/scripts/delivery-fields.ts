/**
 * Delivery details, shared by the product order form and the checkout page.
 *
 * Both surfaces render the same `CustomerFields.astro` block, so both need the
 * same three behaviours: pick a wilaya and its communes load, pick a delivery
 * type and the address field appears or disappears with it, and either change
 * re-prices delivery. This module owns all three so the two pages cannot drift
 * apart — a commune list that loads on one page and not the other is the kind
 * of difference nobody notices until an order arrives with no address.
 *
 * What stays with the caller is what genuinely differs: the product form has to
 * consider a free-shipping offer tier, and checkout has to price a whole
 * basket. Both get told "something changed, re-price" and decide for themselves.
 */

export interface ShippingRate {
  home: number;
  stopDesk: number;
}

export type ShippingRates = Record<string, ShippingRate>;
export type DeliveryType = "home" | "stop_desk";

export interface DeliveryCopy {
  communeLoading: string;
  communePlaceholder: string;
  communeDisabled: string;
}

import { getCommunesByWilayaId } from "@/theme/data/algeria-communes";

// `window.__selectPopulate` and friends are declared in env.d.ts and installed
// by Select.astro. They are called optionally here because this module can run
// before that script has: a missing helper degrades to an unpopulated field,
// never to a thrown error mid-checkout.

export function parseShippingRates(raw: string | null | undefined): ShippingRates {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as ShippingRates;
  } catch {
    // A malformed bridge must not take the page down: delivery simply shows as
    // "to be calculated" until the shopper is told a real number.
    return {};
  }
}

/**
 * Read the rates the server put on the page, now or whenever they arrive.
 *
 * `ShippingIsland.astro` can be a deferred server island, so the element may
 * not exist yet when this runs. Returns a disposer.
 */
export function watchShippingRates(onRates: (rates: ShippingRates) => void): () => void {
  let disposed = false;

  const read = (): boolean => {
    const el = document.getElementById("shipping-rates-data");
    const rates = parseShippingRates(el?.dataset.rates);
    if (Object.keys(rates).length === 0) return false;
    if (!disposed) onRates(rates);
    return true;
  };

  const observer = new MutationObserver(() => {
    if (read()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // Never leave a permanent observer behind if the island never lands.
  const timer = window.setTimeout(() => observer.disconnect(), 10_000);

  // The bridge can already be in the DOM when this runs (ShippingIsland.astro
  // renders it inline), and a synchronous first delivery would re-enter the
  // caller in the middle of its own initialization — while its later `const`
  // bindings are still in the temporal dead zone. That crash killed the
  // product page's whole init, so the first read is always a microtask: it
  // runs only after the caller's synchronous setup has finished.
  queueMicrotask(() => {
    if (read()) {
      observer.disconnect();
      window.clearTimeout(timer);
    }
  });

  return () => {
    disposed = true;
    observer.disconnect();
    window.clearTimeout(timer);
  };
}

export function currentDeliveryType(): DeliveryType {
  const checked = document.querySelector<HTMLInputElement>(".delivery-radio-input:checked");
  return checked?.value === "stop_desk" ? "stop_desk" : "home";
}

export function selectedWilayaId(): string {
  const select = document.getElementById("f-wilaya") as HTMLInputElement | null;
  return select?.value ?? "";
}

/** NaN means "no rate known yet", which the caller shows as "to be calculated". */
export function rateFor(
  rates: ShippingRates,
  wilayaId: string,
  deliveryType: DeliveryType,
): number {
  if (!wilayaId) return NaN;
  const rate = rates[wilayaId];
  if (!rate) return NaN;
  const value = deliveryType === "stop_desk" ? rate.stopDesk : rate.home;
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

const SELECTED_CLASSES = [
  "border-[var(--clr-primary)]",
  "text-[var(--clr-primary)]",
  "bg-[var(--clr-primary)]/5",
  "shadow-sm",
];
const UNSELECTED_CLASSES = [
  "border-[var(--clr-border)]",
  "text-[var(--clr-text-2)]",
  "bg-[var(--clr-surface-alt)]",
];

/** Home delivery needs a street address; a stop desk does not. */
export function toggleAddressFields(): void {
  const container = document.getElementById("address-field-container");
  if (!container) return;
  container.classList.toggle("hidden", currentDeliveryType() !== "home");
}

function paintDeliveryRadios(): void {
  document.querySelectorAll<HTMLInputElement>(".delivery-radio-input").forEach((radio) => {
    const face = radio.nextElementSibling as HTMLElement | null;
    if (!face) return;
    const on = radio.checked;
    face.classList.remove(...(on ? UNSELECTED_CLASSES : SELECTED_CLASSES));
    face.classList.add(...(on ? SELECTED_CLASSES : UNSELECTED_CLASSES));
  });
}

async function loadCommunes(
  wilayaId: string,
  copy: DeliveryCopy,
  isRTL: boolean,
  isCurrent: () => boolean,
): Promise<void> {
  const numericId = parseInt(wilayaId, 10);
  const localCommunes = getCommunesByWilayaId(numericId);

  // 1. Zero-network instant resolution (Shopify-grade: 0ms latency, zero network failure)
  if (localCommunes && localCommunes.length > 0) {
    if (!isCurrent()) return;
    const communes = localCommunes.map(([id, name, nameAr]) => ({
      value: id,
      label: isRTL ? (nameAr || name) : name,
    }));
    window.__selectPopulate?.("f-commune", communes, copy.communePlaceholder);
    return;
  }

  // 2. Graceful network fallback if an unknown / custom wilayaId is provided
  window.__selectSetLoading?.("f-commune", true, copy.communeLoading);
  try {
    const res = await fetch(`/api/communes/${wilayaId}`);
    const json = (await res.json()) as {
      data?: Array<{ id: string; name: string; nameAr: string }>;
    };
    if (!isCurrent()) return;
    const communes = (json.data ?? []).map((c) => ({
      value: c.id,
      label: isRTL ? (c.nameAr || c.name) : c.name,
    }));
    window.__selectPopulate?.("f-commune", communes, copy.communePlaceholder);
  } catch {
    if (!isCurrent()) return;
    // An empty list still tells the shopper the field is theirs to fill in
    // again, rather than leaving a spinner that never resolves.
    window.__selectPopulate?.("f-commune", [], copy.communePlaceholder);
  }
}

/**
 * Wire the delivery block. Returns a disposer.
 *
 * `onChange` fires whenever the delivery price could have moved — a new wilaya
 * or a new delivery type — and never for anything else.
 */
export function bindDeliveryFields(
  copy: DeliveryCopy,
  options: { isRTL: boolean; onChange: () => void },
): () => void {
  const aborter = new AbortController();
  const { signal } = aborter;
  let communeRequest = 0;

  document.querySelectorAll<HTMLInputElement>(".delivery-radio-input").forEach((radio) => {
    radio.addEventListener(
      "change",
      () => {
        paintDeliveryRadios();
        toggleAddressFields();
        options.onChange();
      },
      { signal },
    );
  });

  const wilaya = document.getElementById("f-wilaya") as HTMLInputElement | null;
  wilaya?.addEventListener(
    "change",
    (event) => {
      const wilayaId = (event.target as HTMLInputElement).value;
      const id = ++communeRequest;
      if (wilayaId) {
        void loadCommunes(wilayaId, copy, options.isRTL, () => id === communeRequest);
      } else {
        // A cleared wilaya must clear the commune with it, or the shopper
        // submits a commune belonging to a wilaya they no longer selected.
        communeRequest += 1;
        window.__selectSetDisabled?.("f-commune", copy.communeDisabled);
      }
      options.onChange();
    },
    { signal },
  );

  toggleAddressFields();

  return () => aborter.abort();
}

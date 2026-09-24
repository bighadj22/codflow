/**
 * Product Page Logic
 * Handles variant selection, gallery interactions, offer tiers,
 * shipping calculations, and commune loading.
 */

import {
  bindDeliveryFields,
  watchShippingRates,
  rateFor,
  selectedWilayaId,
  currentDeliveryType,
  toggleAddressFields,
} from "./delivery-fields";
// fbq only exists when the merchant configured a pixel — one shared guard.
import { trackAt } from "./pixel";

export function initProductPage() {
  // ── DATA BRIDGE ────────────────────────────────────────────────────────────
  // We read server-side computed data from a hidden div in the DOM.
  const el = document.getElementById("page-data") as HTMLElement;
  if (!el) return;

  /** @type {Array<Object>} List of product variants with their prices, options and inventory */
  const variants: Array<{
    id: string;
    price: number;
    compareAtPrice: number | null;
    inventory: number;
    variations: Record<string, string>;
    isDefault: boolean;
    imageId: string | null;
  }> = JSON.parse(el.dataset.variants || "[]");
  
  /** @type {Record<string, Object>} Shipping rates per wilaya: { wilayaId: { home, stopDesk } } */
  let rates: Record<string, { home: number; stopDesk: number }> = {};

  // Localized strings and configuration
  const cur                = el.dataset.cur!;
  const shippingCalc       = el.dataset.shippingCalc!;
  const shippingFree       = el.dataset.shippingFree!;
  const communePlaceholder = el.dataset.communePlaceholder!;
  const communeLoading     = el.dataset.communeLoading!;
  const communeDisabled    = el.dataset.communeDisabled!;
  const isRTL              = el.dataset.isRtl === "1";
  const trackInventory     = el.dataset.trackInventory === "1";
  const outOfStockLabel    = el.dataset.outOfStockLabel ?? "نفد المخزون";
  const qtyMaxStockLabel   = el.dataset.qtyMaxStock ?? "آخر {n} قطعة فقط";
  const productInventory   = parseInt(el.dataset.inventory ?? "100") || 100;

  /** @type {Array<Object>} Active offers for this product */
  type OfferData = {
    id: string;
    discountType: "free" | "free_shipping";
    triggerQuantity: number;
    triggerVariantId: string | null;
    rewardQuantity: number;
    rewardProductName: string;
    rewardVariantLabel: string | null;
  };
  const allOffers: OfferData[] = JSON.parse(el.dataset.offers || "[]");

  // ── STATE ──────────────────────────────────────────────────────────────────
  /** Tracks selected values for each variant option (e.g., { "Color": "Red" }) */
  const selectedOpts: Record<string, string> = {};

  /** Current unit price based on selected variant */
  let currentPrice        = parseInt(el.dataset.basePrice!) || 0;

  /** Current calculated shipping cost */
  let currentShipping     = NaN;

  /** Currently selected offer ID (if any) */
  let currentOfferId: string | null = null;

  /** Maximum quantity allowed by stock; 100 = uncapped */
  let currentVariantMax   = 100;
  let hasStockCap         = false;

  /**
   * Formats a number for currency display using Algerian locale.
   * @param {number} n - The number to format.
   * @returns {string} Formatted string.
   */
  function fmt(n: number) { return n.toLocaleString("ar-DZ"); }

  // ── DOM ELEMENTS ───────────────────────────────────────────────────────────
  const tierLabels = document.querySelectorAll<HTMLElement>(".tier-label");
  const qtyInput   = document.getElementById("qty-input") as HTMLInputElement | null;
  const offerIdInput = document.getElementById("offer-id-input") as HTMLInputElement | null;
  const variantSelectionsInput = document.getElementById("variant-selections-input") as HTMLInputElement | null;
  const priceInput = document.getElementById("price-input") as HTMLInputElement | null;
  const variantIdInput = document.getElementById("variant-id-input") as HTMLInputElement | null;
  const variantLabelInput = document.getElementById("variant-label-input") as HTMLInputElement | null;
  const gallery   = document.getElementById("gallery");
  const dots      = document.querySelectorAll<HTMLButtonElement>(".gallery-dot");
  const thumbs    = document.querySelectorAll<HTMLButtonElement>(".gallery-thumb");
  const submitBtn     = document.getElementById("submit-btn") as HTMLButtonElement | null;
  const submitLabel   = submitBtn?.textContent?.trim() ?? "";
  const qtyPlusBtn    = document.getElementById("qty-plus") as HTMLButtonElement | null;
  const qtyStockHint  = document.getElementById("qty-stock-hint") as HTMLParagraphElement | null;

  // ── OFFER TIER SELECTION ───────────────────────────────────────────────────
  
  /**
   * Updates UI and state when a user selects a specific offer tier.
   * @param {HTMLElement} label - The clicked tier label element.
   */
  function selectTier(label: HTMLElement) {
    // 1. Reset all tier visual states
    tierLabels.forEach((l) => {
      l.style.borderColor = "var(--clr-border)";
      l.style.background  = "var(--clr-surface)";
      const chk = l.querySelector<HTMLElement>(".tier-check");
      if (chk) {
        chk.style.borderColor = "var(--clr-border)";
        chk.style.background  = "var(--clr-surface)";
        chk.querySelector("svg")?.setAttribute("stroke", "transparent");
      }
      const r = l.querySelector<HTMLInputElement>("input[type=radio]");
      if (r) r.checked = false;
    });

    // 2. Set active visual state for selected tier
    label.style.borderColor = "var(--clr-primary)";
    label.style.background  = "color-mix(in srgb, var(--clr-primary) 5%, white)";
    const chk = label.querySelector<HTMLElement>(".tier-check");
    if (chk) {
      chk.style.borderColor = "var(--clr-primary)";
      chk.style.background  = "var(--clr-primary)";
      chk.querySelector("svg")?.setAttribute("stroke", "white");
    }
    const r = label.querySelector<HTMLInputElement>("input[type=radio]");
    if (r) r.checked = true;

    // 3. Update hidden form inputs and internal state
    const qty   = parseInt(label.dataset.qty || "1") || 1;
    const offId = label.dataset.offerId ?? "";
    if (qtyInput) qtyInput.value = String(qty);
    currentOfferId = offId || null;

    if (offerIdInput) offerIdInput.value = offId;

    // 4. Manage visibility of variant selectors (base tier + offer tiers)
    tierLabels.forEach((l) => {
      const id = l.dataset.offerId ?? "";
      const sectionId = id ? `tier-variants-${id}` : "tier-variants-base";
      document.getElementById(sectionId)?.classList.add("hidden");
    });
    const activeSectionId = offId ? `tier-variants-${offId}` : "tier-variants-base";
    document.getElementById(activeSectionId)?.classList.remove("hidden");

    // 5. Handle special offer types (e.g. Free Shipping)
    const selOffer = allOffers.find(o => o.id === offId);
    if (selOffer?.discountType === "free_shipping") {
      currentShipping = 0;
      updateVariantSelectionsInput();
      updatePriceUI();
    } else {
      updateVariantSelectionsInput();
      refreshShipping(); // Recalculate based on wilaya
    }
  }

  // Attach listeners to tier cards
  tierLabels.forEach((l) => l.addEventListener("click", () => selectTier(l)));

  /**
   * Updates price labels within the tier cards when base price changes.
   */
  function updateTierPrices() {
    const basePriceEl = document.getElementById("tier-price-base");
    if (basePriceEl) {
      basePriceEl.innerHTML = `${fmt(currentPrice)}&nbsp;<span style="font-size:.5625rem;font-weight:900">${cur}</span>`;
    }
    for (const offer of allOffers) {
      const priceEl = document.getElementById(`tier-price-${offer.id}`);
      if (priceEl) {
        priceEl.innerHTML = `${fmt(currentPrice * offer.triggerQuantity)}&nbsp;<span style="font-size:.5625rem;font-weight:900">${cur}</span>`;
      }
    }
  }

  /**
   * Shows or hides offers based on whether they apply to the currently selected product variant.
   */
  function updateTierVisibility() {
    const vid = variantIdInput?.value || null;
    for (const offer of allOffers) {
      const card = document.getElementById(`tier-card-${offer.id}`);
      if (!card) continue;
      
      const applies = !offer.triggerVariantId || offer.triggerVariantId === vid;
      if (applies) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
        // Fallback to base tier if current offer becomes invalid
        if (currentOfferId === offer.id) {
          const base = document.getElementById("tier-card-base");
          if (base) selectTier(base);
        }
      }
    }
  }

  // ── VARIANT SELECTIONS ─────────────────────────────────────────────────────

  /**
   * Reads active `.tier-unit-opt` pill buttons for the current offer and builds
   * the variantSelections JSON. No select elements — purely data-active driven.
   */
  function updateVariantSelectionsInput() {
    if (!variantSelectionsInput) return;
    if (!currentOfferId) { variantSelectionsInput.value = "[]"; return; }

    const tierCard = document.getElementById(`tier-card-${currentOfferId}`);
    const unitCount = tierCard ? (parseInt(tierCard.dataset.qty || "1") || 1) : 1;

    const selections: Array<{ variantId: string; variantLabel: string }> = [];
    for (let i = 0; i < unitCount; i++) {
      const selectedValues: Record<string, string> = {};
      document.querySelectorAll<HTMLButtonElement>(
        `.tier-unit-opt[data-tier-id="${currentOfferId}"][data-unit="${i}"][data-active="1"]`
      ).forEach(btn => {
        selectedValues[btn.dataset.option!] = btn.dataset.value!;
      });

      if (Object.keys(selectedValues).length === 0) continue;

      const match = variants.find(v =>
        Object.entries(v.variations as Record<string, string>)
          .every(([k, val]) => selectedValues[k] === val)
      );
      if (match) {
        selections.push({
          variantId: match.id,
          variantLabel: Object.values(match.variations as Record<string, string>).join(" / "),
        });
      }
    }

    variantSelectionsInput.value = selections.length > 0 ? JSON.stringify(selections) : "[]";
  }

  // Per-unit variant pill buttons inside offer tier cards
  document.querySelectorAll<HTMLButtonElement>(".tier-unit-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { tierId, unit, option } = btn.dataset;
      // Deactivate siblings in the same option group
      document.querySelectorAll<HTMLButtonElement>(
        `.tier-unit-opt[data-tier-id="${tierId}"][data-unit="${unit}"][data-option="${option}"]`
      ).forEach(b => {
        b.dataset.active = "0";
        b.classList.remove("text-[var(--clr-primary)]", "bg-[var(--clr-primary)]/5", "border-[var(--clr-primary)]");
        b.classList.add("border-[var(--clr-border)]", "bg-[var(--clr-surface)]", "text-[var(--clr-text-2)]");
      });
      // Activate clicked pill
      btn.dataset.active = "1";
      btn.classList.remove("border-[var(--clr-border)]", "bg-[var(--clr-surface)]", "text-[var(--clr-text-2)]");
      btn.classList.add("text-[var(--clr-primary)]", "bg-[var(--clr-primary)]/5", "border-[var(--clr-primary)]");
      updateVariantSelectionsInput();
    });
  });

  // ── PRICE & SUMMARY UI ─────────────────────────────────────────────────────

  /**
   * Refreshes all price-related text in the UI (product price, summary rows, total).
   */
  function updatePriceUI() {
    const qty = Math.max(1, parseInt(qtyInput?.value || "1") || 1);
    const itemTotal = currentPrice * qty;

    // 1. Update main price displays
    document.querySelectorAll<HTMLElement>("#price-display-desktop, #price-display-mobile, #sticky-price").forEach((el) => {
      el.innerHTML = `${fmt(currentPrice)} <span style="font-size:.6em;font-weight:700"> ${cur}</span>`;
    });

    // 2. Update order summary rows
    const summaryItemPrice = document.getElementById("summary-item-price");
    if (summaryItemPrice) summaryItemPrice.textContent = `${fmt(itemTotal)} ${cur}`;
    
    const summaryQtyLabel = document.getElementById("summary-qty-label");
    if (summaryQtyLabel) summaryQtyLabel.textContent = `${qty} ×`;

    const shippingEl = document.getElementById("summary-shipping");
    const totalEl    = document.getElementById("summary-total");

    // 3. Handle shipping logic in summary
    if (shippingEl && totalEl) {
      if (isNaN(currentShipping)) {
        shippingEl.textContent = shippingCalc;
        totalEl.textContent = `${fmt(itemTotal)} ${cur}`;
      } else if (currentShipping === 0) {
        shippingEl.textContent = shippingFree;
        totalEl.textContent = `${fmt(itemTotal)} ${cur}`;
      } else {
        shippingEl.textContent = `${fmt(currentShipping)} ${cur}`;
        totalEl.textContent = `${fmt(itemTotal + currentShipping)} ${cur}`;
      }
    }

    // 4. Show/hide relevant offer summary rows
    for (const offer of allOffers) {
      const row = document.getElementById(`offer-row-${offer.id}`);
      if (!row) continue;
      if (offer.id === currentOfferId) row.classList.remove("hidden");
      else row.classList.add("hidden");
    }
  }

  // ── VARIANT OPTION CLICKS ──────────────────────────────────────────────────

  /**
   * Attach listeners to "pill" style variant buttons (Size, Color, etc.)
   */
  document.querySelectorAll<HTMLButtonElement>(".variant-opt").forEach((btn) => {
    // Initialize default selections
    if (btn.dataset.first === "1") {
      selectVariantBtn(btn);
      selectedOpts[btn.dataset.option!] = btn.dataset.value!;
    }

    btn.addEventListener("click", () => {
      if (btn.dataset.oos === "1") return; // ignore out-of-stock pills
      const opt = btn.dataset.option!;
      selectedOpts[opt] = btn.dataset.value!;

      // Reset siblings (skip OOS pills)
      document.querySelectorAll<HTMLButtonElement>(`.variant-opt[data-option="${opt}"]`).forEach((b) => {
        b.classList.remove("text-[var(--clr-primary)]", "bg-[var(--clr-primary)]/5", "border-[var(--clr-primary)]");
        b.classList.add("text-[var(--clr-text-2)]", "bg-[var(--clr-surface)]", "border-[var(--clr-border)]");
        const icon = b.querySelector('.check-icon');
        if (icon) icon.classList.replace('opacity-100', 'opacity-0');
      });

      selectVariantBtn(btn);
      updateVariant();
    });
  });

  /** Visual helper for active variant button */
  function selectVariantBtn(btn: HTMLButtonElement) {
    btn.classList.remove("text-[var(--clr-text-2)]", "bg-[var(--clr-surface)]", "border-[var(--clr-border)]");
    btn.classList.add("text-[var(--clr-primary)]", "bg-[var(--clr-primary)]/5", "border-[var(--clr-primary)]");
    const icon = btn.querySelector('.check-icon');
    if (icon) icon.classList.replace('opacity-0', 'opacity-100');
  }

  /**
   * Toggles the submit button between normal and out-of-stock states.
   * Called whenever the selected variant combination changes.
   */
  function setVariantOosState(oos: boolean) {
    if (!submitBtn) return;
    submitBtn.disabled = oos;
    submitBtn.style.background = oos ? "var(--clr-disabled)" : "";
    submitBtn.style.cursor     = oos ? "not-allowed" : "";
    submitBtn.textContent      = oos ? outOfStockLabel : submitLabel;
  }

  /**
   * Disables the + button and shows a stock-limit hint when qty reaches the cap.
   */
  function updateQtyState() {
    if (!qtyInput) return;
    const qty = parseInt(qtyInput.value) || 1;
    const atMax = hasStockCap && qty >= currentVariantMax;

    if (qtyPlusBtn) {
      qtyPlusBtn.disabled = atMax;
      qtyPlusBtn.style.opacity = atMax ? "0.4" : "";
      qtyPlusBtn.style.cursor  = atMax ? "not-allowed" : "";
    }

    if (qtyStockHint) {
      if (atMax) {
        qtyStockHint.textContent = qtyMaxStockLabel.replace("{n}", String(currentVariantMax));
        qtyStockHint.classList.remove("hidden");
      } else {
        qtyStockHint.classList.add("hidden");
      }
    }
  }

  /**
   * Finds the variant object matching all selected options and updates price/state.
   */
  function updateVariant() {
    const match = variants.find((v) =>
      Object.entries(v.variations).every(([k, val]) => selectedOpts[k] === val)
    );
    if (!match) return;

    currentPrice = match.price;
    if (priceInput) priceInput.value = String(match.price);
    if (variantIdInput) variantIdInput.value = match.id;
    if (variantLabelInput) {
      variantLabelInput.value = Object.values(match.variations).join(" / ");
    }

    // Combination-level OOS: disable submit if this exact variant is sold out
    setVariantOosState(trackInventory && match.inventory === 0);

    // Stock cap: prevent qty from exceeding available inventory
    if (trackInventory && match.inventory > 0) {
      currentVariantMax = match.inventory;
      hasStockCap = true;
    } else {
      currentVariantMax = 100;
      hasStockCap = false;
    }
    if (qtyInput) {
      qtyInput.max = String(currentVariantMax);
      const curQty = parseInt(qtyInput.value) || 1;
      if (curQty > currentVariantMax) qtyInput.value = String(currentVariantMax);
    }
    updateQtyState();

    // Jump gallery to the variant's assigned image (if any)
    if (match.imageId && gallery) {
      const slide = gallery.querySelector<HTMLElement>(`[data-image-id="${match.imageId}"]`);
      if (slide) {
        const index = Array.from(gallery.children).indexOf(slide);
        if (index >= 0) goToImage(index);
      }
    }

    // Refresh dependent UI
    if (tierLabels.length > 0) {
      updateTierPrices();
      updateTierVisibility();
    }
    updatePriceUI();
  }

  // ── QUANTITY STEPPER ───────────────────────────────────────────────────────
  
  document.getElementById("qty-minus")?.addEventListener("click", () => {
    if (!qtyInput) return;
    const v = Math.max(1, parseInt(qtyInput.value) || 1);
    if (v > 1) { qtyInput.value = String(v - 1); updatePriceUI(); updateQtyState(); }
  });

  document.getElementById("qty-plus")?.addEventListener("click", () => {
    if (!qtyInput) return;
    const v = Math.max(1, parseInt(qtyInput.value) || 1);
    if (v < currentVariantMax) { qtyInput.value = String(v + 1); updatePriceUI(); updateQtyState(); }
  });

  qtyInput?.addEventListener("input", () => {
    if (!qtyInput) return;
    const max = currentVariantMax;
    let v = parseInt(qtyInput.value) || 1;
    if (v > max) { v = max; qtyInput.value = String(max); }
    if (v < 1)   { v = 1;   qtyInput.value = "1"; }
    updatePriceUI();
    updateQtyState();
  });

  // ── DELIVERY & SHIPPING ────────────────────────────────────────────────────

  // Rates ride in on the shipping bridge, which can already be in the DOM at
  // mount. This subscription lives here — after every piece of state
  // `refreshShipping` touches — so the callback, whenever it fires, never
  // meets an uninitialized binding. (Historical note: registering this at the
  // top of initProductPage delivered rates synchronously into a TDZ
  // ReferenceError that killed the page's whole init, commune selector
  // included.)
  watchShippingRates((loaded) => {
    rates = loaded;
    refreshShipping();
  });

  // Delivery type, the address field and commune loading are shared with
  // the checkout page so the two cannot drift apart — see delivery-fields.ts.
  bindDeliveryFields(
    { communeLoading, communePlaceholder, communeDisabled },
    { isRTL, onChange: refreshShipping },
  );

  /**
   * Recalculates shipping cost based on selected wilaya and delivery type.
   */
  function refreshShipping() {
    // 1. Check for free shipping offers
    const selOffer = allOffers.find(o => o.id === currentOfferId);
    if (selOffer?.discountType === "free_shipping") {
      currentShipping = 0;
      updatePriceUI();
      return;
    }

    // 2. Otherwise the merchant's rate table decides.
    currentShipping = rateFor(rates, selectedWilayaId(), currentDeliveryType());
    updatePriceUI();
  }


  // ── GALLERY INTERACTIVITY ──────────────────────────────────────────────────

  /**
   * Slide offset for an index, signed for the track's writing direction.
   *
   * Every slide is exactly one track wide, so the offset is a multiple of the
   * width. In RTL the scroll origin is the right edge and `scrollLeft` runs
   * negative, so reading takes the magnitude and writing takes the sign back.
   */
  function slideSign(track: HTMLElement): number {
    return getComputedStyle(track).direction === "rtl" ? -1 : 1;
  }

  /**
   * Updates the visual indicators for the image at `i`.
   *
   * A dot's button is a 44px tap target; the dot the shopper sees is the span
   * inside it, so the active styling belongs there — styling the button would
   * shrink the tap target and leave the dot itself unchanged.
   */
  function setActive(i: number) {
    dots.forEach((d, j) => {
      const pip = d.firstElementChild as HTMLElement | null;
      if (!pip) return;
      pip.style.width   = j === i ? "1.25rem" : "0.5rem";
      pip.style.opacity = j === i ? "1" : "0.3";
    });
    thumbs.forEach((t, j) => {
      t.style.borderColor = j === i ? "var(--clr-primary)" : "transparent";
      t.style.opacity     = j === i ? "1" : "0.6";
    });
  }

  /** Scrolls the track to image `i` and marks it active. */
  function goToImage(i: number) {
    if (!gallery) return;
    gallery.scrollTo({
      left: slideSign(gallery) * i * gallery.clientWidth,
      behavior: "smooth",
    });
    setActive(i);
  }

  // Scroll tracking, read once per frame: the scroll event fires far more
  // often than the indicators can meaningfully change.
  let galleryFrame = 0;
  gallery?.addEventListener("scroll", () => {
    if (galleryFrame) return;
    galleryFrame = requestAnimationFrame(() => {
      galleryFrame = 0;
      const width = gallery.clientWidth;
      if (width > 0) setActive(Math.round(Math.abs(gallery.scrollLeft) / width));
    });
  }, { passive: true });

  // Dots (mobile) and thumbnails (desktop) both jump to their image.
  [...dots, ...thumbs].forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.index);
      if (Number.isInteger(i)) goToImage(i);
    });
  });

  // ── SUBMIT GUARD ───────────────────────────────────────────────────────────
  const form = document.querySelector<HTMLFormElement>("form[method='POST']");
  form?.addEventListener("submit", () => {
    if (submitBtn) submitBtn.disabled = true;
  });

  // ── ALGERIAN PHONE VALIDATION ──────────────────────────────────────────────
  // Normalizes to the canonical local form "05XXXXXXXX" on blur and blocks
  // submit with a localized message for anything that is not an Algerian
  // mobile. The server re-validates (storeOrderSchema) — this is UX, not the
  // enforcement point.
  const phoneInput = document.getElementById("f-phone") as HTMLInputElement | null;
  const phoneInvalidMsg = el.dataset.phoneInvalid || "Invalid phone number";

  function toLocalDzMobile(raw: string): string | null {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00213")) digits = digits.slice(5);
    else if (digits.startsWith("213")) digits = digits.slice(3);
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    return /^[567]\d{8}$/.test(local) ? "0" + local : null;
  }

  if (phoneInput) {
    phoneInput.addEventListener("blur", () => {
      if (!phoneInput.value.trim()) {
        phoneInput.setCustomValidity("");
        return;
      }
      const normalized = toLocalDzMobile(phoneInput.value);
      if (normalized) {
        phoneInput.value = normalized;
        phoneInput.setCustomValidity("");
      } else {
        phoneInput.setCustomValidity(phoneInvalidMsg);
        phoneInput.reportValidity();
      }
    });
    phoneInput.addEventListener("input", () => {
      phoneInput.setCustomValidity("");
    });
  }

  // ── FINAL INITIALIZATION ───────────────────────────────────────────────────
  // Show the default active tier's variant section (base tier is always default)
  if (tierLabels.length > 0) {
    document.getElementById("tier-variants-base")?.classList.remove("hidden");
  }
  // Run variant OOS check for the pre-selected default combination
  if (variants.length > 0) {
    updateVariant();
  } else {
    // Simple product — apply stock cap from product-level inventory
    if (trackInventory && productInventory > 0) {
      currentVariantMax = productInventory;
      hasStockCap = true;
      if (qtyInput) qtyInput.max = String(productInventory);
    }
    updatePriceUI();
    updateQtyState();
  }
  
  // Initialize address fields visibility based on default delivery type (home)
  toggleAddressFields();

  // ── META PIXEL EVENTS ─────────────────────────────────────────────────────
  const pixelId   = el.dataset.pixelId || "";
  const productId = el.dataset.productId || "";

  function getCookie(name: string): string | null {
    return (
      document.cookie
        .split("; ")
        .find((r) => r.startsWith(name + "="))
        ?.split("=")[1] ?? null
    );
  }

  // 1. ViewContent — fires once immediately after page init
  if (pixelId) {
    // trackAt, not track: this page's events belong to the pixel the page
    // loaded — which on a landing page with its own pixel is not the store's.
    trackAt(pixelId, "ViewContent", {
      content_ids: [productId],
      content_type: "product",
      value: currentPrice,
      currency: "DZD",
    });
  }

  // 2. InitiateCheckout — fires once when the shopper STARTS the checkout:
  //    first focus, keystroke, or selection inside the order form. Seeing the
  //    form is not starting checkout — Meta's event means the process began.
  if (pixelId) {
    const orderSection = document.getElementById("order-section");
    if (orderSection) {
      let checkoutStarted = false;
      const fireInitiateCheckout = () => {
        if (checkoutStarted) return;
        checkoutStarted = true;
        trackAt(pixelId, "InitiateCheckout", {
          content_ids: [productId],
          content_type: "product",
          value: currentPrice,
          currency: "DZD",
        });
        orderSection.removeEventListener("focusin", fireInitiateCheckout);
        orderSection.removeEventListener("input", fireInitiateCheckout);
        orderSection.removeEventListener("change", fireInitiateCheckout);
      };
      orderSection.addEventListener("focusin", fireInitiateCheckout);
      orderSection.addEventListener("input", fireInitiateCheckout);
      orderSection.addEventListener("change", fireInitiateCheckout);
    }
  }

  // 3. Populate fbc/fbp hidden inputs right before form submits so the values
  //    travel with the order payload to cod-server for CAPI attribution.
  const orderForm = document.querySelector<HTMLFormElement>("form[method=POST]");
  const fbcInput = document.getElementById("fbc-input") as HTMLInputElement | null;
  const fbpInput = document.getElementById("fbp-input") as HTMLInputElement | null;
  if (orderForm && (fbcInput || fbpInput)) {
    orderForm.addEventListener("submit", () => {
      if (fbcInput) fbcInput.value = getCookie("_fbc") ?? "";
      if (fbpInput) fbpInput.value = getCookie("_fbp") ?? "";
    });
  }
}

/**
 * AUTO-INITIALIZATION
 * The storefront does not use Astro view transitions (ClientRouter
 * was removed because it caused dynamic <script type="module"> fetches
 * to be served with empty Content-Type by the SSR worker, breaking
 * strict-MIME-checked module loading and silently disabling every
 * interactive element on the page). Without ClientRouter,
 * `astro:page-load` is never fired, so we bind to DOMContentLoaded
 * instead — and run immediately if the document is already parsed
 * by the time this script evaluates.
 */
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initProductPage());
  } else {
    initProductPage();
  }
}

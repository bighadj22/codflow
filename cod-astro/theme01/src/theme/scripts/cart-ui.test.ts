/**
 * Cart drawer controller — behaviour tests.
 *
 * `cart.ts` (the store) was covered from the start; the controller that drives
 * the drawer was not, and that is exactly where the defects a merchant reported
 * as "the cart behaves weird" were living.
 *
 * These tests drive the REAL markup that `CartDrawer.astro`, `CartBadge.astro`,
 * `AddToCartButton.astro` and `OrderForm.astro` render, and they reproduce the
 * REAL boot sequence: `StoreLayout.astro` renders a module script, so importing
 * `cart-ui` runs its self-init and the layout may call `initCart()` as well.
 * Anything that only holds when the controller is initialised exactly once is
 * not a property the storefront actually has.
 */
/// <reference types="vitest/globals" />

import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CART_KEY = "cod_cart_v1";

/** Mirrors CartDrawer.astro + CartBadge.astro + OrderForm.astro hidden fields. */
function buildDom(options: { currency?: string } = {}): void {
  const currency = options.currency ?? "DA";
  document.body.innerHTML = `
    <header>
      <button type="button" id="cart-badge" hidden aria-expanded="false">
        <span id="cart-badge-count" hidden>0</span>
      </button>
    </header>

    <main>
      <form method="POST">
        <input type="hidden" name="productId" value="p1" />
        <input type="hidden" name="pricePerUnit" value="1000" id="price-input" />
        <input type="hidden" name="variantId" value="v-default" id="variant-id-input" />
        <input type="hidden" name="variantLabel" value="" id="variant-label-input" />
        <input type="hidden" name="variantSelections" value="[]" id="variant-selections-input" />
        <input type="number" name="quantity" id="qty-input" value="1" min="1" max="100" />
        <input type="text" name="customerName" />
      </form>

      <button
        type="button"
        data-add-to-cart
        data-product-id="p1"
        data-product-name="Street Fighter 45"
        data-product-href="/products/street-fighter-45"
        data-unit-price="1000"
        data-variant-id="v-default"
        data-variant-label="Kaki"
        data-image="/img/sf45.jpg"
      >Add</button>
    </main>

    <div
      id="cart-root"
      data-currency="${currency}"
      data-copy-items="{n} items"
      data-copy-out-of-stock="Only {n} left"
      data-copy-unavailable="No longer available"
      data-copy-free-earned="Free delivery earned"
      data-copy-free-remaining="{amount} {currency} to free delivery"
      hidden
    >
      <div id="cart-scrim" hidden></div>
      <aside id="cart-drawer" role="dialog" aria-modal="true" hidden>
        <h2 id="cart-drawer-title">Cart</h2>
        <p id="cart-items-label"></p>
        <button type="button" id="cart-close">x</button>
        <div id="cart-empty" hidden>
          <button type="button" id="cart-continue">Continue</button>
        </div>
        <div id="cart-lines" hidden><ul id="cart-line-list"></ul></div>
        <div id="cart-footer" hidden>
          <div id="cart-free-delivery" hidden>
            <p id="cart-free-delivery-text"></p>
            <div id="cart-free-delivery-bar"></div>
          </div>
          <p id="cart-blocked-note" hidden>Fix before checkout</p>
          <span id="cart-subtotal"></span>
          <button type="button" id="cart-checkout">Checkout</button>
        </div>
      </aside>
    </div>

    <template id="cart-line-template">
      <li data-cart-line>
        <a data-cart-image-link aria-hidden="true" tabindex="-1"><img data-cart-image alt="" hidden /></a>
        <a data-cart-name></a>
        <p data-cart-variant hidden></p>
        <p data-cart-warning hidden></p>
        <button type="button" data-cart-decrease>-</button>
        <span data-cart-qty></span>
        <button type="button" data-cart-increase>+</button>
        <span data-cart-total></span>
        <button type="button" data-cart-remove>bin</button>
      </li>
    </template>
  `;
}

/**
 * Boot the controller the way a real page does.
 *
 * `once: true` isolates a single initialisation for tests that are about
 * something else; the default reproduces production, where the module's own
 * self-init runs on import.
 */
let teardown: (() => void) | null = null;

/**
 * Where the controller tried to send the browser.
 *
 * `window.location` is replaced rather than spied on: assigning `href` for
 * real would tear the test document down mid-assertion.
 */
let navigatedTo: string | null = null;
let realLocation: Location;

function stubNavigation(): void {
  navigatedTo = null;
  realLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return navigatedTo ?? "http://localhost/";
      },
      set href(url: string) {
        navigatedTo = url;
      },
    },
  });
}

function restoreNavigation(): void {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
}

async function boot() {
  vi.resetModules();
  const ui = await import("./cart-ui"); // module self-init, as in the browser
  teardown = ui.initCart();
  // StoreLayout used to call initCart() on top of the module's own self-init.
  // Binding twice has to stay harmless whichever way a page ends up wired.
  ui.initCart();
  const cart = await import("./cart");
  return { ui, cart };
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id} in test DOM`);
  return node as T;
}

function addButton(): HTMLElement {
  return document.querySelector<HTMLElement>("[data-add-to-cart]")!;
}

function click(node: Element): void {
  node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function storedCart(): Array<Record<string, unknown>> {
  return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
}

function validationResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: body }),
  } as unknown as Response);
}

beforeEach(() => {
  localStorage.clear();
  buildDom();
  stubNavigation();
  vi.useRealTimers();
  // Default: the server agrees with the optimistic view and says nothing extra.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      validationResponse({
        lines: [],
        subtotal: 0,
        freeDelivery: { fromOffer: false, threshold: null, qualified: false, remaining: 0 },
      }),
    ),
  );
});

afterEach(() => {
  // Listeners live on `document`, which outlives the per-test body. Without the
  // teardown the controller returns, every test would inherit the previous
  // tests' handlers — which is precisely the production bug, so leaving it
  // uncleaned would hide regressions behind noise.
  teardown?.();
  teardown = null;
  restoreNavigation();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

// ─────────────────────────────────────────────────────────────────────────────
// The boot sequence
// ─────────────────────────────────────────────────────────────────────────────

describe("initialisation is idempotent", () => {
  it("adds exactly one unit per click on the real boot sequence", async () => {
    await boot(); // module self-init + StoreLayout's initCart(), exactly like production

    click(addButton());

    expect(storedCart()).toHaveLength(1);
    expect(storedCart()[0].quantity).toBe(1);
  });

  it("increments by exactly one per tap on +", async () => {
    await boot();
    click(addButton());

    click(document.querySelector("[data-cart-increase]")!);

    expect(storedCart()[0].quantity).toBe(2);
  });

  it("decrements by exactly one per tap on -", async () => {
    await boot();
    click(addButton());
    el<HTMLInputElement>("qty-input").value = "1";
    click(document.querySelector("[data-cart-increase]")!);
    click(document.querySelector("[data-cart-increase]")!);
    expect(storedCart()[0].quantity).toBe(3);

    click(document.querySelector("[data-cart-decrease]")!);

    expect(storedCart()[0].quantity).toBe(2);
  });

  it("renders one row per cart line, never a duplicate set", async () => {
    await boot();
    click(addButton());

    expect(document.querySelectorAll("[data-cart-line]")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// What actually gets added
// ─────────────────────────────────────────────────────────────────────────────

describe("adds what the shopper chose, not what the page was built with", () => {
  it("uses the variant currently selected on the product page", async () => {
    await boot();
    // product.ts writes the live selection into these as the shopper taps.
    el<HTMLInputElement>("variant-id-input").value = "v-blue";
    el<HTMLInputElement>("variant-label-input").value = "Blue / XL";

    click(addButton());

    expect(storedCart()[0].variantId).toBe("v-blue");
    expect(storedCart()[0].variantLabel).toBe("Blue / XL");
  });

  it("keeps two different variants of one product as two lines", async () => {
    await boot();
    el<HTMLInputElement>("variant-id-input").value = "v-blue";
    el<HTMLInputElement>("variant-label-input").value = "Blue";
    click(addButton());

    el<HTMLInputElement>("variant-id-input").value = "v-red";
    el<HTMLInputElement>("variant-label-input").value = "Red";
    click(addButton());

    expect(storedCart()).toHaveLength(2);
    expect(storedCart().map((l) => l.variantId).sort()).toEqual(["v-blue", "v-red"]);
  });

  it("uses the quantity the shopper picked, not a hardcoded 1", async () => {
    await boot();
    el<HTMLInputElement>("qty-input").value = "3";

    click(addButton());

    expect(storedCart()[0].quantity).toBe(3);
  });

  it("uses the live price of the selected variant", async () => {
    await boot();
    el<HTMLInputElement>("price-input").value = "1450";

    click(addButton());

    expect(storedCart()[0].unitPrice).toBe(1450);
  });

  it("shows the variant label on the drawer row", async () => {
    await boot();
    el<HTMLInputElement>("variant-id-input").value = "v-blue";
    el<HTMLInputElement>("variant-label-input").value = "Blue / XL";

    click(addButton());

    const variantEl = document.querySelector<HTMLElement>("[data-cart-variant]")!;
    expect(variantEl.hidden).toBe(false);
    expect(variantEl.textContent).toBe("Blue / XL");
  });

  it("splits a multi-unit offer tier into one line per chosen variant", async () => {
    await boot();
    // A 3-pack where the shopper picked two Blue and one Red.
    el<HTMLInputElement>("qty-input").value = "3";
    el<HTMLInputElement>("variant-selections-input").value = JSON.stringify([
      { variantId: "v-blue", variantLabel: "Blue" },
      { variantId: "v-blue", variantLabel: "Blue" },
      { variantId: "v-red", variantLabel: "Red" },
    ]);

    click(addButton());

    const byVariant = Object.fromEntries(
      storedCart().map((l) => [l.variantId as string, l.quantity]),
    );
    expect(byVariant).toEqual({ "v-blue": 2, "v-red": 1 });
  });

  it("falls back to the button's own data when there is no order form", async () => {
    // A listing page: the add button exists, the product form does not.
    document.querySelector("form")!.remove();
    await boot();

    click(addButton());

    expect(storedCart()[0]).toMatchObject({
      productId: "p1",
      variantId: "v-default",
      variantLabel: "Kaki",
      quantity: 1,
      unitPrice: 1000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drawer lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe("drawer open/close", () => {
  it("opens on add and slides the sheet in", async () => {
    await boot();

    click(addButton());
    await nextFrame();

    expect(el("cart-drawer").hidden).toBe(false);
    expect(el("cart-scrim").hidden).toBe(false);
    expect(el("cart-badge").getAttribute("aria-expanded")).toBe("true");
    // `hidden` alone only makes the sheet renderable. `data-open` is what moves
    // it on screen — without it the shopper sees nothing but the scrim.
    expect(el("cart-drawer").hasAttribute("data-open")).toBe(true);
    expect(el("cart-scrim").hasAttribute("data-open")).toBe(true);
  });

  it("stays open when reopened during the closing animation", async () => {
    vi.useFakeTimers();
    await boot();
    click(addButton());
    vi.advanceTimersByTime(20);

    click(el("cart-close")); // starts the 200ms close
    vi.advanceTimersByTime(50);
    click(el("cart-badge")); // shopper changes their mind
    vi.advanceTimersByTime(400); // the old close timer would land here

    expect(el("cart-drawer").hidden).toBe(false);
    expect(el("cart-drawer").hasAttribute("data-open")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape and restores page scrolling", async () => {
    vi.useFakeTimers();
    await boot();
    click(addButton());
    vi.advanceTimersByTime(20);

    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    vi.advanceTimersByTime(400);

    expect(el("cart-drawer").hidden).toBe(true);
    expect(el("cart-drawer").hasAttribute("data-open")).toBe(false);
    expect(el("cart-scrim").hasAttribute("data-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("does not re-open after a close that raced an open frame", async () => {
    vi.useFakeTimers();
    await boot();

    click(addButton()); // queues the open frame
    click(el("cart-close")); // closes before that frame runs
    vi.advanceTimersByTime(400);

    expect(el("cart-drawer").hasAttribute("data-open")).toBe(false);
  });

  it("keeps focus inside the dialog while it is open", async () => {
    await boot();
    click(addButton());

    const focusables = el("cart-drawer").querySelectorAll<HTMLElement>("button");
    const last = focusables[focusables.length - 1];
    last.focus();
    last.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );

    expect(el("cart-drawer").contains(document.activeElement)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server reconciliation
// ─────────────────────────────────────────────────────────────────────────────

describe("server reconciliation", () => {
  it("blocks checkout and explains when a line can no longer be ordered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        validationResponse({
          lines: [
            {
              productId: "p1",
              variantId: "v-default",
              quantity: 1,
              unitPrice: 1000,
              lineTotal: 1000,
              maxQuantity: 0,
              blocker: "out_of_stock",
            },
          ],
          subtotal: 0,
          freeDelivery: { fromOffer: false, threshold: null, qualified: false, remaining: 0 },
        }),
      ),
    );
    await boot();

    click(addButton());
    await vi.waitFor(() => expect(el("cart-blocked-note").hidden).toBe(false));

    expect(el<HTMLButtonElement>("cart-checkout").disabled).toBe(true);
    expect(document.querySelector<HTMLElement>("[data-cart-warning]")!.textContent).toBe("Only 0 left");
  });

  it("leaves the optimistic view intact when validation fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await boot();

    click(addButton());
    await Promise.resolve();

    expect(document.querySelectorAll("[data-cart-line]")).toHaveLength(1);
    expect(el<HTMLButtonElement>("cart-checkout").disabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkout handoff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The drawer shows the basket; it does not take the order.
 *
 * It used to write the basket into the product page's order form and scroll to
 * it. That form is built around ONE product — its tiers, variant pickers and
 * price all describe that product — so a shopper with three things in the
 * basket read one total and was charged another. Checkout is its own page now.
 */
describe("checkout", () => {
  it("sends the shopper to the checkout page", async () => {
    await boot();
    click(addButton());

    click(el("cart-checkout"));

    expect(navigatedTo).toBe("/checkout");
  });

  it("does not touch the product page's order form", async () => {
    await boot();
    click(addButton());

    click(el("cart-checkout"));

    // The single-product form is the express path and stays exactly as it is.
    expect(el<HTMLInputElement>("price-input").value).toBe("1000");
    expect(el<HTMLInputElement>("variant-id-input").value).toBe("v-default");
  });

  it("just closes when the shopper is already on the checkout page", async () => {
    vi.useFakeTimers();
    await boot();
    click(addButton());
    vi.advanceTimersByTime(20);
    // The checkout page renders this root, and the drawer is available there
    // through the header badge like everywhere else.
    document.body.insertAdjacentHTML("beforeend", `<div id="checkout-root"></div>`);

    click(el("cart-checkout"));
    vi.advanceTimersByTime(400);

    expect(navigatedTo).toBeNull();
    expect(el("cart-drawer").hidden).toBe(true);
  });

  it("does nothing while a line cannot be ordered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        validationResponse({
          lines: [
            {
              productId: "p1",
              variantId: "v-default",
              quantity: 1,
              unitPrice: 1000,
              lineTotal: 1000,
              maxQuantity: 0,
              blocker: "out_of_stock",
            },
          ],
          subtotal: 0,
          freeDelivery: { fromOffer: false, threshold: null, qualified: false, remaining: 0 },
        }),
      ),
    );
    await boot();
    click(addButton());
    await vi.waitFor(() => expect(el<HTMLButtonElement>("cart-checkout").disabled).toBe(true));

    click(el("cart-checkout"));

    expect(navigatedTo).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Badge and empty state
// ─────────────────────────────────────────────────────────────────────────────

describe("badge and empty state", () => {
  it("shows the cart icon as soon as the cart works, empty or not", async () => {
    // A cart nobody can see is a cart nobody uses, and an icon that appears
    // only after the first add reads as a glitch. The markup ships it hidden
    // so a browser without JS or without storage shows no dead control.
    await boot();

    expect(el("cart-badge").hidden).toBe(false);
    expect(el("cart-badge-count").hidden).toBe(true);
  });

  it("shows the count bubble only once the basket has something in it", async () => {
    await boot();

    click(addButton());

    expect(el("cart-badge-count").hidden).toBe(false);
    expect(el("cart-badge-count").textContent).toBe("1");
  });

  it("returns to the empty state when the last line is removed", async () => {
    await boot();
    click(addButton());

    click(document.querySelector("[data-cart-remove]")!);

    expect(el("cart-empty").hidden).toBe(false);
    expect(el("cart-footer").hidden).toBe(true);
    expect(el("cart-badge").hidden).toBe(false);
    expect(el("cart-badge-count").hidden).toBe(true);
  });
});

/**
 * The way back to the product.
 *
 * The basket stored `href` from the day it shipped and never rendered it, so a
 * shopper looking at a line had no route back to the thing it came from. That
 * matters most for the commonest ask a basket creates — "the same one, in
 * another colour" — which belongs to the variant picker on the product page,
 * not to a second picker built into this sheet.
 */
describe("a line links back to its product", () => {
  it("links the product name", async () => {
    await boot();

    click(addButton());

    const name = document.querySelector<HTMLAnchorElement>("[data-cart-name]")!;
    expect(name.tagName).toBe("A");
    expect(name.getAttribute("href")).toBe("/products/street-fighter-45");
  });

  it("links the thumbnail to the same place, out of the tab order", async () => {
    // Two tab stops for one destination is noise for a keyboard shopper.
    await boot();

    click(addButton());

    const image = document.querySelector<HTMLAnchorElement>("[data-cart-image-link]")!;
    expect(image.getAttribute("href")).toBe("/products/street-fighter-45");
    expect(image.getAttribute("aria-hidden")).toBe("true");
    expect(image.getAttribute("tabindex")).toBe("-1");
  });

  it("leaves a line with no known product page unlinked", async () => {
    // A dead link that underlines on hover and goes nowhere is worse than
    // plain text; CSS also takes pointer events off an href-less line.
    addButton().removeAttribute("data-product-href");
    await boot();

    click(addButton());

    expect(document.querySelector("[data-cart-name]")!.hasAttribute("href")).toBe(false);
    expect(document.querySelector("[data-cart-image-link]")!.hasAttribute("href")).toBe(false);
  });
});

/**
 * The merchant's strongest lever for basket size, so it is the first thing in
 * the sheet rather than a footnote under the total.
 */
describe("free-delivery progress", () => {
  function thresholdOf(remaining: number, qualified: boolean, subtotal: number) {
    return {
      lines: [],
      subtotal,
      freeDelivery: { fromOffer: false, threshold: 4000, qualified, remaining },
    };
  }

  it("shows how far the shopper still has to go", async () => {
    vi.stubGlobal("fetch", vi.fn(() => validationResponse(thresholdOf(3000, false, 1000))));
    await boot();

    click(addButton());
    await vi.waitFor(() => expect(el("cart-free-delivery").hidden).toBe(false));

    expect(el("cart-free-delivery").dataset.state).toBe("progress");
    // Formatted the way the controller formats it, with no hardcoded separator.
    expect(el("cart-free-delivery-text").textContent).toBe(
      `${(3000).toLocaleString("ar-DZ")} DA to free delivery`,
    );
    expect(el("cart-free-delivery-bar").style.width).toBe("25%");
  });

  it("celebrates once it is earned", async () => {
    vi.stubGlobal("fetch", vi.fn(() => validationResponse(thresholdOf(0, true, 5000))));
    await boot();

    click(addButton());
    await vi.waitFor(() => expect(el("cart-free-delivery").dataset.state).toBe("earned"));

    expect(el("cart-free-delivery-text").textContent).toBe("Free delivery earned");
    expect(el("cart-free-delivery-bar").style.width).toBe("100%");
  });

  it("stays hidden for a merchant who set no threshold", async () => {
    await boot();

    click(addButton());
    await vi.waitFor(() => expect(document.querySelectorAll("[data-cart-line]")).toHaveLength(1));

    expect(el("cart-free-delivery").hidden).toBe(true);
  });

  it("disappears when the basket is emptied", async () => {
    vi.stubGlobal("fetch", vi.fn(() => validationResponse(thresholdOf(3000, false, 1000))));
    await boot();
    click(addButton());
    await vi.waitFor(() => expect(el("cart-free-delivery").hidden).toBe(false));

    click(document.querySelector("[data-cart-remove]")!);

    expect(el("cart-free-delivery").hidden).toBe(true);
  });
});

describe("Meta Pixel", () => {
  afterEach(() => Reflect.deleteProperty(window, "fbq"));

  it("reports an add to cart", async () => {
    const fbq = vi.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    await boot();
    el<HTMLInputElement>("qty-input").value = "2";

    click(addButton());

    const addEvents = fbq.mock.calls.filter((call) => call[1] === "AddToCart");
    expect(addEvents).toHaveLength(1);
    expect(addEvents[0][2]).toMatchObject({ content_ids: ["p1"], num_items: 2, currency: "DZD" });
  });

  it("stays silent for a store with no pixel", async () => {
    // No `fbq` at all. This must be a no-op, not an exception mid-add.
    await boot();

    expect(() => click(addButton())).not.toThrow();
    expect(storedCart()).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Static guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * happy-dom computes no styles, so nothing above can tell whether the sheet is
 * actually on screen — every assertion here would pass on a drawer parked one
 * full width to the right, which is exactly how it shipped.
 *
 * The regression: the markup positioned the sheet with Tailwind's
 * `translate-x-full`, which v4 compiles to the `translate` property, while the
 * controller tried to open it by assigning `style.transform`. Those are two
 * different properties, so the drawer un-hid off-screen and never arrived.
 * `rtl:-translate-x-full` compiled to nothing at all, because `rtl:` is not a
 * configured variant here.
 *
 * So the rule these tests pin is a boundary, not a spelling: CSS owns where the
 * sheet is, the controller owns only `data-open`.
 */
describe("the sheet's position is owned by CSS", () => {
  const HERE = resolve(__dirname, "../..");
  const controller = readFileSync(resolve(HERE, "theme/scripts/cart-ui.ts"), "utf8");
  const markup = readFileSync(resolve(HERE, "theme/components/cart/CartDrawer.astro"), "utf8");

  it("the controller never sets the sheet's position inline", () => {
    const offenders = [...controller.matchAll(/\.style\.(transform|translate|opacity)\s*=/g)].map(
      (m) => m[0],
    );
    expect(
      offenders,
      "The controller must not assign transform/translate/opacity — CSS in " +
        "CartDrawer.astro owns the open and closed positions, and an inline " +
        "assignment silently competes with the wrong property.",
    ).toEqual([]);
  });

  it("the markup defines both states and both directions", () => {
    expect(markup).toContain("#cart-drawer[data-open]");
    expect(markup).toContain("#cart-scrim[data-open]");
    expect(markup, "RTL is the default for an Algerian storefront").toContain(
      ':global([dir="rtl"]) #cart-drawer',
    );
  });

  it("the open state outranks the RTL closed state on specificity, not order", () => {
    // Both are (1 id, 2 attributes). Without this selector the sheet only
    // opens in Arabic because the rules happen to be written in this order.
    expect(markup).toContain(':global([dir="rtl"]) #cart-drawer[data-open]');
  });

  it("the markup does not position the sheet with translate utilities", () => {
    // These compile to the `translate` property, which is what made the
    // controller's `style.transform` a no-op.
    const classAttrs = [...markup.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).join(" ");
    expect(classAttrs).not.toMatch(/(^|\s)-?translate-x-/);
    expect(classAttrs).not.toMatch(/(^|\s)rtl:/);
  });

  it("the controller drives data-open and nothing else", () => {
    expect(controller).toContain('setAttribute("data-open"');
    expect(controller).toContain('removeAttribute("data-open")');
  });
});

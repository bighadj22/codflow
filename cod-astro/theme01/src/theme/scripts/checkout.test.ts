/**
 * Checkout page controller — behaviour tests.
 *
 * The basket is in the browser, so this page is a shell the controller fills.
 * That makes its states real states — loading, empty, priced, blocked — and
 * each one is a way the shopper can be stranded if it is wrong.
 *
 * Delivery gets the most attention here because it is the number that decides
 * what a COD customer hands over at the door: it must never read as free
 * before the shopper has chosen a wilaya the merchant actually priced.
 */
/// <reference types="vitest/globals" />

import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CART_KEY = "cod_cart_v1";

const RATES = JSON.stringify({
  "16": { home: 400, stopDesk: 250 },
  "31": { home: 600, stopDesk: 350 },
});

/** Mirrors checkout.astro + CheckoutSummary.astro + CustomerFields.astro. */
function buildDom(): void {
  document.body.innerHTML = `
    <div
      id="checkout-root"
      data-currency="DA"
      data-copy-items="{n} items"
      data-copy-out-of-stock="Only {n} left"
      data-copy-unavailable="No longer available"
      data-copy-free-earned="Free delivery earned"
      data-copy-free-remaining="{amount} {currency} to free delivery"
      data-copy-shipping-calculated="Calculated after selecting wilaya"
      data-copy-shipping-free="Free"
      data-copy-commune-loading="Loading"
      data-copy-commune-placeholder="Choose a commune"
      data-copy-commune-disabled="Pick a wilaya first"
    >
      <p id="checkout-loading">Getting your basket ready</p>

      <div id="checkout-empty" hidden><a href="/">Continue shopping</a></div>

      <div id="checkout-main" hidden>
        <section>
          <p id="checkout-items-label"></p>
          <ul id="checkout-line-list"></ul>
          <div id="checkout-free-delivery" hidden>
            <p id="checkout-free-delivery-text"></p>
            <div id="checkout-free-delivery-bar"></div>
          </div>
          <p id="checkout-blocked-note" hidden>Fix before checkout</p>
          <dl>
            <dd id="checkout-subtotal"></dd>
            <dd id="checkout-delivery"></dd>
            <dd id="checkout-total"></dd>
          </dl>
        </section>

        <form method="POST" id="checkout-form">
          <input type="hidden" name="items" value="" id="cart-items-input" />
          <input id="f-name" name="customerName" value="" />
          <input id="f-phone" name="phone" value="" />
          <input id="f-wilaya" name="wilayaId" value="" />
          <input id="f-commune" name="communeId" value="" />
          <div id="delivery-type-group">
            <label class="delivery-radio-label">
              <input type="radio" name="deliveryType" value="home" class="delivery-radio-input" checked />
              <div></div>
            </label>
            <label class="delivery-radio-label">
              <input type="radio" name="deliveryType" value="stop_desk" class="delivery-radio-input" />
              <div></div>
            </label>
          </div>
          <div id="address-field-container"><input id="f-address" /></div>
          <button type="submit" id="submit-btn">Confirm</button>
        </form>
      </div>
    </div>

    <template id="checkout-line-template">
      <li data-cart-line>
        <img data-cart-image alt="" hidden />
        <p data-cart-name></p>
        <p data-cart-variant hidden></p>
        <p data-cart-warning hidden></p>
        <button type="button" data-cart-decrease>-</button>
        <span data-cart-qty></span>
        <button type="button" data-cart-increase>+</button>
        <span data-cart-total></span>
        <button type="button" data-cart-remove>bin</button>
      </li>
    </template>

    <div id="shipping-rates-data" data-rates='${RATES}'></div>
  `;
}

function seedCart(lines: Array<Record<string, unknown>>): void {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    productId: "p1",
    productName: "Street Fighter 45",
    variantId: null,
    variantLabel: null,
    quantity: 1,
    unitPrice: 1000,
    ...overrides,
  };
}

let teardown: (() => void) | null = null;

async function boot() {
  vi.resetModules();
  const mod = await import("./checkout"); // self-init, as in the browser
  teardown = mod.initCheckout();
  mod.initCheckout(); // a second call must stay a no-op
  return mod;
}

/** Formatted exactly as the controller formats it — no hardcoded separator. */
const money = (n: number) => `${n.toLocaleString("ar-DZ")} DA`;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id} in test DOM`);
  return node as T;
}

function click(node: Element): void {
  node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

function chooseWilaya(value: string): void {
  const select = el<HTMLInputElement>("f-wilaya");
  select.value = value;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function chooseDelivery(value: string): void {
  const input = document.querySelector<HTMLInputElement>(
    `.delivery-radio-input[value="${value}"]`,
  )!;
  document
    .querySelectorAll<HTMLInputElement>(".delivery-radio-input")
    .forEach((r) => (r.checked = r === input));
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function validationResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: body }),
  } as unknown as Response);
}

function serverSays(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(() => validationResponse(body)));
}

beforeEach(() => {
  localStorage.clear();
  buildDom();
  vi.useRealTimers();
  // Default: the server offers no correction, so the optimistic view stands.
  vi.stubGlobal("fetch", vi.fn(() => validationResponse(null)));
});

afterEach(() => {
  teardown?.();
  teardown = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

// ─────────────────────────────────────────────────────────────────────────────

describe("page states", () => {
  it("shows the empty state when the shopper arrives with nothing", async () => {
    await boot();

    expect(el("checkout-loading").hidden).toBe(true);
    expect(el("checkout-empty").hidden).toBe(false);
    expect(el("checkout-main").hidden).toBe(true);
  });

  it("shows the basket when there is one", async () => {
    seedCart([line({ quantity: 2 })]);

    await boot();

    expect(el("checkout-loading").hidden).toBe(true);
    expect(el("checkout-empty").hidden).toBe(true);
    expect(el("checkout-main").hidden).toBe(false);
    expect(document.querySelectorAll("[data-cart-line]")).toHaveLength(1);
    expect(el("checkout-items-label").textContent).toBe("2 items");
  });

  it("shows the empty state when storage is unavailable", async () => {
    // A browser blocking storage cannot hold a basket, so there is nothing to
    // check out — say so rather than spin forever on the loading line.
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      await boot();
      expect(el("checkout-loading").hidden).toBe(true);
      expect(el("checkout-empty").hidden).toBe(false);
      expect(el("checkout-main").hidden).toBe(true);
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it("renders one row per line when initialised twice", async () => {
    seedCart([line()]);

    await boot();

    expect(document.querySelectorAll("[data-cart-line]")).toHaveLength(1);
  });
});

describe("delivery", () => {
  it("does not read as free before a wilaya is chosen", async () => {
    seedCart([line()]);

    await boot();

    expect(el("checkout-delivery").textContent).toBe("Calculated after selecting wilaya");
    // The basket total stands on its own; delivery is added once it is known.
    expect(el("checkout-total").textContent).toBe(money(1000));
  });

  it("charges the home rate for the chosen wilaya", async () => {
    seedCart([line()]);
    await boot();

    chooseWilaya("16");

    expect(el("checkout-delivery").textContent).toBe("400 DA");
    expect(el("checkout-total").textContent).toBe(money(1400));
  });

  it("charges the stop-desk rate when the shopper picks a stop desk", async () => {
    seedCart([line()]);
    await boot();
    chooseWilaya("16");

    chooseDelivery("stop_desk");

    expect(el("checkout-delivery").textContent).toBe("250 DA");
    expect(el("checkout-total").textContent).toBe(money(1250));
  });

  it("follows the shopper to another wilaya", async () => {
    seedCart([line()]);
    await boot();

    chooseWilaya("16");
    chooseWilaya("31");

    expect(el("checkout-delivery").textContent).toBe("600 DA");
    expect(el("checkout-total").textContent).toBe(money(1600));
  });

  it("is free, and says so, once the basket qualifies", async () => {
    seedCart([line({ quantity: 5 })]);
    serverSays({
      lines: [],
      subtotal: 5000,
      freeDelivery: { fromOffer: false, threshold: 4000, qualified: true, remaining: 0 },
    });
    await boot();
    await vi.waitFor(() => expect(el("checkout-free-delivery").hidden).toBe(false));

    chooseWilaya("16");

    expect(el("checkout-delivery").textContent).toBe("Free");
    expect(el("checkout-total").textContent).toBe(money(5000));
    expect(el("checkout-free-delivery-text").textContent).toBe("Free delivery earned");
  });

  it("marks the banner earned so the stylesheet can celebrate it", async () => {
    seedCart([line({ quantity: 5 })]);
    serverSays({
      lines: [],
      subtotal: 5000,
      freeDelivery: { fromOffer: false, threshold: 4000, qualified: true, remaining: 0 },
    });

    await boot();
    await vi.waitFor(() => expect(el("checkout-free-delivery").hidden).toBe(false));

    // The icon, the colour and whether the stripes move all follow from this.
    expect(el("checkout-free-delivery").dataset.state).toBe("earned");
    expect(el("checkout-free-delivery-bar").style.width).toBe("100%");
  });

  it("marks the banner in-progress while there is still distance to cover", async () => {
    seedCart([line({ quantity: 2 })]);
    serverSays({
      lines: [],
      subtotal: 2000,
      freeDelivery: { fromOffer: false, threshold: 4000, qualified: false, remaining: 2000 },
    });

    await boot();
    await vi.waitFor(() => expect(el("checkout-free-delivery").hidden).toBe(false));

    expect(el("checkout-free-delivery").dataset.state).toBe("progress");
    expect(el("checkout-free-delivery-bar").style.width).toBe("50%");
  });

  it("hides the banner once the basket is emptied", async () => {
    // It used to keep whatever the last non-empty render left behind, so an
    // emptied basket still promised free delivery.
    seedCart([line()]);
    serverSays({
      lines: [],
      subtotal: 1000,
      freeDelivery: { fromOffer: false, threshold: 4000, qualified: false, remaining: 3000 },
    });
    await boot();
    await vi.waitFor(() => expect(el("checkout-free-delivery").hidden).toBe(false));

    click(document.querySelector("[data-cart-remove]")!);

    expect(el("checkout-free-delivery").hidden).toBe(true);
  });

  it("shows how far the shopper is from free delivery", async () => {
    seedCart([line({ quantity: 3 })]);
    serverSays({
      lines: [],
      subtotal: 3000,
      freeDelivery: { fromOffer: false, threshold: 4000, qualified: false, remaining: 1000 },
    });

    await boot();
    await vi.waitFor(() => expect(el("checkout-free-delivery").hidden).toBe(false));

    expect(el("checkout-free-delivery-text").textContent).toBe(`${money(1000)} to free delivery`);
  });
});

describe("the server's verdict", () => {
  it("re-prices the basket from the catalog", async () => {
    // The browser thinks 1000; the catalog says 1200. The catalog wins.
    seedCart([line({ quantity: 2 })]);
    serverSays({
      lines: [
        {
          productId: "p1",
          variantId: null,
          quantity: 2,
          unitPrice: 1200,
          lineTotal: 2400,
          maxQuantity: null,
          blocker: null,
        },
      ],
      subtotal: 2400,
      freeDelivery: { fromOffer: false, threshold: null, qualified: false, remaining: 0 },
    });

    await boot();
    await vi.waitFor(() => expect(el("checkout-subtotal").textContent).toBe(money(2400)));

    expect(document.querySelector("[data-cart-total]")!.textContent).toBe(money(2400));
  });

  it("blocks the order and explains when a line cannot be fulfilled", async () => {
    seedCart([line()]);
    serverSays({
      lines: [
        {
          productId: "p1",
          variantId: null,
          quantity: 1,
          unitPrice: 1000,
          lineTotal: 1000,
          maxQuantity: 0,
          blocker: "out_of_stock",
        },
      ],
      subtotal: 0,
      freeDelivery: { fromOffer: false, threshold: null, qualified: false, remaining: 0 },
    });

    await boot();
    await vi.waitFor(() => expect(el("checkout-blocked-note").hidden).toBe(false));

    expect(el<HTMLButtonElement>("submit-btn").disabled).toBe(true);
    expect(document.querySelector("[data-cart-warning]")!.textContent).toBe("Only 0 left");
  });

  it("keeps the optimistic view when validation fails", async () => {
    seedCart([line()]);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

    await boot();
    await Promise.resolve();

    expect(document.querySelectorAll("[data-cart-line]")).toHaveLength(1);
    expect(el("checkout-subtotal").textContent).toBe(money(1000));
    expect(el<HTMLButtonElement>("submit-btn").disabled).toBe(false);
  });
});

/**
 * The drawer links a line back to its product. This page deliberately does
 * not: a shopper halfway through the delivery form who taps a product name
 * loses everything they typed, and here their job is to finish, not to browse.
 *
 * The guarantee is structural — this page's row template has no anchor to put
 * an href on — so the test reads the markup rather than the rendered output,
 * which would pass against a harness that simply forgot the anchor.
 */
describe("the checkout page deliberately does not link away", () => {
  const summary = readFileSync(
    resolve(__dirname, "../components/cart/CheckoutSummary.astro"),
    "utf8",
  );
  const drawer = readFileSync(resolve(__dirname, "../components/cart/CartDrawer.astro"), "utf8");

  it("renders the product name as text, not a link", () => {
    expect(summary).toMatch(/<p[^>]*\bdata-cart-name\b/);
    expect(summary).not.toMatch(/<a[^>]*\bdata-cart-name\b/);
  });

  it("has no linkable thumbnail either", () => {
    expect(summary).not.toContain("data-cart-image-link");
  });

  it("while the drawer does link both", () => {
    // The other half of the same decision, pinned in the same place so the two
    // surfaces cannot quietly converge.
    expect(drawer).toMatch(/<a[^>]*\bdata-cart-name\b/);
    expect(drawer).toContain("data-cart-image-link");
  });

  it("renders a plain name at runtime too", async () => {
    seedCart([line()]);
    await boot();

    const name = document.querySelector("[data-cart-name]")!;
    expect(name.hasAttribute("href")).toBe(false);
    expect(name.textContent).toBe("Street Fighter 45");
  });
});

describe("editing the basket here", () => {
  it("increments a line by exactly one", async () => {
    seedCart([line()]);
    await boot();

    click(document.querySelector("[data-cart-increase]")!);

    expect(document.querySelector("[data-cart-qty]")!.textContent).toBe("2");
    expect(el("checkout-subtotal").textContent).toBe(money(2000));
  });

  it("decrements a line by exactly one", async () => {
    seedCart([line({ quantity: 3 })]);
    await boot();

    click(document.querySelector("[data-cart-decrease]")!);

    expect(document.querySelector("[data-cart-qty]")!.textContent).toBe("2");
  });

  it("falls back to the empty state when the last line is removed", async () => {
    seedCart([line()]);
    await boot();

    click(document.querySelector("[data-cart-remove]")!);

    expect(el("checkout-empty").hidden).toBe(false);
    expect(el("checkout-main").hidden).toBe(true);
  });

  it("keeps the delivery fee across an edit", async () => {
    seedCart([line()]);
    await boot();
    chooseWilaya("16");

    click(document.querySelector("[data-cart-increase]")!);

    expect(el("checkout-delivery").textContent).toBe("400 DA");
    expect(el("checkout-total").textContent).toBe(money(2400));
  });
});

describe("Meta Pixel", () => {
  afterEach(() => Reflect.deleteProperty(window, "fbq"));

  function installPixel() {
    const fbq = vi.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    return fbq;
  }

  function initiateEvents(fbq: ReturnType<typeof vi.fn>) {
    return fbq.mock.calls.filter((call) => call[1] === "InitiateCheckout");
  }

  it("does not report a checkout merely because the page was opened", async () => {
    // Arriving is not starting. This is the same rule the product page uses.
    seedCart([line()]);
    const fbq = installPixel();

    await boot();

    expect(initiateEvents(fbq)).toHaveLength(0);
  });

  it("reports the basket once the shopper starts filling the form", async () => {
    seedCart([line({ quantity: 2 }), line({ productId: "p2", unitPrice: 2400 })]);
    const fbq = installPixel();
    await boot();

    el("f-name").dispatchEvent(new window.Event("focusin", { bubbles: true }));

    const events = initiateEvents(fbq);
    expect(events).toHaveLength(1);
    expect(events[0][2]).toMatchObject({
      content_ids: ["p1", "p2"],
      num_items: 3,
      currency: "DZD",
    });
  });

  it("reports it only once however much the shopper types", async () => {
    seedCart([line()]);
    const fbq = installPixel();
    await boot();

    el("f-name").dispatchEvent(new window.Event("focusin", { bubbles: true }));
    el("f-name").dispatchEvent(new window.Event("input", { bubbles: true }));
    chooseWilaya("16");

    expect(initiateEvents(fbq)).toHaveLength(1);
  });

  it("reports the value the server stands behind", async () => {
    // The browser would say 1000; the catalog says 1200.
    seedCart([line()]);
    serverSays({
      lines: [
        {
          productId: "p1",
          variantId: null,
          quantity: 1,
          unitPrice: 1200,
          lineTotal: 1200,
          maxQuantity: null,
          blocker: null,
        },
      ],
      subtotal: 1200,
      freeDelivery: { fromOffer: false, threshold: null, qualified: false, remaining: 0 },
    });
    const fbq = installPixel();
    await boot();
    await vi.waitFor(() => expect(el("checkout-subtotal").textContent).toBe(money(1200)));

    el("f-name").dispatchEvent(new window.Event("focusin", { bubbles: true }));

    expect(initiateEvents(fbq)[0][2].value).toBe(1200);
  });

  it("stays silent for a store with no pixel", async () => {
    seedCart([line()]);
    await boot();

    expect(() =>
      el("f-name").dispatchEvent(new window.Event("focusin", { bubbles: true })),
    ).not.toThrow();
  });
});

describe("submitting", () => {
  it("sends the basket as it stands at submit time", async () => {
    seedCart([line()]);
    await boot();
    click(document.querySelector("[data-cart-increase]")!);

    el("checkout-form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );

    const items = JSON.parse(el<HTMLInputElement>("cart-items-input").value);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: "p1", quantity: 2 });
  });

  it("sends every line of a multi-product basket", async () => {
    seedCart([
      line(),
      line({ productId: "p2", productName: "Hoodie", quantity: 2, unitPrice: 2400 }),
    ]);
    await boot();

    el("checkout-form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );

    const items = JSON.parse(el<HTMLInputElement>("cart-items-input").value);
    expect(items.map((i: { productId: string }) => i.productId)).toEqual(["p1", "p2"]);
  });
});

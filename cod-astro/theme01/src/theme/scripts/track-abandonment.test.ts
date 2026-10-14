/**
 * Abandoned-checkout capture — behaviour tests.
 *
 * This is the merchant's callback list, and it is one of the most valuable
 * things the product does. Two properties matter most here and neither is
 * obvious from reading the module:
 *
 *   - A product page must capture exactly what it captured before carts
 *     existed, even when the shopper happens to have a basket in the drawer.
 *     Sending the basket there would have the merchant ring someone about
 *     things they were not buying on that page.
 *   - The checkout page must capture the basket at all. It did not, when the
 *     cart first shipped, which silently made the higher-value journey
 *     invisible on the callback list.
 */
/// <reference types="vitest/globals" />

import { vi } from "vitest";

const CART_KEY = "cod_cart_v1";

function customerFields(): string {
  return `
    <input id="f-name" value="" />
    <input id="f-phone" value="" />
    <select id="f-wilaya"><option value="">—</option><option value="16">16 · Alger</option></select>
    <select id="f-commune"><option value="">—</option></select>
    <label><input type="radio" name="deliveryType" value="home" class="delivery-radio-input" checked /></label>
  `;
}

/** A product page: the order form describes ONE product. */
function buildProductPage(): void {
  document.body.innerHTML = `
    <form>
      <input type="hidden" name="productId" value="p1" />
      <input type="hidden" name="productName" value="Street Fighter 45" />
      <input type="hidden" name="pricePerUnit" value="1000" />
      <input type="hidden" id="variant-id-input" value="v-kaki" />
      <input type="hidden" id="variant-label-input" value="Kaki" />
      ${customerFields()}
    </form>
  `;
}

/** The checkout page: the basket IS the checkout, and there is no flat product. */
function buildCheckoutPage(): void {
  document.body.innerHTML = `
    <div id="checkout-root">
      <form id="checkout-form">
        <input type="hidden" name="items" value="" id="cart-items-input" />
        ${customerFields()}
      </form>
    </div>
  `;
}

/** A form where the store enables WhatsApp OTP: the step and token both render. */
function buildOtpProductPage(): void {
  document.body.innerHTML = `
    <form>
      <input type="hidden" name="productId" value="p1" />
      <input type="hidden" name="productName" value="Street Fighter 45" />
      <input type="hidden" name="pricePerUnit" value="1000" />
      ${customerFields()}
      <input type="hidden" name="otpToken" id="otp-token-input" value="" />
      <div id="otp-step"></div>
    </form>
  `;
}

/** The off-default form: the token field always renders, the OTP step does not. */
function buildTokenOnlyProductPage(): void {
  document.body.innerHTML = `
    <form>
      <input type="hidden" name="productId" value="p1" />
      <input type="hidden" name="productName" value="Street Fighter 45" />
      <input type="hidden" name="pricePerUnit" value="1000" />
      ${customerFields()}
      <input type="hidden" name="otpToken" id="otp-token-input" value="" />
    </form>
  `;
}

/** Mirrors otp-step.ts: block the submit until a token is present. */
function otpGate(form: HTMLFormElement): void {
  form.addEventListener(
    "submit",
    (event) => {
      const token = form.querySelector<HTMLInputElement>("#otp-token-input");
      if (token?.value) return;
      event.preventDefault();
    },
    { capture: true },
  );
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

function typeContact(name = "Ahmed Benali", phone = "0551234567"): void {
  const nameEl = document.getElementById("f-name") as HTMLInputElement;
  const phoneEl = document.getElementById("f-phone") as HTMLInputElement;
  nameEl.value = name;
  phoneEl.value = phone;
  nameEl.dispatchEvent(new window.Event("input", { bubbles: true }));
  phoneEl.dispatchEvent(new window.Event("input", { bubbles: true }));
}

async function boot() {
  vi.resetModules();
  await import("./track-abandonment"); // self-runs on import, as in the browser
}

/** The payload of the Nth POST /api/abandoned, parsed. */
function sentPayloads(): Array<Record<string, any>> {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls
    .filter((call) => call[0] === "/api/abandoned")
    .map((call) => JSON.parse((call[1] as RequestInit).body as string));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, status: 204 } as Response)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  delete (window.navigator as { sendBeacon?: unknown }).sendBeacon;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("a product page captures one product, as it always did", () => {
  it("sends the flat product fields and no basket", async () => {
    buildProductPage();
    await boot();

    typeContact();
    await vi.advanceTimersByTimeAsync(3000);

    expect(sentPayloads()).toHaveLength(1);
    expect(sentPayloads()[0]).toMatchObject({
      customerName: "Ahmed Benali",
      phone: "0551234567",
      productId: "p1",
      productName: "Street Fighter 45",
      variantLabel: "Kaki",
      price: 1000,
    });
    expect(sentPayloads()[0].items).toBeUndefined();
  });

  it("does not send the basket even when the shopper has one in the drawer", async () => {
    // The shopper is filling THIS product's form. The drawer's contents are
    // not what they are abandoning here.
    seedCart([line({ productId: "other", productName: "Hoodie" })]);
    buildProductPage();
    await boot();

    typeContact();
    await vi.advanceTimersByTimeAsync(3000);

    expect(sentPayloads()[0].items).toBeUndefined();
    expect(sentPayloads()[0].productId).toBe("p1");
  });
});

describe("the checkout page captures the basket", () => {
  it("sends every line", async () => {
    seedCart([
      line({ quantity: 2, unitPrice: 2400, productName: "Hoodie Classic", variantLabel: "Noir / L" }),
      line({ productId: "p2", productName: "Street Fighter 45" }),
    ]);
    buildCheckoutPage();
    await boot();

    typeContact();
    await vi.advanceTimersByTimeAsync(3000);

    const payload = sentPayloads()[0];
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0]).toMatchObject({
      productName: "Hoodie Classic",
      variantLabel: "Noir / L",
      quantity: 2,
      unitPrice: 2400,
    });
  });

  it("values the abandonment at the basket subtotal", async () => {
    // There is no single unit price to read on this page; 2×2400 + 1×1000.
    seedCart([line({ quantity: 2, unitPrice: 2400 }), line({ productId: "p2" })]);
    buildCheckoutPage();
    await boot();

    typeContact();
    await vi.advanceTimersByTimeAsync(3000);

    expect(sentPayloads()[0].price).toBe(5800);
  });

  it("updates the record when the shopper edits the basket", async () => {
    seedCart([line(), line({ productId: "p2" })]);
    buildCheckoutPage();
    await boot();
    // Imported AFTER boot so this is the same module instance the script
    // subscribed to — boot() resets the registry, and subscribers live in it.
    const { removeLine, lineKey } = await import("./cart");
    typeContact();
    await vi.advanceTimersByTimeAsync(3000);

    removeLine(lineKey("p2", null));
    await vi.advanceTimersByTimeAsync(0);

    const last = sentPayloads().at(-1)!;
    expect(last.items).toHaveLength(1);
    expect(last.items[0].productId).toBe("p1");
  });

  it("sends no basket when there is nothing in it", async () => {
    // Contact details typed on an empty checkout page are still worth having.
    buildCheckoutPage();
    await boot();

    typeContact();
    await vi.advanceTimersByTimeAsync(3000);

    expect(sentPayloads()[0].items).toBeUndefined();
  });

  it("never sends more lines than the server accepts", async () => {
    // A storage value hand-edited past the cap must not turn every capture
    // into a 400 from the proxy. 25 in, at most 20 out.
    seedCart(
      Array.from({ length: 25 }, (_, i) => line({ productId: `p${i}`, productName: `Product ${i}` })),
    );
    buildCheckoutPage();
    await boot();

    typeContact();
    await vi.advanceTimersByTimeAsync(3000);

    expect(sentPayloads()[0].items).toHaveLength(20);
  });
});

describe("capture only happens when there is something to call back", () => {
  it("does not send without a usable phone number", async () => {
    buildCheckoutPage();
    seedCart([line()]);
    await boot();

    typeContact("Ahmed Benali", "123");
    await vi.advanceTimersByTimeAsync(3000);

    expect(sentPayloads()).toHaveLength(0);
  });

  it("does not send without a name", async () => {
    buildCheckoutPage();
    seedCart([line()]);
    await boot();

    typeContact("", "0551234567");
    await vi.advanceTimersByTimeAsync(3000);

    expect(sentPayloads()).toHaveLength(0);
  });

  it("waits for the shopper to stop typing", async () => {
    buildCheckoutPage();
    seedCart([line()]);
    await boot();

    typeContact();
    await vi.advanceTimersByTimeAsync(2000);
    expect(sentPayloads()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(sentPayloads()).toHaveLength(1);
  });

  it("never lets a tracking failure surface", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    buildCheckoutPage();
    seedCart([line()]);
    await boot();

    typeContact();

    await expect(vi.advanceTimersByTimeAsync(3000)).resolves.not.toThrow();
  });
});

describe("a placed order is never recorded as an abandonment", () => {
  /** The exit beacon is the only capture that fires on the submit navigation. */
  function stubBeacon() {
    const beacon = vi.fn(() => true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: beacon,
    });
    return beacon;
  }

  it("sends no exit beacon once the shopper submits the order", async () => {
    buildProductPage();
    await boot();
    const beacon = stubBeacon();

    typeContact();
    // The shopper commits before the 3 s debounce ever fires, then the submit
    // navigation unloads the page — exactly the fast test-order path.
    document
      .querySelector("form")!
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.Event("pagehide"));

    expect(beacon).not.toHaveBeenCalled();
    expect(sentPayloads()).toHaveLength(0);
  });

  it("still beacons on page exit when the shopper never submitted", async () => {
    buildCheckoutPage();
    seedCart([line()]);
    await boot();
    const beacon = stubBeacon();

    typeContact();
    window.dispatchEvent(new window.Event("pagehide"));

    expect(beacon).toHaveBeenCalled();
  });

  it("keeps capturing while the order is parked on the OTP step", async () => {
    buildOtpProductPage();
    const form = document.querySelector("form") as HTMLFormElement;
    otpGate(form);
    await boot();
    const beacon = stubBeacon();

    typeContact();
    // The OTP gate intercepts this submit and shows the code step — no order
    // is placed yet, so this must not silence the exit capture.
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.Event("pagehide"));

    expect(beacon).toHaveBeenCalled();
  });

  it("stops capturing once OTP verification has succeeded", async () => {
    buildOtpProductPage();
    const form = document.querySelector("form") as HTMLFormElement;
    otpGate(form);
    await boot();
    const beacon = stubBeacon();

    typeContact();
    const tokenInput = form.querySelector<HTMLInputElement>("#otp-token-input")!;
    tokenInput.value = "otp-token";
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.Event("pagehide"));

    expect(beacon).not.toHaveBeenCalled();
  });

  it("stops capturing after a parked OTP submit later succeeds", async () => {
    buildOtpProductPage();
    const form = document.querySelector("form") as HTMLFormElement;
    otpGate(form);
    await boot();
    const beacon = stubBeacon();

    typeContact();
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); // parked
    const tokenInput = form.querySelector<HTMLInputElement>("#otp-token-input")!;
    tokenInput.value = "otp-token";
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); // verified
    window.dispatchEvent(new window.Event("pagehide"));

    expect(beacon).not.toHaveBeenCalled();
  });

  it("stops capturing when OTP is off even though the token field is present", async () => {
    buildTokenOnlyProductPage();
    await boot();
    const beacon = stubBeacon();

    typeContact();
    document
      .querySelector("form")!
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    window.dispatchEvent(new window.Event("pagehide"));

    expect(beacon).not.toHaveBeenCalled();
  });
});

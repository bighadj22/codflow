/**
 * Meta Pixel cart events.
 *
 * Two properties carry all the risk here.
 *
 * A store with no pixel configured has no `fbq` at all, and every one of these
 * must be a silent no-op rather than an exception thrown in the middle of an
 * add-to-cart. That is a storefront-down bug, not an analytics bug.
 *
 * And AddToCart means "these were added", not "this is the basket". Sending
 * the whole basket on each tap would re-report everything already in it, and
 * the optimiser would bid against totals no shopper ever reached.
 */
/// <reference types="vitest/globals" />

import { afterEach, vi } from "vitest";
import { fbqSafe, trackAddToCart, trackAt, trackInitiateCheckout } from "./pixel";
import type { CartLine } from "./cart";

function line(overrides: Partial<CartLine> = {}): CartLine {
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

function installPixel(): ReturnType<typeof vi.fn> {
  const fbq = vi.fn();
  (window as unknown as { fbq: unknown }).fbq = fbq;
  return fbq;
}

function removePixel(): void {
  Reflect.deleteProperty(window, "fbq");
}

afterEach(() => {
  removePixel();
});

describe("a store with no pixel configured", () => {
  it("reports no pixel", () => {
    expect(fbqSafe()).toBeNull();
  });

  it("does not throw on add to cart", () => {
    expect(() => trackAddToCart([line()])).not.toThrow();
  });

  it("does not throw on checkout", () => {
    expect(() => trackInitiateCheckout([line()], 1000)).not.toThrow();
  });

  it("ignores an fbq that is not callable", () => {
    // The stub BaseHead installs is a function; anything else is not ours.
    (window as unknown as { fbq: unknown }).fbq = { queue: [] };

    expect(fbqSafe()).toBeNull();
    expect(() => trackAddToCart([line()])).not.toThrow();
  });
});

describe("AddToCart", () => {
  it("reports only what was just added", () => {
    const fbq = installPixel();

    trackAddToCart([line({ quantity: 2, unitPrice: 2400 })]);

    expect(fbq).toHaveBeenCalledTimes(1);
    const [, event, payload] = fbq.mock.calls[0];
    expect(event).toBe("AddToCart");
    expect(payload).toMatchObject({
      content_ids: ["p1"],
      content_type: "product",
      num_items: 2,
      value: 4800,
      currency: "DZD",
    });
    expect(payload.contents).toEqual([{ id: "p1", quantity: 2, item_price: 2400 }]);
  });

  it("reports a multi-variant add as one event covering every line", () => {
    // Adding a 3-pack with two colours creates two cart lines in one tap.
    const fbq = installPixel();

    trackAddToCart([
      line({ variantId: "blue", quantity: 2 }),
      line({ variantId: "red", quantity: 1 }),
    ]);

    expect(fbq).toHaveBeenCalledTimes(1);
    const payload = fbq.mock.calls[0][2];
    // One product, so one content id — but three units of it.
    expect(payload.content_ids).toEqual(["p1"]);
    expect(payload.num_items).toBe(3);
    expect(payload.value).toBe(3000);
  });

  it("lists each distinct product once", () => {
    const fbq = installPixel();

    trackAddToCart([line(), line({ productId: "p2", unitPrice: 2400 })]);

    expect(fbq.mock.calls[0][2].content_ids).toEqual(["p1", "p2"]);
  });

  it("sends nothing when nothing was added", () => {
    const fbq = installPixel();

    trackAddToCart([]);

    expect(fbq).not.toHaveBeenCalled();
  });
});

describe("InitiateCheckout", () => {
  it("reports the basket with the value it is given", () => {
    // The caller passes the server-validated subtotal — 2400 here, even though
    // the browser's own arithmetic would say 2000.
    const fbq = installPixel();

    trackInitiateCheckout([line({ quantity: 2 })], 2400);

    const [, event, payload] = fbq.mock.calls[0];
    expect(event).toBe("InitiateCheckout");
    expect(payload).toMatchObject({ num_items: 2, value: 2400, currency: "DZD" });
  });

  it("covers every line in the basket", () => {
    const fbq = installPixel();

    trackInitiateCheckout(
      [line({ quantity: 2, unitPrice: 2400 }), line({ productId: "p2" })],
      5800,
    );

    const payload = fbq.mock.calls[0][2];
    expect(payload.content_ids).toEqual(["p1", "p2"]);
    expect(payload.contents).toHaveLength(2);
    expect(payload.num_items).toBe(3);
  });

  it("sends nothing for an empty basket", () => {
    const fbq = installPixel();

    trackInitiateCheckout([], 0);

    expect(fbq).not.toHaveBeenCalled();
  });
});

describe("trackAt — firing at one named pixel", () => {
  afterEach(() => removePixel());

  it("sends the event to the pixel it was given, and no other", () => {
    // `track` reaches every pixel initialised on the page. On a landing page
    // with its own pixel that is currently the same thing — but a second
    // pixel appearing later (a partner tag, an additive mode) would silently
    // start reporting the same events into an ad account with no server
    // mirror behind them. trackSingle costs one argument and removes that.
    const fbq = installPixel();

    trackAt("1234567890", "ViewContent", { value: 5000, currency: "DZD" });

    expect(fbq).toHaveBeenCalledWith("trackSingle", "1234567890", "ViewContent", {
      value: 5000,
      currency: "DZD",
    });
  });

  it("does nothing when the store has no pixel configured", () => {
    // fbq does not exist at all then. An exception here happens mid-page on
    // a storefront, which is a storefront bug, not an analytics one.
    removePixel();

    expect(() => trackAt("1234567890", "ViewContent", {})).not.toThrow();
  });

  it("does nothing without a pixel id", () => {
    // An empty id would install an event against no pixel at all.
    const fbq = installPixel();

    trackAt("", "ViewContent", {});

    expect(fbq).not.toHaveBeenCalled();
  });
});

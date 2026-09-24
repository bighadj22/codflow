/**
 * Browser cart — behaviour and the ways storage actually fails.
 *
 * localStorage is the least reliable thing a storefront touches: it throws in
 * private mode, returns empty after cleared site data, and can hold whatever a
 * previous version or another tab left behind. These tests spend most of their
 * weight there, because a broken cart must degrade to "no cart" and never to a
 * broken page.
 *
 * Money is never asserted loosely: the cart is display-only, and the server
 * re-prices everything, but a subtotal that is wrong in the drawer still loses
 * the sale.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";

/** A localStorage good enough to be honest about, including its failure modes. */
function installStorage(
  options: { throwOnGet?: boolean; throwOnSet?: boolean } = {},
) {
  const store = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      if (options.throwOnGet) throw new DOMException("denied", "SecurityError");
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.throwOnSet) throw new DOMException("quota", "QuotaExceededError");
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return store;
}

async function freshCart() {
  vi.resetModules();
  return import("./cart");
}

const line = (overrides: Record<string, unknown> = {}) => ({
  productId: "p1",
  productName: "Shirt",
  variantId: null,
  variantLabel: null,
  quantity: 1,
  unitPrice: 1000,
  ...overrides,
}) as any;

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Adding ───────────────────────────────────────────────────────────────────

describe("cart - adding", () => {
  it("starts empty", async () => {
    const cart = await freshCart();
    expect(cart.getCart()).toEqual([]);
    expect(cart.cartCount()).toBe(0);
  });

  it("adds a line and persists it", async () => {
    const cart = await freshCart();
    cart.addLine(line());
    expect(cart.getCart()).toHaveLength(1);
    expect(cart.cartCount()).toBe(1);
  });

  it("merges the same product and variant, summing quantity", async () => {
    const cart = await freshCart();
    cart.addLine(line({ quantity: 2 }));
    cart.addLine(line({ quantity: 3 }));

    const lines = cart.getCart();
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(5);
  });

  it("keeps two variants of one product as separate lines", async () => {
    const cart = await freshCart();
    cart.addLine(line({ variantId: "red" }));
    cart.addLine(line({ variantId: "blue" }));
    expect(cart.getCart()).toHaveLength(2);
  });

  it("keeps the first variant label when a later add carries none", async () => {
    const cart = await freshCart();
    cart.addLine(line({ variantId: "red", variantLabel: "Red" }));
    cart.addLine(line({ variantId: "red" }));
    expect(cart.getCart()[0].variantLabel).toBe("Red");
  });

  it("refuses a 21st distinct line", async () => {
    const cart = await freshCart();
    for (let i = 0; i < 20; i += 1) cart.addLine(line({ productId: `p${i}` }));
    cart.addLine(line({ productId: "one-too-many" }));

    const lines = cart.getCart();
    expect(lines).toHaveLength(20);
    expect(lines.some((l) => l.productId === "one-too-many")).toBe(false);
  });

  it("still tops up a line already in a full cart", async () => {
    // Adding to something already in the basket is not a new line.
    const cart = await freshCart();
    for (let i = 0; i < 20; i += 1) cart.addLine(line({ productId: `p${i}` }));

    cart.addLine(line({ productId: "p0", quantity: 4 }));

    expect(cart.getCart().find((l) => l.productId === "p0")!.quantity).toBe(5);
  });

  it("caps a merged line at the per-line maximum", async () => {
    const cart = await freshCart();
    cart.addLine(line({ quantity: 60 }));
    cart.addLine(line({ quantity: 60 }));
    expect(cart.getCart()[0].quantity).toBe(cart.MAX_LINE_QUANTITY);
  });
});

// ─── Editing ──────────────────────────────────────────────────────────────────

describe("cart - editing", () => {
  it("sets a quantity", async () => {
    const cart = await freshCart();
    cart.addLine(line());
    cart.setQuantity(cart.lineKey("p1", null), 7);
    expect(cart.getCart()[0].quantity).toBe(7);
  });

  it("removes the line when quantity drops below one", async () => {
    // A stepper taken to zero means "remove", not "a line of nothing".
    const cart = await freshCart();
    cart.addLine(line());
    cart.setQuantity(cart.lineKey("p1", null), 0);
    expect(cart.getCart()).toHaveLength(0);
  });

  it("caps a set quantity at the maximum", async () => {
    const cart = await freshCart();
    cart.addLine(line());
    cart.setQuantity(cart.lineKey("p1", null), 5000);
    expect(cart.getCart()[0].quantity).toBe(cart.MAX_LINE_QUANTITY);
  });

  it("ignores a set on a line that is not there", async () => {
    const cart = await freshCart();
    cart.addLine(line());
    cart.setQuantity(cart.lineKey("does-not-exist", null), 5);
    expect(cart.getCart()).toHaveLength(1);
  });

  it("removes a line", async () => {
    const cart = await freshCart();
    cart.addLine(line({ productId: "a" }));
    cart.addLine(line({ productId: "b" }));
    cart.removeLine(cart.lineKey("a", null));

    expect(cart.getCart()).toHaveLength(1);
    expect(cart.getCart()[0].productId).toBe("b");
  });

  it("removes the right variant, not every line of that product", async () => {
    const cart = await freshCart();
    cart.addLine(line({ variantId: "red" }));
    cart.addLine(line({ variantId: "blue" }));
    cart.removeLine(cart.lineKey("p1", "red"));

    expect(cart.getCart()).toHaveLength(1);
    expect(cart.getCart()[0].variantId).toBe("blue");
  });

  it("clears everything after a successful order", async () => {
    const cart = await freshCart();
    cart.addLine(line());
    cart.clearCart();
    expect(cart.getCart()).toEqual([]);
  });
});

// ─── Totals ───────────────────────────────────────────────────────────────────

describe("cart - totals", () => {
  it("counts units, not lines", async () => {
    const cart = await freshCart();
    cart.addLine(line({ productId: "a", quantity: 2 }));
    cart.addLine(line({ productId: "b", quantity: 3 }));
    expect(cart.cartCount()).toBe(5);
  });

  it("sums the subtotal exactly", async () => {
    const cart = await freshCart();
    cart.addLine(line({ productId: "a", quantity: 2, unitPrice: 1500 }));
    cart.addLine(line({ productId: "b", quantity: 3, unitPrice: 900 }));
    expect(cart.cartSubtotal()).toBe(5700);
  });

  it("is zero for an empty cart", async () => {
    const cart = await freshCart();
    expect(cart.cartSubtotal()).toBe(0);
  });
});

// ─── Storage failure modes ────────────────────────────────────────────────────

describe("cart - hostile storage", () => {
  it("reads as empty when storage throws", async () => {
    installStorage({ throwOnGet: true });
    const cart = await freshCart();
    expect(cart.getCart()).toEqual([]);
    expect(cart.isCartAvailable()).toBe(true); // set/remove still work
  });

  it("reports itself unavailable when writing throws", async () => {
    // Private mode. The UI hides the cart rather than offering a broken one.
    installStorage({ throwOnSet: true });
    const cart = await freshCart();
    expect(cart.isCartAvailable()).toBe(false);
  });

  it("does not throw when a write fails, and still returns the new state", async () => {
    installStorage({ throwOnSet: true });
    const cart = await freshCart();

    const result = cart.addLine(line());

    // The render this click triggered still gets the right answer; it simply
    // will not survive a reload.
    expect(result).toHaveLength(1);
  });

  it("survives a value that is not JSON at all", async () => {
    const store = installStorage();
    store.set("cod_cart_v1", "not json {{{");
    const cart = await freshCart();
    expect(cart.getCart()).toEqual([]);
  });

  it("survives a stored value that is not an array", async () => {
    const store = installStorage();
    store.set("cod_cart_v1", JSON.stringify({ productId: "p1" }));
    const cart = await freshCart();
    expect(cart.getCart()).toEqual([]);
  });

  it("drops malformed lines but keeps the good ones", async () => {
    const store = installStorage();
    store.set(
      "cod_cart_v1",
      JSON.stringify([
        { productId: "good", productName: "Good", quantity: 1, unitPrice: 100 },
        { productId: "", productName: "No id", quantity: 1, unitPrice: 100 },
        { productId: "no-name", quantity: 1, unitPrice: 100 },
        { productId: "bad-qty", productName: "X", quantity: -3, unitPrice: 100 },
        { productId: "frac-qty", productName: "X", quantity: 1.5, unitPrice: 100 },
        null,
        "a string",
      ]),
    );
    const cart = await freshCart();

    const lines = cart.getCart();
    expect(lines).toHaveLength(1);
    expect(lines[0].productId).toBe("good");
  });

  it("repairs a hand-edited negative price to zero rather than trusting it", async () => {
    // The cart is display-only, but a negative subtotal on screen is a bug the
    // shopper sees. The server prices the order regardless.
    const store = installStorage();
    store.set(
      "cod_cart_v1",
      JSON.stringify([
        { productId: "p1", productName: "P", quantity: 1, unitPrice: -9999 },
      ]),
    );
    const cart = await freshCart();
    expect(cart.getCart()[0].unitPrice).toBe(0);
  });

  it("caps a hand-edited oversized quantity on read", async () => {
    const store = installStorage();
    store.set(
      "cod_cart_v1",
      JSON.stringify([
        { productId: "p1", productName: "P", quantity: 999999, unitPrice: 10 },
      ]),
    );
    const cart = await freshCart();
    expect(cart.getCart()[0].quantity).toBe(cart.MAX_LINE_QUANTITY);
  });

  it("truncates a stored basket that exceeds the line cap", async () => {
    const store = installStorage();
    store.set(
      "cod_cart_v1",
      JSON.stringify(
        Array.from({ length: 40 }, (_, i) => ({
          productId: `p${i}`,
          productName: "P",
          quantity: 1,
          unitPrice: 10,
        })),
      ),
    );
    const cart = await freshCart();
    expect(cart.getCart()).toHaveLength(cart.MAX_CART_LINES);
  });
});

// ─── The wire shape ───────────────────────────────────────────────────────────

describe("cart - order items", () => {
  it("maps to the shape the order form and validate endpoint expect", async () => {
    const cart = await freshCart();
    cart.addLine(line({ variantId: "red", variantLabel: "Red", quantity: 2 }));

    expect(cart.toOrderItems()).toEqual([
      {
        productId: "p1",
        productName: "Shirt",
        variantId: "red",
        variantLabel: "Red",
        quantity: 2,
        pricePerUnit: 1000,
      },
    ]);
  });

  it("omits variant fields rather than sending null", async () => {
    const cart = await freshCart();
    cart.addLine(line());

    const [item] = cart.toOrderItems();
    expect(item.variantId).toBeUndefined();
    expect(item.variantLabel).toBeUndefined();
  });
});

// ─── Invariants ───────────────────────────────────────────────────────────────

describe("cart - properties", () => {
  const lineArb = fc.record({
    productId: fc.constantFrom("p1", "p2", "p3"),
    variantId: fc.option(fc.constantFrom("red", "blue"), { nil: null }),
    quantity: fc.integer({ min: 1, max: 10 }),
    unitPrice: fc.integer({ min: 0, max: 5000 }),
  });

  it("never holds two lines with the same product and variant", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(lineArb, { maxLength: 15 }), async (adds) => {
        installStorage();
        const cart = await freshCart();
        for (const a of adds) cart.addLine(line(a));

        const keys = cart.getCart().map((l) => cart.lineKey(l.productId, l.variantId));
        expect(new Set(keys).size).toBe(keys.length);
      }),
    );
  });

  it("never exceeds the line cap or the per-line quantity cap", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(lineArb, { maxLength: 30 }), async (adds) => {
        installStorage();
        const cart = await freshCart();
        for (const a of adds) cart.addLine(line(a));

        const lines = cart.getCart();
        expect(lines.length).toBeLessThanOrEqual(cart.MAX_CART_LINES);
        for (const l of lines) {
          expect(l.quantity).toBeLessThanOrEqual(cart.MAX_LINE_QUANTITY);
          expect(l.quantity).toBeGreaterThanOrEqual(1);
        }
      }),
    );
  });

  it("never reports a negative count or subtotal", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(lineArb, { maxLength: 15 }), async (adds) => {
        installStorage();
        const cart = await freshCart();
        for (const a of adds) cart.addLine(line(a));

        expect(cart.cartCount()).toBeGreaterThanOrEqual(0);
        expect(cart.cartSubtotal()).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("round-trips through storage unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(lineArb, { maxLength: 10 }), async (adds) => {
        installStorage();
        const first = await freshCart();
        for (const a of adds) first.addLine(line(a));
        const before = first.getCart();

        // Same storage, fresh module: exactly what a page reload does.
        const second = await freshCart();
        expect(second.getCart()).toEqual(before);
      }),
    );
  });
});

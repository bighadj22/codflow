/**
 * Delivery details — behaviour tests.
 *
 * This module is the one place the product form and the checkout page agree on
 * how delivery works, so its contract is worth pinning hard: a commune list
 * that silently fails to load, or an address field that stays visible for a
 * stop-desk order, both end as an undeliverable parcel.
 */
/// <reference types="vitest/globals" />

import { vi } from "vitest";
import {
  parseShippingRates,
  rateFor,
  currentDeliveryType,
  selectedWilayaId,
  toggleAddressFields,
  bindDeliveryFields,
  watchShippingRates,
} from "./delivery-fields";

const COPY = {
  communeLoading: "Loading…",
  communePlaceholder: "Choose a commune",
  communeDisabled: "Pick a wilaya first",
};

let dispose: (() => void) | null = null;

function buildFields(): void {
  document.body.innerHTML = `
    <input id="f-wilaya" name="wilayaId" value="" />
    <input id="f-commune" name="communeId" value="" />
    <div id="delivery-type-group">
      <label class="delivery-radio-label">
        <input type="radio" name="deliveryType" value="home" class="delivery-radio-input" checked />
        <div class="border-[var(--clr-primary)] text-[var(--clr-primary)] bg-[var(--clr-primary)]/5 shadow-sm"></div>
      </label>
      <label class="delivery-radio-label">
        <input type="radio" name="deliveryType" value="stop_desk" class="delivery-radio-input" />
        <div class="border-[var(--clr-border)] text-[var(--clr-text-2)] bg-[var(--clr-surface-alt)]"></div>
      </label>
    </div>
    <div id="address-field-container"><input id="f-address" /></div>
  `;
}

function radio(value: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`.delivery-radio-input[value="${value}"]`)!;
}

function pick(value: string): void {
  const input = radio(value);
  document
    .querySelectorAll<HTMLInputElement>(".delivery-radio-input")
    .forEach((r) => (r.checked = r === input));
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function setWilaya(value: string): void {
  const select = document.getElementById("f-wilaya") as HTMLInputElement;
  select.value = value;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function communesResponse(rows: Array<{ id: string; name: string; nameAr: string }>) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: rows }),
  } as unknown as Response);
}

beforeEach(() => {
  buildFields();
  vi.stubGlobal("fetch", vi.fn(() => communesResponse([])));
  window.__selectPopulate = vi.fn();
  window.__selectSetLoading = vi.fn();
  window.__selectSetDisabled = vi.fn();
});

afterEach(() => {
  dispose?.();
  dispose = null;
  vi.unstubAllGlobals();
  // Declared non-optional in env.d.ts (Select.astro always installs them), so
  // they are removed rather than assigned undefined.
  Reflect.deleteProperty(window, "__selectPopulate");
  Reflect.deleteProperty(window, "__selectSetLoading");
  Reflect.deleteProperty(window, "__selectSetDisabled");
  document.body.innerHTML = "";
});

describe("parseShippingRates", () => {
  it("reads the bridge the server rendered", () => {
    expect(parseShippingRates('{"16":{"home":400,"stopDesk":250}}')).toEqual({
      16: { home: 400, stopDesk: 250 },
    });
  });

  it("treats anything unusable as no rates rather than throwing", () => {
    // A broken bridge shows "to be calculated"; it never takes the page down.
    expect(parseShippingRates("not json")).toEqual({});
    expect(parseShippingRates("[1,2]")).toEqual({});
    expect(parseShippingRates(null)).toEqual({});
    expect(parseShippingRates(undefined)).toEqual({});
  });
});

describe("rateFor", () => {
  const rates = { "16": { home: 400, stopDesk: 250 }, "31": { home: 600, stopDesk: 350 } };

  it("charges the home rate for home delivery", () => {
    expect(rateFor(rates, "16", "home")).toBe(400);
  });

  it("charges the stop-desk rate for a stop desk", () => {
    expect(rateFor(rates, "16", "stop_desk")).toBe(250);
  });

  it("reports an unknown wilaya as not yet known, not as free", () => {
    // Returning 0 here would quietly show free delivery for a wilaya the
    // merchant never priced.
    expect(rateFor(rates, "99", "home")).toBeNaN();
    expect(rateFor(rates, "", "home")).toBeNaN();
  });

  it("reports a malformed rate as not yet known", () => {
    expect(rateFor({ "16": { home: null, stopDesk: 250 } } as never, "16", "home")).toBeNaN();
  });
});

describe("delivery type", () => {
  it("defaults to home", () => {
    expect(currentDeliveryType()).toBe("home");
  });

  it("follows the checked radio", () => {
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    pick("stop_desk");

    expect(currentDeliveryType()).toBe("stop_desk");
  });

  it("hides the address field for a stop desk and restores it for home", () => {
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });
    const address = document.getElementById("address-field-container")!;

    pick("stop_desk");
    expect(address.classList.contains("hidden")).toBe(true);

    pick("home");
    expect(address.classList.contains("hidden")).toBe(false);
  });

  it("hides the address field on bind when a stop desk is already selected", () => {
    // Re-rendered after a validation error, the shopper's stop-desk choice is
    // restored by the server; the address field has to match it immediately.
    radio("home").checked = false;
    radio("stop_desk").checked = true;

    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    expect(document.getElementById("address-field-container")!.classList.contains("hidden")).toBe(
      true,
    );
  });

  it("moves the selected styling onto the chosen option", () => {
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    pick("stop_desk");

    const faces = document.querySelectorAll<HTMLElement>(".delivery-radio-label div");
    expect(faces[0].className).toContain("border-[var(--clr-border)]");
    expect(faces[1].className).toContain("border-[var(--clr-primary)]");
  });

  it("re-prices when the delivery type changes", () => {
    const onChange = vi.fn();
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange });

    pick("stop_desk");

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("communes", () => {
  it("resolves bundled wilaya communes instantly without network requests", () => {
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    setWilaya("16");

    expect(fetch).not.toHaveBeenCalled();
    expect(window.__selectSetLoading).not.toHaveBeenCalled();
    expect(window.__selectPopulate).toHaveBeenCalledTimes(1);
    const [fieldId, communes, placeholder] = (window.__selectPopulate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fieldId).toBe("f-commune");
    expect(placeholder).toBe(COPY.communePlaceholder);
    expect(communes).toContainEqual({ value: "c-16-001", label: "Alger Centre" });
    expect(communes.length).toBe(57);
  });

  it("uses the Arabic name for bundled communes in an Arabic storefront", () => {
    dispose = bindDeliveryFields(COPY, { isRTL: true, onChange: () => {} });

    setWilaya("16");

    expect(fetch).not.toHaveBeenCalled();
    expect(window.__selectPopulate).toHaveBeenCalledWith(
      "f-commune",
      expect.arrayContaining([{ value: "c-16-001", label: "الجزائر الوسطى" }]),
      COPY.communePlaceholder,
    );
  });

  it("falls back to network for an unbundled wilaya", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => communesResponse([{ id: "9901", name: "Custom Commune", nameAr: "بلدية مخصصة" }])),
    );
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    setWilaya("99");
    expect(window.__selectSetLoading).toHaveBeenCalledWith("f-commune", true, COPY.communeLoading);

    await vi.waitFor(() => expect(window.__selectPopulate).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith("/api/communes/99");
    expect(window.__selectPopulate).toHaveBeenCalledWith(
      "f-commune",
      [{ value: "9901", label: "Custom Commune" }],
      COPY.communePlaceholder,
    );
  });

  it("uses the Arabic name for unbundled wilaya from network in an Arabic storefront", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => communesResponse([{ id: "9901", name: "Custom Commune", nameAr: "بلدية مخصصة" }])),
    );
    dispose = bindDeliveryFields(COPY, { isRTL: true, onChange: () => {} });

    setWilaya("99");
    await vi.waitFor(() => expect(window.__selectPopulate).toHaveBeenCalled());

    expect(window.__selectPopulate).toHaveBeenCalledWith(
      "f-commune",
      [{ value: "9901", label: "بلدية مخصصة" }],
      COPY.communePlaceholder,
    );
  });

  it("empties the list instead of spinning forever when network fallback fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    setWilaya("99");
    await vi.waitFor(() => expect(window.__selectPopulate).toHaveBeenCalled());

    expect(window.__selectPopulate).toHaveBeenCalledWith("f-commune", [], COPY.communePlaceholder);
  });

  it("ignores a slow answer for an unbundled wilaya the shopper already moved off", async () => {
    const responses: Array<(rows: Array<{ id: string; name: string; nameAr: string }>) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            responses.push((rows) =>
              resolve({ ok: true, json: () => Promise.resolve({ data: rows }) } as Response),
            );
          }),
      ),
    );
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    setWilaya("98");
    setWilaya("99");
    responses[1]([{ id: "9901", name: "Custom 99", nameAr: "مخصصة 99" }]);
    responses[0]([{ id: "9801", name: "Custom 98", nameAr: "مخصصة 98" }]);
    await vi.waitFor(() => expect(window.__selectPopulate).toHaveBeenCalled());

    const labels = (window.__selectPopulate as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[1],
    );
    expect(labels).toEqual([[{ value: "9901", label: "Custom 99" }]]);
  });

  it("disables the commune field when the wilaya is cleared", () => {
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange: () => {} });

    setWilaya("");

    expect(window.__selectSetDisabled).toHaveBeenCalledWith("f-commune", COPY.communeDisabled);
  });

  it("re-prices when the wilaya changes", () => {
    const onChange = vi.fn();
    dispose = bindDeliveryFields(COPY, { isRTL: false, onChange });

    setWilaya("16");

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("stops listening once disposed", () => {
    const onChange = vi.fn();
    const off = bindDeliveryFields(COPY, { isRTL: false, onChange });

    off();
    setWilaya("16");
    pick("stop_desk");

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("watchShippingRates", () => {
  it("reads rates already on the page", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="shipping-rates-data" data-rates='{"16":{"home":400,"stopDesk":250}}'></div>`,
    );
    const onRates = vi.fn();

    dispose = watchShippingRates(onRates);

    await vi.waitFor(() =>
      expect(onRates).toHaveBeenCalledWith({ 16: { home: 400, stopDesk: 250 } }),
    );
  });

  it("never delivers synchronously — the caller may still be initializing", () => {
    // The bridge is present, but the first delivery is a microtask: a caller
    // mid-initialization (its later `const` bindings still in the temporal
    // dead zone) must never be re-entered during the watch call itself.
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="shipping-rates-data" data-rates='{"16":{"home":400,"stopDesk":250}}'></div>`,
    );
    const onRates = vi.fn();

    dispose = watchShippingRates(onRates);

    expect(onRates).not.toHaveBeenCalled();
  });

  it("a disposed watcher never delivers", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="shipping-rates-data" data-rates='{"16":{"home":400,"stopDesk":250}}'></div>`,
    );
    const onRates = vi.fn();

    const off = watchShippingRates(onRates);
    off();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onRates).not.toHaveBeenCalled();
  });

  it("waits for a server island that lands later", async () => {
    const onRates = vi.fn();
    dispose = watchShippingRates(onRates);
    expect(onRates).not.toHaveBeenCalled();

    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="shipping-rates-data" data-rates='{"31":{"home":600,"stopDesk":350}}'></div>`,
    );

    await vi.waitFor(() =>
      expect(onRates).toHaveBeenCalledWith({ 31: { home: 600, stopDesk: 350 } }),
    );
  });
});

describe("selectedWilayaId", () => {
  it("reads the current wilaya", () => {
    (document.getElementById("f-wilaya") as HTMLInputElement).value = "16";
    expect(selectedWilayaId()).toBe("16");
  });

  it("is empty when nothing is chosen", () => {
    expect(selectedWilayaId()).toBe("");
  });
});

describe("toggleAddressFields", () => {
  it("does nothing when the page has no address field", () => {
    document.getElementById("address-field-container")!.remove();
    expect(() => toggleAddressFields()).not.toThrow();
  });
});

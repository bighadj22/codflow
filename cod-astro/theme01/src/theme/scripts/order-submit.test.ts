/**
 * Client-side order submission — behaviour tests.
 *
 * The bug this module exists for: a failed order reloaded the page and wiped
 * every answer, so the shopper saw an empty form and no order was created.
 * These tests pin the two halves of the fix — a failure keeps the answers and
 * explains itself; a success navigates — and the guards around them.
 */
/// <reference types="vitest/globals" />

import { vi } from "vitest";
import {
  describeOrderFailure,
  initOrderSubmit,
  parseOrderStrings,
  type OrderResult,
} from "./order-submit";

const STRINGS = JSON.stringify({
  submitting: "Placing order...",
  errorGeneric: "Could not place your order.",
});

interface Harness {
  root: HTMLDivElement;
  form: HTMLFormElement;
  button: HTMLButtonElement;
}

/** Mirrors OrderForm.astro's form (product/landing) and checkout.astro's. */
function mount(options: { withSelect?: boolean } = {}): Harness {
  const root = document.createElement("div");
  root.innerHTML = `
    <form method="POST" data-order-form data-order-strings='${STRINGS}'>
      <input id="f-name" name="customerName" value="" />
      <input id="f-phone" name="phone" value="" />
      ${
        options.withSelect
          ? `<div class="custom-select-container" data-id="f-wilaya">
               <button type="button" id="f-wilaya-trigger"></button>
               <input type="hidden" name="wilayaId" id="f-wilaya" class="select-hidden-input" />
             </div>`
          : ""
      }
      <button type="submit" id="submit-btn">Confirm order</button>
    </form>
  `;
  document.body.appendChild(root);
  return {
    root,
    form: root.querySelector("form") as HTMLFormElement,
    button: root.querySelector("#submit-btn") as HTMLButtonElement,
  };
}

function submit(form: HTMLFormElement): boolean {
  return form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function success(
  overrides: Partial<{ orderNumber: string; orderId: string | null; total: number }> = {},
): OrderResult {
  return {
    data: {
      orderNumber: overrides.orderNumber ?? "ORD-1",
      orderId: overrides.orderId ?? "oid-1",
      total: overrides.total ?? 5000,
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("parseOrderStrings", () => {
  it("reads the two strings", () => {
    expect(parseOrderStrings(STRINGS)).toEqual({
      submitting: "Placing order...",
      errorGeneric: "Could not place your order.",
    });
  });

  it("falls back to empty strings on bad JSON or missing keys", () => {
    expect(parseOrderStrings(undefined)).toEqual({ submitting: "", errorGeneric: "" });
    expect(parseOrderStrings("not json")).toEqual({ submitting: "", errorGeneric: "" });
    expect(parseOrderStrings("{}")).toEqual({ submitting: "", errorGeneric: "" });
  });
});

describe("describeOrderFailure", () => {
  it("extracts Astro input-error fields", () => {
    const failure = describeOrderFailure({ fields: { phone: ["رقم غير صحيح"] } });
    expect(failure.message).toBe("");
    expect(failure.fields).toEqual({ phone: ["رقم غير صحيح"] });
  });

  it("keeps a plain error message", () => {
    expect(describeOrderFailure(new Error("server said no")).message).toBe("server said no");
    expect(describeOrderFailure("boom").message).toBe("boom");
  });

  it("returns nothing for an unknown failure", () => {
    expect(describeOrderFailure(undefined)).toEqual({ message: "", fields: {} });
    expect(describeOrderFailure(42)).toEqual({ message: "", fields: {} });
  });
});

describe("initOrderSubmit", () => {
  it("submits the form and navigates to the thank-you page on success", async () => {
    const { root, form } = mount();
    const submitAction = vi.fn().mockResolvedValue(success());
    const navigate = vi.fn();
    initOrderSubmit({ root, submit: submitAction, navigate });

    (form.querySelector("#f-name") as HTMLInputElement).value = "Ali";
    submit(form);
    await flush();

    expect(submitAction).toHaveBeenCalledTimes(1);
    const formData = submitAction.mock.calls[0][0] as FormData;
    expect(formData.get("customerName")).toBe("Ali");
    expect(navigate).toHaveBeenCalledWith("/thank-you?order=ORD-1&total=5000&oid=oid-1");
  });

  it("keeps every answer and explains the failure — never reloads", async () => {
    const { root, form } = mount();
    const submitAction = vi.fn().mockResolvedValue({
      error: { fields: { phone: ["رقم الهاتف غير صحيح"] } },
    } satisfies OrderResult);
    const navigate = vi.fn();
    initOrderSubmit({ root, submit: submitAction, navigate });

    (form.querySelector("#f-name") as HTMLInputElement).value = "Ali";
    (form.querySelector("#f-phone") as HTMLInputElement).value = "0512";
    submit(form);
    await flush();

    expect(navigate).not.toHaveBeenCalled();
    expect((form.querySelector("#f-name") as HTMLInputElement).value).toBe("Ali");
    expect((form.querySelector("#f-phone") as HTMLInputElement).value).toBe("0512");
    expect(form.querySelector("#f-phone")?.classList.contains("error")).toBe(true);
    expect(form.querySelector("[data-order-field-error]")?.textContent).toBe("رقم الهاتف غير صحيح");
    expect(form.querySelector("[data-order-error]")?.textContent).toBe(
      "Could not place your order.",
    );
  });

  it("surfaces the server's own message and re-enables the button", async () => {
    const { root, form, button } = mount();
    const submitAction = vi.fn().mockResolvedValue({ error: new Error("تعذر حفظ الطلب") });
    initOrderSubmit({ root, submit: submitAction, navigate: vi.fn() });

    submit(form);
    await flush();

    expect(form.querySelector("[data-order-error]")?.textContent).toBe("تعذر حفظ الطلب");
    expect(button.disabled).toBe(false);
  });

  it("marks a dropdown's trigger and focuses the first bad field", async () => {
    const { root, form } = mount({ withSelect: true });
    const submitAction = vi
      .fn()
      .mockResolvedValue({ error: { fields: { wilayaId: ["يرجى اختيار الولاية"], phone: ["bad"] } } });
    initOrderSubmit({ root, submit: submitAction, navigate: vi.fn() });

    submit(form);
    await flush();

    const trigger = form.querySelector("#f-wilaya-trigger") as HTMLButtonElement;
    expect(trigger.classList.contains("border-red-200")).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("calls the action only once for a double submit", async () => {
    const { root, form } = mount();
    let release!: (value: OrderResult) => void;
    const submitAction = vi.fn(
      () =>
        new Promise<OrderResult>((resolve) => {
          release = resolve;
        }),
    );
    initOrderSubmit({ root, submit: submitAction, navigate: vi.fn() });

    submit(form);
    await flush();
    submit(form);
    await flush();
    expect(submitAction).toHaveBeenCalledTimes(1);

    release(success());
    await flush();
  });

  it("bails when a capture-phase guard already cancelled the submit", async () => {
    const { root, form } = mount();
    form.addEventListener("submit", (event) => event.preventDefault(), { capture: true });
    const submitAction = vi.fn().mockResolvedValue(success());
    initOrderSubmit({ root, submit: submitAction, navigate: vi.fn() });

    submit(form);
    await flush();

    expect(submitAction).not.toHaveBeenCalled();
  });

  it("tears its listener down", async () => {
    const { root, form } = mount();
    const submitAction = vi.fn().mockResolvedValue(success());
    const teardown = initOrderSubmit({ root, submit: submitAction, navigate: vi.fn() });
    teardown();

    submit(form);
    await flush();

    expect(submitAction).not.toHaveBeenCalled();
  });
});

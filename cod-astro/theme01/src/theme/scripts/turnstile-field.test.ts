/**
 * Turnstile field driver — theme script tests
 *
 * Pins the contract: the driver is inert without the #turnstile-field
 * container (feature disabled), it installs the success/expired/error/
 * timeout window callbacks the widget references by name, and the
 * capture-phase submit guard blocks submission until a token exists —
 * disabling the submit button, showing the localized "checking security"
 * message, and re-enabling once the token lands (success callback or the
 * widget's hidden response field).
 */

/// <reference types="vitest/globals" />

import { initTurnstileField } from "./turnstile-field";

const STRINGS = JSON.stringify({
  turnstileErrorFailed: "Security verification failed",
  turnstileVerifying: "Checking security — please wait…",
});

function createTurnstileDom(): HTMLElement {
  document.body.innerHTML = `
    <form method="POST" action="/_actions/placeOrder">
      <div id="turnstile-field" data-strings='${STRINGS.replace(/'/g, "&#39;")}'>
        <div id="turnstile-error" class="hidden" role="alert"><p></p></div>
        <div class="cf-turnstile"></div>
      </div>
      <input type="hidden" name="turnstileToken" value="" />
      <button id="submit-btn" type="submit">Order</button>
    </form>`;
  return document.getElementById("turnstile-field")!;
}

function submitForm(): Event {
  const event = new Event("submit", { bubbles: true, cancelable: true });
  document.querySelector("form")!.dispatchEvent(event);
  return event;
}

describe("initTurnstileField", () => {
  it("is inert when #turnstile-field is absent (feature disabled)", () => {
    document.body.innerHTML = "<form></form>";

    initTurnstileField();

    expect((window as any).__codflowTurnstileSuccess).toBeUndefined();
    expect((window as any).__codflowTurnstileExpired).toBeUndefined();
    expect((window as any).__codflowTurnstileError).toBeUndefined();
    expect((window as any).__codflowTurnstileTimeout).toBeUndefined();
  });

  it("installs all four window callbacks when the field is present", () => {
    createTurnstileDom();

    initTurnstileField();

    expect(typeof (window as any).__codflowTurnstileSuccess).toBe("function");
    expect(typeof (window as any).__codflowTurnstileExpired).toBe("function");
    expect(typeof (window as any).__codflowTurnstileError).toBe("function");
    expect(typeof (window as any).__codflowTurnstileTimeout).toBe("function");
  });

  it("success callback clears the wait state and re-enables the guarded submit button", () => {
    createTurnstileDom();
    initTurnstileField();

    const blocked = submitForm();
    expect(blocked.defaultPrevented).toBe(true);
    expect((document.getElementById("submit-btn") as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById("turnstile-error")!.classList.contains("hidden")).toBe(false);
    expect(document.getElementById("turnstile-error")!.querySelector("p")!.textContent).toBe(
      "Checking security — please wait…",
    );

    (window as any).__codflowTurnstileSuccess();

    expect((document.getElementById("submit-btn") as HTMLButtonElement).disabled).toBe(false);
    expect(document.getElementById("turnstile-error")!.classList.contains("hidden")).toBe(true);

    const allowed = submitForm();
    expect(allowed.defaultPrevented).toBe(false);
  });

  it("guard lets the submit through once the widget's hidden response field has a token", () => {
    createTurnstileDom();
    initTurnstileField();

    (document.querySelector('input[name="turnstileToken"]') as HTMLInputElement).value =
      "tok_abc123";

    const event = submitForm();
    expect(event.defaultPrevented).toBe(false);
    expect((document.getElementById("submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("error callback reveals the localized failure message, re-enables submit, and resets the widget", () => {
    createTurnstileDom();
    initTurnstileField();
    const reset = vi.fn();
    (window as any).turnstile = { reset };

    submitForm();
    (window as any).__codflowTurnstileError();

    const errorEl = document.getElementById("turnstile-error")!;
    expect(errorEl.classList.contains("hidden")).toBe(false);
    expect(errorEl.querySelector("p")!.textContent).toBe("Security verification failed");
    expect((document.getElementById("submit-btn") as HTMLButtonElement).disabled).toBe(false);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("expired callback resets the widget silently", () => {
    createTurnstileDom();
    initTurnstileField();
    const reset = vi.fn();
    (window as any).turnstile = { reset };

    (window as any).__codflowTurnstileExpired();

    expect(reset).toHaveBeenCalledOnce();
    expect(document.getElementById("turnstile-error")!.classList.contains("hidden")).toBe(true);
  });

  it("timeout callback resets the widget so the challenge self-heals", () => {
    createTurnstileDom();
    initTurnstileField();
    const reset = vi.fn();
    (window as any).turnstile = { reset };

    (window as any).__codflowTurnstileTimeout();

    expect(reset).toHaveBeenCalledOnce();
  });

  it("callbacks are no-ops when the Turnstile API is not loaded yet", () => {
    createTurnstileDom();
    initTurnstileField();

    expect(() => (window as any).__codflowTurnstileExpired()).not.toThrow();
    expect(() => (window as any).__codflowTurnstileTimeout()).not.toThrow();
  });
});

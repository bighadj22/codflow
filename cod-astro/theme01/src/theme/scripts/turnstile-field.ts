/**
 * Cloudflare Turnstile field driver (theme layer).
 *
 * Installs the window callbacks the widget references by name in
 * TurnstileField.astro (data-callback / data-expired-callback /
 * data-error-callback / data-timeout-callback):
 *   - success: a token exists — clear the wait/error state and re-enable
 *     the submit button the guard disabled;
 *   - expired: the single-use token expired unused (customer idle >5 min) —
 *     reset silently so the next submit carries a fresh token;
 *   - error: the widget itself failed — surface the localized message,
 *     re-enable submit, and reset so a retry gets a fresh challenge;
 *   - timeout: the challenge exceeded its time budget — reset so the widget
 *     self-heals instead of leaving the form stuck.
 *
 * A capture-phase submit guard on the enclosing form closes the race where
 * implicit rendering submits before the token arrives: with no token present
 * (neither the success callback nor the widget's hidden response field) it
 * prevents submission, disables the submit button, and shows the localized
 * "checking security" message until the token lands. When this script never
 * loads, the native submit flow stays untouched.
 *
 * Everything is inert when the #turnstile-field container is absent
 * (store has Turnstile disabled).
 */

export function initTurnstileField(): void {
  const field = document.getElementById("turnstile-field");
  if (!field) return;

  let strings: Record<string, string> = {};
  try {
    strings = JSON.parse(field.dataset.strings ?? "{}") as Record<string, string>;
  } catch {
    strings = {};
  }

  let hasToken = false;
  let guardBlocked = false;

  const resetWidget = () => {
    if (typeof window !== "undefined" && (window as any).turnstile?.reset) {
      (window as any).turnstile.reset();
    }
  };

  const showMessage = (message: string) => {
    const errorEl = document.getElementById("turnstile-error");
    if (!errorEl) return;
    const p = errorEl.querySelector("p");
    if (p) p.textContent = message;
    errorEl.classList.remove("hidden");
  };

  const hideMessage = () => {
    document.getElementById("turnstile-error")?.classList.add("hidden");
  };

  const setSubmitDisabled = (disabled: boolean) => {
    const submit = field.closest("form")?.querySelector<HTMLButtonElement>(
      "button[type='submit']",
    );
    if (!submit) return;
    if (disabled) {
      guardBlocked = true;
      submit.disabled = true;
    } else if (guardBlocked) {
      guardBlocked = false;
      submit.disabled = false;
    }
  };

  (window as any).__codflowTurnstileSuccess = () => {
    hasToken = true;
    hideMessage();
    setSubmitDisabled(false);
  };

  (window as any).__codflowTurnstileExpired = () => {
    hasToken = false;
    resetWidget();
  };

  (window as any).__codflowTurnstileError = () => {
    hasToken = false;
    showMessage(strings.turnstileErrorFailed ?? "");
    setSubmitDisabled(false);
    resetWidget();
  };

  (window as any).__codflowTurnstileTimeout = () => {
    hasToken = false;
    resetWidget();
  };

  const form = field.closest("form");
  if (form) {
    form.addEventListener(
      "submit",
      (event) => {
        const tokenInput = form.querySelector<HTMLInputElement>(
          'input[name="turnstileToken"]',
        );
        if (hasToken || tokenInput?.value) return;
        event.preventDefault();
        setSubmitDisabled(true);
        showMessage(strings.turnstileVerifying ?? "");
      },
      true,
    );
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initTurnstileField());
  } else {
    initTurnstileField();
  }
}

/**
 * Client-side order submission (theme layer).
 *
 * The order forms post natively (Astro action + server-side PRG). On ANY
 * failure — one mistyped digit, a policy rejection, a transient API error —
 * the server redirects back to the form page, which re-renders from scratch.
 * The action result carries reasons, never answers, so every field the
 * shopper filled comes back empty. The shopper sees a blank form, assumes the
 * order went through, and silently no order is created.
 *
 * This script takes over the submit: it calls the SAME Astro action over
 * fetch, so a failure keeps the page — and every answer — exactly as it was,
 * shows the server's own (store-language) reason, marks the offending field,
 * and lets the shopper fix one thing instead of retyping everything. Success
 * navigates to /thank-you, byte-identical to the server's PRG redirect. When
 * this script never loads, the native POST flow is untouched.
 *
 * Capture-phase guards (OTP, Turnstile, required dropdowns) still run first
 * and preventDefault; this handler bails when the event already cancelled.
 */

export interface OrderSubmitStrings {
  submitting: string;
  errorGeneric: string;
}

export interface OrderSuccess {
  orderNumber: string;
  orderId?: string | null;
  total: number;
}

export type OrderResult = { data: OrderSuccess } | { error: unknown };

export interface OrderSubmitOptions {
  /** Scan root — defaults to `document`. */
  root?: ParentNode;
  /** Action call — injectable for tests; defaults to `astro:actions`. */
  submit?: (formData: FormData) => Promise<OrderResult>;
  /** Post-success navigation — defaults to `window.location.assign`. */
  navigate?: (url: string) => void;
  /** Diagnostics hook — receives the reason and the field names only. */
  onError?: (info: { message: string; fields: Record<string, string[]> }) => void;
}

const ERROR_STYLE = [
  "align-items:flex-start",
  "gap:0.75rem",
  "padding:0.75rem 1rem",
  "border-radius:var(--radius-card)",
  "font-size:0.875rem",
  "font-weight:700",
  "background:var(--clr-error-bg)",
  "color:var(--clr-error)",
].join(";");

/** Matches the server-rendered field-error <p> in CustomerFields.astro. */
const FIELD_ERROR_CLASS = "text-[0.75rem] text-red-500 font-bold mt-2 ps-1";

export function parseOrderStrings(raw: string | undefined): OrderSubmitStrings {
  try {
    const parsed = JSON.parse(raw ?? "{}") as Partial<OrderSubmitStrings>;
    return {
      submitting: typeof parsed.submitting === "string" ? parsed.submitting : "",
      errorGeneric: typeof parsed.errorGeneric === "string" ? parsed.errorGeneric : "",
    };
  } catch {
    return { submitting: "", errorGeneric: "" };
  }
}

/**
 * Normalise any thrown/failed action result into a displayable reason plus a
 * field-name → messages map. Astro's input errors carry `.fields`; everything
 * else becomes a single message. Never reads field VALUES.
 */
export function describeOrderFailure(error: unknown): {
  message: string;
  fields: Record<string, string[]>;
} {
  if (error && typeof error === "object" && "fields" in error) {
    const raw = (error as { fields?: unknown }).fields;
    if (raw && typeof raw === "object") {
      const fields: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          const messages = value.filter((v): v is string => typeof v === "string" && v.length > 0);
          if (messages.length) fields[key] = messages;
        } else if (typeof value === "string" && value) {
          fields[key] = [value];
        }
      }
      return { message: "", fields };
    }
  }
  if (error instanceof Error && error.message) return { message: error.message, fields: {} };
  if (typeof error === "string" && error) return { message: error, fields: {} };
  return { message: "", fields: {} };
}

function cssEscape(value: string): string {
  const api = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
  if (api?.escape) return api.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function ensureAlert(form: HTMLFormElement): HTMLElement {
  const existing = form.querySelector<HTMLElement>("[data-order-error]");
  if (existing) return existing;
  const alert = document.createElement("div");
  alert.setAttribute("data-order-error", "");
  alert.setAttribute("role", "alert");
  alert.style.cssText = `display:none;${ERROR_STYLE}`;
  form.insertBefore(alert, form.firstChild);
  return alert;
}

function showAlert(alert: HTMLElement, message: string): void {
  alert.textContent = message;
  alert.style.display = "flex";
}

function hideAlert(alert: HTMLElement): void {
  alert.textContent = "";
  alert.style.display = "none";
}

function clearFieldErrors(form: HTMLFormElement): void {
  form.querySelectorAll("[data-order-field-error]").forEach((node) => node.remove());
  form.querySelectorAll(".error").forEach((node) => node.classList.remove("error"));
  form
    .querySelectorAll('.custom-select-container button[id$="-trigger"]')
    .forEach((node) => node.classList.remove("border-red-200", "bg-red-50"));
}

function appendFieldMessage(host: Element, message: string): void {
  const note = document.createElement("p");
  note.setAttribute("data-order-field-error", "");
  note.className = FIELD_ERROR_CLASS;
  note.textContent = message;
  host.appendChild(note);
}

function markField(form: HTMLFormElement, name: string, message: string): void {
  const input = form.querySelector<HTMLElement>(`[name="${cssEscape(name)}"]`);
  if (!input) return;
  const container = input.closest(".custom-select-container");
  if (container) {
    container
      .querySelector<HTMLButtonElement>('button[id$="-trigger"]')
      ?.classList.add("border-red-200", "bg-red-50");
    appendFieldMessage(container, message);
  } else {
    input.classList.add("error");
    appendFieldMessage(input.parentElement ?? input, message);
  }
}

function focusField(form: HTMLFormElement, name: string): void {
  const input = form.querySelector<HTMLElement>(`[name="${cssEscape(name)}"]`);
  if (!input) return;
  const container = input.closest(".custom-select-container");
  const target = container?.querySelector<HTMLElement>('button[id$="-trigger"]') ?? input;
  target.focus?.();
}

interface FormDeps {
  submit: (formData: FormData) => Promise<OrderResult>;
  navigate: (url: string) => void;
  onError?: OrderSubmitOptions["onError"];
}

function bindForm(form: HTMLFormElement, deps: FormDeps): () => void {
  const strings = parseOrderStrings(form.dataset.orderStrings);
  const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");
  const alert = ensureAlert(form);
  let submitting = false;
  let idleLabel: string | null = null;

  const setBusy = (busy: boolean) => {
    if (!submitBtn) return;
    if (busy) {
      if (idleLabel === null) idleLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      if (strings.submitting) submitBtn.textContent = strings.submitting;
    } else {
      submitBtn.disabled = false;
      if (idleLabel !== null) {
        submitBtn.textContent = idleLabel;
        idleLabel = null;
      }
    }
  };

  const run = async () => {
    if (submitting) return;
    submitting = true;
    clearFieldErrors(form);
    hideAlert(alert);
    setBusy(true);

    let result: OrderResult;
    try {
      result = await deps.submit(new FormData(form));
    } catch (cause) {
      result = { error: cause };
    }

    if (result && "data" in result && result.data) {
      const query = new URLSearchParams({
        order: result.data.orderNumber,
        total: String(result.data.total),
      });
      if (result.data.orderId) query.set("oid", result.data.orderId);
      deps.navigate(`/thank-you?${query.toString()}`);
      return;
    }

    submitting = false;
    setBusy(false);

    const { message, fields } = describeOrderFailure((result as { error?: unknown })?.error);
    const names = Object.keys(fields);
    for (const name of names) markField(form, name, fields[name][0]);
    if (names.length) focusField(form, names[0]);
    const summary = message || strings.errorGeneric;
    if (summary) showAlert(alert, summary);
    deps.onError?.({ message: summary, fields });
  };

  const onSubmit = (event: Event) => {
    // OTP / Turnstile / required-dropdown guards are capture-phase and run
    // first; when one cancelled the submit, this is not our turn.
    if (event.defaultPrevented) return;
    if (submitting) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    // Defer to a microtask so every other bubble submit listener (pixel
    // fbc/fbp, cart item serialisation, button state) has run before the form
    // is read — listener registration order can't lose a field.
    Promise.resolve().then(run);
  };

  form.addEventListener("submit", onSubmit);
  return () => form.removeEventListener("submit", onSubmit);
}

async function actionSubmit(formData: FormData): Promise<OrderResult> {
  const { actions } = await import("astro:actions");
  return (await actions.placeOrder(formData)) as OrderResult;
}

export function initOrderSubmit(options: OrderSubmitOptions = {}): () => void {
  const root = options.root ?? (typeof document !== "undefined" ? document : undefined);
  if (!root) return () => {};

  const deps: FormDeps = {
    submit: options.submit ?? actionSubmit,
    navigate: options.navigate ?? ((url) => window.location.assign(url)),
    onError: options.onError,
  };

  const teardowns: Array<() => void> = [];
  root.querySelectorAll<HTMLFormElement>("form[data-order-form]").forEach((form) => {
    teardowns.push(bindForm(form, deps));
  });
  return () => teardowns.forEach((teardown) => teardown());
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initOrderSubmit());
  } else {
    initOrderSubmit();
  }
}

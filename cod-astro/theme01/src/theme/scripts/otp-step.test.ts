/**
 * OTP Step — checkout completion tests
 *
 * The thank-you redirect depends on the native form POST after the OTP gate
 * resolves. These tests pin the contract: entering the correct code (or the
 * server answering "unavailable" with a bypass token) must submit the order
 * form — not leave the customer on a hidden step with no feedback.
 */
/// <reference types="vitest/globals" />

import { initOtpStep } from "./otp-step";

const STRINGS = JSON.stringify({
  otpResendIn: "Resend in",
  otpResend: "Resend code",
  otpVerifyBtn: "Confirm code",
  otpVerifying: "Verifying...",
  otpErrorWrong: "Wrong code",
  otpErrorAttempts: "Attempts left",
  otpErrorExpired: "Expired",
  otpErrorRate: "Too many requests",
  otpErrorGeneric: "Could not send the code",
});

function createOtpDom(): HTMLFormElement {
  document.body.innerHTML = `
    <form method="POST" action="/_actions/placeOrder">
      <input name="phone" id="f-phone" type="tel" value="0551234567" />
      <input type="hidden" name="otpToken" id="otp-token-input" value="" />
      <div id="otp-step" class="hidden" data-strings='${STRINGS.replace(/'/g, "&#39;")}'>
        <input id="otp-code-input" type="text" inputmode="numeric" maxlength="6" />
        <p id="otp-error" class="hidden" role="alert"></p>
        <button type="button" id="otp-verify-btn">Confirm code</button>
        <button type="button" id="otp-resend-btn" disabled><span id="otp-resend-label">waiting</span></button>
        <button type="button" id="otp-change-phone">Change phone</button>
      </div>
      <button type="submit" id="submit-btn">Confirm order</button>
    </form>
  `;
  return document.querySelector("form")!;
}

function mockFetch(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      const key = Object.keys(routes).find((k) => url.includes(k));
      if (!key) throw new Error(`unexpected fetch: ${url} (${JSON.stringify(body)})`);
      return new Response(JSON.stringify(routes[key]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    })
  );
}

function userSubmitsForm(): boolean {
  const form = document.querySelector("form")!;
  const event = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event.defaultPrevented;
}

function typeCode(code: string): void {
  const codeInput = document.querySelector<HTMLInputElement>("#otp-code-input")!;
  codeInput.value = code;
  codeInput.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Send resolved: countdown label set (only happens after the send response). */
async function sendProcessed(): Promise<void> {
  await vi.waitFor(() =>
    expect(document.querySelector<HTMLElement>("#otp-resend-label")!.textContent).toBe("Resend in 60")
  );
}

describe("OTP step — checkout completion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("intercepts the first submit until the phone is verified", async () => {
    const form = createOtpDom();
    mockFetch({ "/api/otp/send": { data: { status: "sent", requestId: "req-1" } } });
    initOtpStep();

    expect(userSubmitsForm()).toBe(true);
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLDivElement>("#otp-step")!.classList.contains("hidden")).toBe(false)
    );
    expect(form.querySelector<HTMLInputElement>("#otp-token-input")!.value).toBe("");
  });

  it("correct code → form is submitted automatically after verification", async () => {
    const form = createOtpDom();
    mockFetch({
      "/api/otp/send": { data: { status: "sent", requestId: "req-1" } },
      "/api/otp/verify": { data: { status: "verified", otpToken: "tok-123" } },
    });
    initOtpStep();

    userSubmitsForm();
    await sendProcessed();

    let nativeSubmits = 0;
    form.addEventListener(
      "submit",
      (e) => {
        if (!e.defaultPrevented) nativeSubmits += 1;
      },
      { capture: true }
    );

    typeCode("123456");

    await vi.waitFor(() => expect(nativeSubmits).toBe(1));
    expect(form.querySelector<HTMLInputElement>("#otp-token-input")!.value).toBe("tok-123");
    expect(document.querySelector<HTMLDivElement>("#otp-step")!.classList.contains("hidden")).toBe(true);
  });

  it("provider unavailable (bypass) → order form submits automatically, step hidden", async () => {
    const form = createOtpDom();
    mockFetch({
      "/api/otp/send": {
        data: { status: "unavailable", reason: "out_of_credits", bypassToken: "bypass-1" },
      },
    });
    initOtpStep();

    userSubmitsForm();

    let nativeSubmits = 0;
    form.addEventListener(
      "submit",
      (e) => {
        if (!e.defaultPrevented) nativeSubmits += 1;
      },
      { capture: true }
    );

    await vi.waitFor(() => {
      expect(nativeSubmits).toBe(1);
      expect(form.querySelector<HTMLInputElement>("#otp-token-input")!.value).toBe("bypass-1");
      expect(document.querySelector<HTMLDivElement>("#otp-step")!.classList.contains("hidden")).toBe(true);
    });
  });

  it("wrong code → no submission, error shown, token stays empty", async () => {
    const form = createOtpDom();
    mockFetch({
      "/api/otp/send": { data: { status: "sent", requestId: "req-1" } },
      "/api/otp/verify": { error: "Wrong code", attemptsRemaining: 3 },
    });
    initOtpStep();

    userSubmitsForm();
    await sendProcessed();

    typeCode("000000");

    await vi.waitFor(() => {
      expect(document.querySelector<HTMLElement>("#otp-error")!.classList.contains("hidden")).toBe(false);
    });
    expect(form.querySelector<HTMLInputElement>("#otp-token-input")!.value).toBe("");
    expect(document.querySelector<HTMLDivElement>("#otp-step")!.classList.contains("hidden")).toBe(false);
  });
});

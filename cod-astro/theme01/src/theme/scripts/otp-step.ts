/**
 * Checkout WhatsApp OTP step (theme layer).
 *
 * Drives the OtpStep UI: intercepts the order form's submit when the store
 * has verification enabled, runs the send → verify flow through the proxied
 * /api/otp endpoints, then lets the native form POST proceed (PRG flow and
 * abandoned-convert signal preserved).
 *
 * Fail-open: when the server answers "unavailable" (quota/provider outage),
 * the bypass token is stored and the form submits unverified.
 * No-JS reality: the form POSTs directly and the server's
 * OTP_VERIFICATION_REQUIRED error renders in the existing serverError alert.
 */

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initOtpStep());
  } else {
    initOtpStep();
  }
}

export function initOtpStep(): void {
  const form = document.querySelector<HTMLFormElement>("form[method='POST']");
  const step = document.getElementById("otp-step");
  const phoneInput = document.querySelector<HTMLInputElement>("input[name='phone']");
  const codeInput = document.getElementById("otp-code-input") as HTMLInputElement | null;
  const verifyBtn = document.getElementById("otp-verify-btn") as HTMLButtonElement | null;
  const errorEl = document.getElementById("otp-error") as HTMLElement | null;
  const resendBtn = document.getElementById("otp-resend-btn") as HTMLButtonElement | null;
  const resendLabel = document.getElementById("otp-resend-label") as HTMLElement | null;
  const changePhoneBtn = document.getElementById("otp-change-phone") as HTMLButtonElement | null;
  const tokenInput = document.getElementById("otp-token-input") as HTMLInputElement | null;
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;
  // #otp-step only renders when the store enables verification — its absence
  // means the feature is off and the native submit flow stays untouched.
  if (!form || !step || !phoneInput || !codeInput || !verifyBtn || !tokenInput) return;

  const strings = JSON.parse(step.dataset.strings ?? "{}") as Record<string, string>;
  const t = (key: string, fallback: string): string => strings[key] ?? fallback;

  let requestId: string | null = null;
  let bypassToken: string | null = null;
  let verifiedPhone: string | null = null;
  let inFlight = false;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  function showError(message: string | null): void {
    if (!errorEl) return;
    errorEl.textContent = message ?? "";
    errorEl.classList.toggle("hidden", message == null);
  }

  function setStepVisible(visible: boolean): void {
    step!.classList.toggle("hidden", !visible);
    if (visible) {
      codeInput!.value = "";
      showError(null);
      codeInput!.focus();
    }
  }

  function startCountdown(seconds: number): void {
    if (countdownTimer) clearInterval(countdownTimer);
    let remaining = seconds;
    if (resendBtn) resendBtn.disabled = true;
    updateLabel(remaining);
    countdownTimer = setInterval(() => {
      remaining -= 1;
      updateLabel(Math.max(0, remaining));
      if (remaining <= 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        if (resendBtn) {
          resendBtn.disabled = false;
          if (resendLabel) resendLabel.textContent = t("otpResend", "Resend code");
        }
      }
    }, 1000);
  }

  function updateLabel(seconds: number): void {
    if (resendLabel && resendBtn && resendBtn.disabled) {
      resendLabel.textContent = `${t("otpResendIn", "Resend in")} ${seconds}`;
    }
  }

  async function sendCode(): Promise<boolean> {
    if (inFlight) return false;
    inFlight = true;
    if (verifyBtn) verifyBtn.disabled = true;
    showError(null);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput!.value }),
      });
      const json = (await res.json()) as {
        data?: { status: string; requestId?: string; bypassToken?: string } | null;
        error?: string;
        windowSeconds?: number;
      };

      if (json.data?.status === "sent") {
        requestId = json.data.requestId ?? null;
        bypassToken = null;
        startCountdown(60);
        return true;
      }
      if (json.data?.status === "unavailable" && json.data.bypassToken) {
        // Fail-open: proceed unverified with the server-attested bypass.
        bypassToken = json.data.bypassToken;
        requestId = null;
        setStepVisible(false);
        submitForm();
        return true;
      }

      const windowSeconds = json.windowSeconds;
      showError(
        windowSeconds != null
          ? `${t("otpErrorRate", "Too many requests — please wait a moment and try again")} (${Math.ceil(windowSeconds / 60)}s)`
          : json.error ?? t("otpErrorGeneric", "Could not send the code — please try again")
      );
      return false;
    } catch {
      showError(t("otpErrorGeneric", "Could not send the code — please try again"));
      return false;
    } finally {
      inFlight = false;
      if (verifyBtn) verifyBtn.disabled = false;
    }
  }

  async function verifyCode(): Promise<boolean> {
    const code = codeInput!.value.trim();
    if (code.length !== 6 || !requestId || inFlight) return false;
    inFlight = true;
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = t("otpVerifying", "Verifying...");
    }
    showError(null);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput!.value, requestId, code }),
      });
      const json = (await res.json()) as {
        data?: { otpToken?: string } | null;
        error?: string;
        attemptsRemaining?: number;
        terminal?: boolean;
      };

      if (res.ok && json.data?.otpToken) {
        tokenInput!.value = json.data.otpToken;
        verifiedPhone = phoneInput!.value;
        requestId = null; // verified request is spent server-side
        setStepVisible(false);
        submitForm();
        return true;
      }

      const attempts = json.attemptsRemaining;
      if (json.terminal) {
        showError(t("otpErrorExpired", "This code has expired — request a new one"));
      } else {
        showError(
          attempts != null
            ? `${t("otpErrorWrong", "Wrong code — check WhatsApp and try again")} (${t("otpErrorAttempts", "Attempts left")}: ${attempts})`
            : t("otpErrorWrong", "Wrong code — check WhatsApp and try again")
        );
      }
      codeInput!.value = "";
      codeInput!.focus();
      return false;
    } catch {
      showError(t("otpErrorGeneric", "Could not send the code — please try again"));
      return false;
    } finally {
      inFlight = false;
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = t("otpVerifyBtn", "Confirm code");
      }
    }
  }

  function resetVerification(): void {
    tokenInput!.value = "";
    verifiedPhone = null;
    requestId = null;
    bypassToken = null;
  }

  // Resubmit through the normal pipeline: the gate's early return lets the
  // native POST proceed and the pixel listeners (fbc/fbp) still fill.
  function submitForm(): void {
    form!.requestSubmit();
  }

  // Phone edited after verification → token no longer matches; re-verify.
  phoneInput.addEventListener("input", () => {
    if (verifiedPhone != null && phoneInput.value !== verifiedPhone) {
      resetVerification();
    }
  });

  if (changePhoneBtn) {
    changePhoneBtn.addEventListener("click", () => {
      resetVerification();
      setStepVisible(false);
      phoneInput.focus();
    });
  }

  if (resendBtn) {
    resendBtn.addEventListener("click", () => {
      if (resendBtn.disabled) return;
      void sendCode();
    });
  }

  if (verifyBtn) {
    verifyBtn.addEventListener("click", () => {
      void verifyCode();
    });
  }

  // Auto-verify when 6 digits are typed.
  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    if (codeInput.value.length === 6) void verifyCode();
  });

  // The gate: intercept submit until the phone is verified (or bypassed).
  form.addEventListener(
    "submit",
    (event) => {
      if (tokenInput.value || bypassToken) {
        if (!tokenInput.value && bypassToken) tokenInput.value = bypassToken;
        return; // verified/bypassed — let the native POST proceed
      }
      event.preventDefault();
      if (submitBtn) submitBtn.disabled = false;
      setStepVisible(true);
      void sendCode();
    },
    { capture: true }
  );
}

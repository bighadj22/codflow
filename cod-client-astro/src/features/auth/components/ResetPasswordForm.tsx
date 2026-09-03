import { useState, type SyntheticEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { postSignInTarget } from "@/lib/gate";
import { notify } from "@/lib/notify";
import { useT } from "@/i18n/react";
import { Alert, Button, inputClass } from "@/components/ui";

const MIN_PASSWORD_LENGTH = 8;

/** Reads the one-time reset token handed over by /reset-password/[token]. */
function resetToken(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export function ResetPasswordForm() {
  const t = useT("auth");
  const [token] = useState(resetToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): string | null {
    if (newPassword.length < MIN_PASSWORD_LENGTH) return t("reset_password_error_min_length");
    if (newPassword !== confirmPassword) return t("reset_password_error_mismatch");
    return null;
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await authClient.resetPassword({ newPassword, token });
      if (authError) {
        const message =
          authError.code === "INVALID_TOKEN"
            ? t("reset_password_error_invalid_token")
            : t("reset_password_error_generic");
        setError(message);
        notify.error(message);
        setBusy(false);
        return;
      }
      notify.flashSuccess(t("reset_password_success_message"));
      setDone(true);
      window.location.href = postSignInTarget(null);
    } catch {
      const message = t("reset_password_error_generic");
      setError(message);
      notify.error(message);
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("reset_password_title")}
        </h1>
        <Alert role="alert" tone="critical">
          {t("reset_password_error_invalid_token")}
        </Alert>
        <a
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          {t("reset_password_request_new_link")}
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("reset_password_title")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {t("reset_password_success_message")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("reset_password_title")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {t("reset_password_subtitle")}
        </p>
      </div>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-foreground"
          htmlFor="newPassword"
        >
          {t("reset_password_new_label")}
        </label>
        <input
          id="newPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          value={newPassword}
          onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
          placeholder={t("reset_password_new_placeholder")}
          className={inputClass}
        />
      </div>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-foreground"
          htmlFor="confirmPassword"
        >
          {t("reset_password_confirm_label")}
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          value={confirmPassword}
          onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
          placeholder={t("reset_password_confirm_placeholder")}
          className={inputClass}
        />
      </div>

      {error && (
        <Alert role="alert" tone="critical">
          {error}
        </Alert>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
            aria-label={t("reset_password_submitting")}
          />
        ) : (
          t("reset_password_button")
        )}
      </Button>
    </form>
  );
}

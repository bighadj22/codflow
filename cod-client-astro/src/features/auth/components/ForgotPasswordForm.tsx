import { useState, type SyntheticEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { notify } from "@/lib/notify";
import { useT } from "@/i18n/react";
import { Alert, Button, inputClass } from "@/components/ui";

/**
 * Requests a password-reset email. The API answers with the same generic
 * response whether or not the account exists (enumeration-safe by design),
 * so the UI always shows the "check your email" state on success.
 */
export function ForgotPasswordForm() {
  const t = useT("auth");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // redirectTo is what makes the emailed link usable: better-auth builds
      // `${baseURL}/reset-password/<token>?callbackURL=<redirectTo>`, and its
      // GET route validates the token then redirects to /reset-password?token=….
      // Without it the callbackURL is empty → INVALID_TOKEN error page.
      const { error: authError } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (authError) {
        const message = t("forgot_password_error_generic");
        setError(message);
        notify.error(message);
        setBusy(false);
        return;
      }
      setRequested(true);
      setBusy(false);
    } catch {
      const message = t("forgot_password_error_generic");
      setError(message);
      notify.error(message);
      setBusy(false);
    }
  }

  if (requested) {
    return (
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("forgot_password_check_email_title")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {t("forgot_password_check_email_message")}
        </p>
        <a
          href="/sign-in"
          className="mt-6 inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          {t("forgot_password_back_to_signin")}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("forgot_password_title")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {t("forgot_password_subtitle")}
        </p>
      </div>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-foreground"
          htmlFor="email"
        >
          {t("forgot_password_email_label")}
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          placeholder={t("email_placeholder")}
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
            aria-label={t("signing_in")}
          />
        ) : (
          t("forgot_password_send_button")
        )}
      </Button>

      <a
        href="/sign-in"
        className="block text-center text-sm font-semibold text-primary underline underline-offset-4"
      >
        {t("forgot_password_back_to_signin")}
      </a>
    </form>
  );
}

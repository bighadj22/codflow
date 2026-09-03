import { useState, type SyntheticEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { postSignInTarget } from "@/lib/gate";
import { notify } from "@/lib/notify";
import { useT } from "@/i18n/react";
import { Button, Alert, inputClass } from "@/components/ui";

export function SignInForm({ next }: { next?: string | null }) {
  const t = useT("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.email({ email, password });
      if (authError) {
        const message =
          authError.code === "INVALID_EMAIL_OR_PASSWORD"
            ? t("invalid_credentials")
            : t("unexpected_error");
        setError(message);
        notify.error(message);
        setBusy(false);
        return;
      }
      notify.flashSuccess(t("sign_in_success"));
      window.location.href = postSignInTarget(next ?? null);
    } catch {
      const message = t("unexpected_error");
      setError(message);
      notify.error(message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("welcome_back")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-foreground"
          htmlFor="email"
        >
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          required
          aria-invalid={!!error}
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          placeholder={t("email_placeholder")}
          className={inputClass}
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            className="block text-sm font-semibold text-foreground"
            htmlFor="password"
          >
            {t("password")}
          </label>
          <a
            href="/forgot-password"
            className="text-xs font-semibold text-primary underline underline-offset-4"
          >
            {t("forgot_password")}
          </a>
        </div>
        <input
          id="password"
          type="password"
          required
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          placeholder={t("password_placeholder")}
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
          t("sign_in")
        )}
      </Button>
    </form>
  );
}

import { useEffect, useState } from "react";
import { Eye, EyeOff, MessageCircle, ShieldCheck } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { useT } from "@/i18n/react";
import { getOtpConfig, saveOtpConfig, testOtpConnection } from "@/features/settings/api";
import type { OtpConnectionCheck } from "@/features/settings/types";
import { FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

type Language = "ar" | "fr" | "en";

export function VerificationSettings() {
  const t = useT("settings");
  const [apiKey, setApiKey] = useState("");
  const [language, setLanguage] = useState<Language>("ar");
  const [enabled, setEnabled] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<OtpConnectionCheck | null>(null);

  useEffect(() => {
    let alive = true;
    getOtpConfig().then((data) => {
      if (!alive || !data) return;
      setLanguage(data.language);
      setEnabled(data.enabled);
      setApiKeyMasked(data.apiKeyMasked);
      setLastSaved(data.updatedAt);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave() {
    if (enabled && !apiKey.trim() && !apiKeyMasked) {
      throw new Error(`${t("store.otp_key_label")} ${t("store.field_required")}`);
    }
    const result = await saveOtpConfig({
      apiKey: apiKey.trim() || undefined,
      language,
      enabled,
    });
    setApiKeyMasked(result.apiKeyMasked);
    setLastSaved(result.updatedAt);
    setApiKey("");
  }

  async function handleTest() {
    setChecking(true);
    setCheck(null);
    try {
      setCheck(await testOtpConnection(apiKey.trim() || undefined));
    } catch {
      setCheck({ ok: false, message: t("store.otp_check_failed") });
    } finally {
      setChecking(false);
    }
  }

  return (
    <SettingsSection
      icon={ShieldCheck}
      title={t("store.otp_title")}
      subtitle={t("store.otp_subtitle")}
      onSave={handleSave}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("store.otp_enabled_label")}
          </span>
          <p className="text-xs text-muted-foreground">{t("store.otp_enabled_hint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((current) => !current)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            enabled ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
              enabled ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <FieldRow label={t("store.otp_key_label")} hint={t("store.otp_key_hint")}>
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            dir="ltr"
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
            placeholder={apiKeyMasked ?? t("store.otp_key_placeholder")}
            className="pe-10"
          />
          <button
            type="button"
            onClick={() => setShowKey((current) => !current)}
            tabIndex={-1}
            aria-label={showKey ? t("store.api_key_hide") : t("store.api_key_reveal")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {apiKeyMasked && !apiKey && (
          <p className="text-xs text-muted-foreground">
            {t("store.otp_key_stored")}: <span dir="ltr">{apiKeyMasked}</span>
          </p>
        )}
      </FieldRow>

      <FieldRow label={t("store.otp_language_label")} hint={t("store.otp_language_hint")}>
        <Select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
          <option value="ar">العربية (WhatsApp)</option>
          <option value="fr">Français (WhatsApp)</option>
          <option value="en">English (WhatsApp)</option>
        </Select>
      </FieldRow>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageCircle size={15} aria-hidden="true" />
            {t("store.otp_check_title")}
          </div>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={checking || (!apiKey.trim() && !apiKeyMasked)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? t("store.otp_checking") : t("store.otp_check_btn")}
          </button>
        </div>

        {check && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              check.ok
                ? "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {check.ok && check.balanceDa != null ? (
              <>
                {t("store.otp_check_ok")} — {t("store.otp_check_balance")}: {check.balanceDa} DA ·{" "}
                {t("store.otp_check_estimate")}: ~{check.otpEstimate} · {check.plan}
              </>
            ) : check.ok ? (
              check.message ?? t("store.otp_check_ok")
            ) : (
              <>
                {check.outOfCredits ? t("store.otp_check_no_credits") : null}
                {check.message ?? t("store.otp_check_failed")}
              </>
            )}
          </div>
        )}
      </div>

      {lastSaved && (
        <p className="text-xs text-muted-foreground">
          {t("store.tracking_last_saved")}: {new Date(lastSaved).toLocaleString()}
        </p>
      )}
    </SettingsSection>
  );
}

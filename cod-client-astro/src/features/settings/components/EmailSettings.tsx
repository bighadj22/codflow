import { useEffect, useState } from "react";
import { Eye, EyeOff, Mail, Send } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { useT } from "@/i18n/react";
import { getEmailConfig, saveEmailConfig, testEmailConnection } from "@/features/settings/api";
import type { EmailConnectionCheck } from "@/features/settings/types";
import { FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailSettings() {
  const t = useT("settings");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<EmailConnectionCheck | null>(null);

  const localPart = fromEmail.split("@")[0] ?? "";
  const currentDomain = fromEmail.includes("@") ? (fromEmail.split("@").pop() as string) : "";

  function applyDomain(domain: string) {
    const prefix = localPart.trim() || "noreply";
    setFromEmail(`${prefix}@${domain}`);
  }

  function setLocalPart(part: string) {
    setFromEmail(currentDomain ? `${part}@${currentDomain}` : part);
  }

  useEffect(() => {
    let alive = true;
    getEmailConfig().then((data) => {
      if (!alive || !data) return;
      setEnabled(data.enabled);
      setFromEmail(data.fromEmail);
      setFromName(data.fromName ?? "");
      setApiKeyMasked(data.apiKeyMasked);
      setLastSaved(data.updatedAt);
      // Silent: load the verified domains with the STORED key so the picker
      // is ready on arrival (cheap account read, one call per page visit).
      testEmailConnection()
        .then((result) => {
          if (!alive || !result.ok || !result.domains?.length) return;
          setDomains(result.domains);
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Pasting a key and leaving the field pre-validates it against Sendili and
   * loads the domains it may send from — BEFORE any save, so the merchant
   * picks a verified domain first and completes the from address with it.
   */
  async function handleKeyBlur() {
    const submitted = apiKey.trim();
    if (!submitted.startsWith("sk_") || submitted.length < 20) return;
    try {
      const result = await testEmailConnection(submitted);
      setCheck(result);
      if (result.ok && result.domains?.length) {
        setDomains(result.domains);
        if (!fromEmail.includes("@")) applyDomain(result.domains[0]);
      }
    } catch {
      // Manual Test connection reports failures; keep the blur silent.
    }
  }

  async function handleSave() {
    if (!EMAIL_PATTERN.test(fromEmail.trim())) {
      throw new Error(`${t("store.email_from_label")}: ${t("store.password_error_required")}`);
    }
    if (enabled && !apiKey.trim() && !apiKeyMasked) {
      throw new Error(`${t("store.email_key_label")}: ${t("store.password_error_required")}`);
    }
    const result = await saveEmailConfig({
      apiKey: apiKey.trim() || undefined,
      fromEmail: fromEmail.trim(),
      fromName: fromName.trim() || null,
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
      const result = await testEmailConnection(apiKey.trim() || undefined);
      setCheck(result);
      if (result.ok && result.domains?.length) {
        setDomains(result.domains);
        if (!fromEmail.includes("@")) applyDomain(result.domains[0]);
      }
    } catch {
      setCheck({ ok: false, message: t("store.email_check_failed") });
    } finally {
      setChecking(false);
    }
  }

  // A free-typed domain that is not in the verified list stays selectable
  // (it was deliberately entered); otherwise the picker covers it.
  const domainOptions =
    currentDomain && !domains.includes(currentDomain)
      ? [currentDomain, ...domains]
      : domains;

  return (
    <SettingsSection
      icon={Mail}
      title={t("store.email_title")}
      subtitle={t("store.email_subtitle")}
      onSave={handleSave}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("store.email_enabled_label")}
          </span>
          <p className="text-xs text-muted-foreground">{t("store.email_enabled_hint")}</p>
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

      <FieldRow label={t("store.email_key_label")} hint={t("store.email_key_hint")}>
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            dir="ltr"
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
            onBlur={() => void handleKeyBlur()}
            placeholder={apiKeyMasked ?? t("store.email_key_placeholder")}
            className="pe-10"
            autoComplete="off"
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
            {t("store.email_key_stored")}: <span dir="ltr">{apiKeyMasked}</span>
          </p>
        )}
      </FieldRow>

      <FieldRow label={t("store.email_from_label")} hint={t("store.email_from_hint")}>
        {domainOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <Input
              dir="ltr"
              value={localPart}
              onChange={(event) => setLocalPart(event.currentTarget.value)}
              placeholder={t("store.email_local_placeholder")}
              className="flex-1"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="shrink-0 text-sm font-semibold text-muted-foreground" aria-hidden="true">
              @
            </span>
            <Select
              value={currentDomain || domainOptions[0]}
              onChange={(event) => applyDomain(event.currentTarget.value)}
              className="w-auto min-w-44"
            >
              {domainOptions.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <Input
            type="email"
            dir="ltr"
            value={fromEmail}
            onChange={(event) => setFromEmail(event.currentTarget.value)}
            placeholder={t("store.email_from_placeholder")}
          />
        )}
        <p className="text-xs text-muted-foreground">{t("store.email_domains_hint")}</p>
      </FieldRow>

      <FieldRow label={t("store.email_from_name_label")}>
        <Input
          value={fromName}
          onChange={(event) => setFromName(event.currentTarget.value)}
          placeholder={t("store.email_from_name_placeholder")}
        />
      </FieldRow>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Send size={15} aria-hidden="true" />
            {t("store.email_check_title")}
          </div>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={checking || (!apiKey.trim() && !apiKeyMasked)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? t("store.email_checking") : t("store.email_check_btn")}
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
            {check.ok ? (
              check.domains?.length ? (
                <>
                  {t("store.email_check_ok")} — {t("store.email_domains_label")}:{" "}
                  <span dir="ltr">{check.domains.join(", ")}</span>
                </>
              ) : (
                t("store.email_check_ok")
              )
            ) : (
              <>
                {check.outOfCredits ? t("store.email_check_no_credits") : null}
                {check.message ?? t("store.email_check_failed")}
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

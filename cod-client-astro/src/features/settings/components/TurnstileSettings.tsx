import { useEffect, useState } from "react";
import { Eye, EyeOff, Shield } from "lucide-react";
import { Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { getTurnstileConfig, saveTurnstileConfig } from "@/features/settings/api";
import { FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

export function TurnstileSettings() {
  const t = useT("settings");
  const [siteKey, setSiteKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [siteKeyStored, setSiteKeyStored] = useState<string | null>(null);
  const [secretKeyMasked, setSecretKeyMasked] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTurnstileConfig().then((data) => {
      if (!alive || !data) return;
      setEnabled(data.enabled);
      setSiteKeyStored(data.siteKey);
      setSecretKeyMasked(data.secretKeyMasked);
      setLastSaved(data.updatedAt);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave() {
    if (enabled && !siteKey.trim() && !siteKeyStored) {
      throw new Error(`${t("store.turnstile_site_key_label")} ${t("store.field_required")}`);
    }
    if (enabled && !secretKey.trim() && !secretKeyMasked) {
      throw new Error(`${t("store.turnstile_secret_key_label")} ${t("store.field_required")}`);
    }
    const result = await saveTurnstileConfig({
      siteKey: siteKey.trim() || undefined,
      secretKey: secretKey.trim() || undefined,
      enabled,
    });
    setSiteKeyStored(result.siteKey);
    setSecretKeyMasked(result.secretKeyMasked);
    setLastSaved(result.updatedAt);
    setSiteKey("");
    setSecretKey("");
  }

  return (
    <SettingsSection
      icon={Shield}
      title={t("store.turnstile_title")}
      subtitle={t("store.turnstile_subtitle")}
      onSave={handleSave}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("store.turnstile_enabled_label")}
          </span>
          <p className="text-xs text-muted-foreground">{t("store.turnstile_enabled_hint")}</p>
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

      <FieldRow label={t("store.turnstile_site_key_label")} hint={t("store.turnstile_site_key_hint")}>
        <Input
          type="text"
          dir="ltr"
          value={siteKey}
          onChange={(event) => setSiteKey(event.currentTarget.value)}
          placeholder={siteKeyStored ?? t("store.turnstile_site_key_placeholder")}
        />
      </FieldRow>

      <FieldRow label={t("store.turnstile_secret_key_label")} hint={t("store.turnstile_secret_key_hint")}>
        <div className="relative">
          <Input
            type={showSecret ? "text" : "password"}
            dir="ltr"
            value={secretKey}
            onChange={(event) => setSecretKey(event.currentTarget.value)}
            placeholder={secretKeyMasked ?? t("store.turnstile_secret_key_placeholder")}
            className="pe-10"
          />
          <button
            type="button"
            onClick={() => setShowSecret((current) => !current)}
            tabIndex={-1}
            aria-label={showSecret ? t("store.api_key_hide") : t("store.api_key_reveal")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {secretKeyMasked && !secretKey && (
          <p className="text-xs text-muted-foreground">
            {t("store.turnstile_key_stored")}: <span dir="ltr">{secretKeyMasked}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("store.turnstile_hostname_hint")}</p>
      </FieldRow>

      {lastSaved && (
        <p className="text-xs text-muted-foreground">
          {t("store.tracking_last_saved")}: {new Date(lastSaved).toLocaleString()}
        </p>
      )}
    </SettingsSection>
  );
}

import { useEffect, useState } from "react";
import { BarChart2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { getPixelConfig, savePixelConfig } from "@/features/settings/api";
import { FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

type ConversionEvent = "Lead" | "Purchase";

const EVENT_OPTIONS: { value: ConversionEvent; labelKey: string; hintKey: string }[] = [
  { value: "Lead", labelKey: "store.tracking_event_lead_label", hintKey: "store.tracking_event_lead_hint" },
  { value: "Purchase", labelKey: "store.tracking_event_purchase_label", hintKey: "store.tracking_event_purchase_hint" },
];

export function TrackingSettings() {
  const t = useT("settings");
  const [pixelId, setPixelId] = useState("");
  const [adAccountName, setAdAccountName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessTokenMasked, setAccessTokenMasked] = useState<string | null>(null);
  const [testEventCode, setTestEventCode] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [conversionEvent, setConversionEvent] = useState<ConversionEvent | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPixelConfig().then((data) => {
      if (!alive || !data) return;
      setPixelId(data.pixelId);
      setAdAccountName(data.adAccountName ?? "");
      setAccessTokenMasked(data.accessTokenMasked);
      setTestEventCode(data.testEventCode ?? "");
      setConversionEvent(data.conversionEvent);
      setTestMode(data.testMode);
      setEnabled(data.enabled);
      setLastSaved(data.updatedAt);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave() {
    if (enabled && !pixelId.trim()) {
      throw new Error(
        `${t("store.tracking_pixel_id_label")} ${t("store.field_required")}`,
      );
    }
    if (!conversionEvent) {
      throw new Error(
        `${t("store.tracking_event_label")} ${t("store.field_required")}`,
      );
    }
    if (enabled && !accessToken.trim() && !accessTokenMasked) {
      throw new Error(
        `${t("store.tracking_token_label")} ${t("store.field_required")}`,
      );
    }
    if (enabled && testMode && !testEventCode.trim()) {
      throw new Error(
        `${t("store.tracking_test_code_label")} ${t("store.field_required")}`,
      );
    }
    const result = await savePixelConfig({
      pixelId: pixelId.trim(),
      adAccountName: adAccountName.trim() || null,
      accessToken: accessToken.trim() || undefined,
      testEventCode: testEventCode.trim() || null,
      conversionEvent,
      testMode,
      enabled,
    });
    setAccessTokenMasked(result.accessTokenMasked);
    setAccessToken("");
    setLastSaved(result.updatedAt);
  }

  return (
    <SettingsSection
      icon={BarChart2}
      title={t("store.tracking_title")}
      subtitle={t("store.tracking_subtitle")}
      onSave={handleSave}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("store.tracking_enabled_label")}
          </span>
          <p className="text-xs text-muted-foreground">{t("store.tracking_enabled_hint")}</p>
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

      <FieldRow label={t("store.tracking_ad_account_label")} hint={t("store.tracking_ad_account_hint")}>
        <Input
          dir="ltr"
          value={adAccountName}
          onChange={(event) => setAdAccountName(event.currentTarget.value)}
          placeholder={t("store.tracking_ad_account_placeholder")}
        />
      </FieldRow>

      <FieldRow label={t("store.tracking_pixel_id_label")} hint={t("store.tracking_pixel_id_hint")}>
        <Input
          dir="ltr"
          value={pixelId}
          onChange={(event) => setPixelId(event.currentTarget.value)}
          placeholder={t("store.tracking_pixel_id_placeholder")}
        />
      </FieldRow>

      <FieldRow label={t("store.tracking_token_label")} hint={t("store.tracking_token_hint")}>
        <div className="relative">
          <Input
            type={showToken ? "text" : "password"}
            dir="ltr"
            value={accessToken}
            onChange={(event) => setAccessToken(event.currentTarget.value)}
            placeholder={accessTokenMasked ?? t("store.tracking_token_placeholder")}
            className="pe-10"
          />
          <button
            type="button"
            onClick={() => setShowToken((current) => !current)}
            tabIndex={-1}
            aria-label={showToken ? t("store.api_key_hide") : t("store.api_key_reveal")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {accessTokenMasked && !accessToken && (
          <p className="text-xs text-muted-foreground">
            {t("store.otp_key_stored")}: <span dir="ltr">{accessTokenMasked}</span>
          </p>
        )}
      </FieldRow>

      <FieldRow label={t("store.tracking_event_label")}>
        <div className="grid gap-2" role="radiogroup" aria-label={t("store.tracking_event_label")}>
          {EVENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={conversionEvent === option.value}
              onClick={() => setConversionEvent(option.value)}
              className={`cursor-pointer rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                conversionEvent === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-semibold text-foreground">
                {t(option.labelKey)}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t(option.hintKey)}
              </span>
            </button>
          ))}
        </div>
      </FieldRow>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("store.tracking_test_mode_label")}
          </span>
          <p className="text-xs text-muted-foreground">{t("store.tracking_test_mode_hint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={testMode}
          onClick={() => setTestMode((current) => !current)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            testMode ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
              testMode ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {testMode && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600">
          {t("store.tracking_test_mode_warning")}
        </p>
      )}

      {testMode && (
        <FieldRow label={t("store.tracking_test_code_label")} hint={t("store.tracking_test_code_hint")}>
          <Input
            dir="ltr"
            value={testEventCode}
            onChange={(event) => setTestEventCode(event.currentTarget.value)}
            placeholder={t("store.tracking_test_code_placeholder")}
          />
        </FieldRow>
      )}

      {lastSaved && (
        <p className="text-xs text-muted-foreground">
          {t("store.tracking_last_saved")}: {new Date(lastSaved).toLocaleString()}
        </p>
      )}
    </SettingsSection>
  );
}

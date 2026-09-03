import { useEffect, useState } from "react";
import { BarChart2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import { getPixelConfig, savePixelConfig } from "@/features/settings/api";
import { FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

export function TrackingSettings() {
  const t = useT("settings");
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPixelConfig().then((data) => {
      if (!alive || !data) return;
      setPixelId(data.pixelId);
      setAccessToken(data.accessToken);
      setTestEventCode(data.testEventCode ?? "");
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
    const result = await savePixelConfig({
      pixelId: pixelId.trim(),
      accessToken: accessToken.trim() || undefined,
      testEventCode: testEventCode.trim() || null,
      enabled,
    });
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
            placeholder={t("store.tracking_token_placeholder")}
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
      </FieldRow>

      <FieldRow label={t("store.tracking_test_code_label")} hint={t("store.tracking_test_code_hint")}>
        <Input
          dir="ltr"
          value={testEventCode}
          onChange={(event) => setTestEventCode(event.currentTarget.value)}
          placeholder={t("store.tracking_test_code_placeholder")}
        />
      </FieldRow>

      {lastSaved && (
        <p className="text-xs text-muted-foreground">
          {t("store.tracking_last_saved")}: {new Date(lastSaved).toLocaleString()}
        </p>
      )}
    </SettingsSection>
  );
}

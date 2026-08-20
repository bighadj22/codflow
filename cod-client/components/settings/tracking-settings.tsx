"use client";

import { useState, useTransition, useEffect } from "react";
import { BarChart2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/translations";
import { getPixelConfig, savePixelConfig, type PixelConfig } from "@/actions/stores";
import { Section, FieldRow, inputCls } from "./shared-fields";

export function TrackingSettings() {
  const t = useSettings();
  const s = t.store;

  const [config, setConfig] = useState<PixelConfig | null>(null);
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [saving, startTransition] = useTransition();

  useEffect(() => {
    getPixelConfig().then((data) => {
      if (data) {
        setConfig(data);
        setPixelId(data.pixelId);
        setAccessToken(data.accessToken);
        setTestEventCode(data.testEventCode ?? "");
        setEnabled(data.enabled);
      }
    });
  }, []);

  const handleSave = () => {
    if (enabled && !pixelId.trim()) {
      toast.error(s.tracking_pixel_id_label + " " + s.password_error_required);
      return;
    }
    startTransition(async () => {
      try {
        const result = await savePixelConfig({
          pixelId,
          accessToken: accessToken || undefined,
          testEventCode: testEventCode || null,
          enabled,
        });
        setConfig(result);
        toast.success(s.saved);
      } catch {
        toast.error(s.save_error);
      }
    });
  };

  return (
    <Section
      icon={BarChart2}
      title={s.tracking_title}
      subtitle={s.tracking_subtitle}
      saving={saving}
      saveLabel={s.save}
      savingLabel={s.saving}
      onSave={handleSave}
    >
      {/* Enabled toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {s.tracking_enabled_label}
          </span>
          <p className="text-xs text-muted-foreground">{s.tracking_enabled_hint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={[
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            enabled ? "bg-primary" : "bg-muted-foreground/30",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Pixel ID */}
      <FieldRow label={s.tracking_pixel_id_label} hint={s.tracking_pixel_id_hint}>
        <input
          type="text"
          dir="ltr"
          value={pixelId}
          onChange={(e) => setPixelId(e.target.value)}
          placeholder={s.tracking_pixel_id_placeholder}
          className={inputCls}
        />
      </FieldRow>

      {/* Access Token */}
      <FieldRow label={s.tracking_token_label} hint={s.tracking_token_hint}>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            dir="ltr"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={s.tracking_token_placeholder}
            className={[inputCls, "pe-10"].join(" ")}
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            tabIndex={-1}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </FieldRow>

      {/* Test Event Code (optional) */}
      <FieldRow label={s.tracking_test_code_label} hint={s.tracking_test_code_hint}>
        <input
          type="text"
          dir="ltr"
          value={testEventCode}
          onChange={(e) => setTestEventCode(e.target.value)}
          placeholder={s.tracking_test_code_placeholder}
          className={inputCls}
        />
      </FieldRow>

      {config && (
        <p className="text-xs text-muted-foreground">
          {s.tracking_last_saved}: {new Date(config.updatedAt).toLocaleString()}
        </p>
      )}
    </Section>
  );
}

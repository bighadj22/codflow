import { useState } from "react";
import { Palette } from "lucide-react";
import { Input } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { StoreConfig } from "@/features/settings/types";
import { ColorField, FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

export function BrandingSettings({
  storeConfig,
  onSave,
}: {
  storeConfig: StoreConfig;
  onSave: (payload: {
    primaryColor?: string;
    accentColor?: string;
    bgColor?: string;
    fontFamily?: string;
  }) => Promise<void>;
}) {
  const t = useT("settings");
  const [primaryColor, setPrimaryColor] = useState(storeConfig.primaryColor);
  const [accentColor, setAccentColor] = useState(storeConfig.accentColor);
  const [bgColor, setBgColor] = useState(storeConfig.bgColor);
  const [fontFamily, setFontFamily] = useState(storeConfig.fontFamily);

  return (
    <SettingsSection
      icon={Palette}
      title={t("store.branding_title")}
      subtitle={t("store.branding_subtitle")}
      onSave={async () => {
        await onSave({
          primaryColor,
          accentColor,
          bgColor,
          fontFamily: fontFamily.trim() || storeConfig.fontFamily,
        });
      }}
    >
      <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border" aria-hidden="true">
        <div className="flex-1" style={{ background: primaryColor }} />
        <div className="flex-1" style={{ background: accentColor }} />
        <div className="flex-1" style={{ background: bgColor }} />
      </div>

      <ColorField
        label={t("store.primary_color_label")}
        hint={t("store.primary_color_hint")}
        value={primaryColor}
        onChange={setPrimaryColor}
      />
      <ColorField
        label={t("store.accent_color_label")}
        hint={t("store.accent_color_hint")}
        value={accentColor}
        onChange={setAccentColor}
      />
      <ColorField
        label={t("store.bg_color_label")}
        hint={t("store.bg_color_hint")}
        value={bgColor}
        onChange={setBgColor}
      />
      <FieldRow label={t("store.font_family_label")}>
        <Input
          dir="ltr"
          value={fontFamily}
          onChange={(event) => setFontFamily(event.currentTarget.value)}
          placeholder={t("store.font_family_placeholder")}
        />
      </FieldRow>
    </SettingsSection>
  );
}

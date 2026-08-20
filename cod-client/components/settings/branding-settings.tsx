"use client";

import { useState, useTransition } from "react";
import { Palette } from "lucide-react";
import { useSettings } from "@/lib/translations";
import type { StoreConfig } from "@/actions/stores";
import { Section, ColorField, FieldRow, inputCls } from "./shared-fields";

export interface BrandingSettingsProps {
  storeConfig: StoreConfig;
  onSave: (payload: {
    primaryColor?: string;
    accentColor?: string;
    bgColor?: string;
    fontFamily?: string;
  }) => Promise<void>;
}

export function BrandingSettings({ storeConfig, onSave }: BrandingSettingsProps) {
  const t = useSettings();
  const s = t.store;

  const [primaryColor, setPrimaryColor] = useState(storeConfig.primaryColor);
  const [accentColor, setAccentColor] = useState(storeConfig.accentColor);
  const [bgColor, setBgColor] = useState(storeConfig.bgColor);
  const [fontFamily, setFontFamily] = useState(storeConfig.fontFamily);
  const [saving, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await onSave({
        primaryColor,
        accentColor,
        bgColor,
        fontFamily: fontFamily.trim() || storeConfig.fontFamily,
      });
    });
  };

  return (
    <Section
      icon={Palette}
      title={s.branding_title}
      subtitle={s.branding_subtitle}
      saving={saving}
      saveLabel={s.save}
      savingLabel={s.saving}
      onSave={handleSave}
    >
      {/* Live color preview strip */}
      <div
        className="flex h-8 w-full overflow-hidden rounded-lg border border-border"
        aria-hidden="true"
      >
        <div className="flex-1" style={{ background: primaryColor }} />
        <div className="flex-1" style={{ background: accentColor }} />
        <div className="flex-1" style={{ background: bgColor }} />
      </div>

      <ColorField
        label={s.primary_color_label}
        hint={s.primary_color_hint}
        value={primaryColor}
        onChange={setPrimaryColor}
      />
      
      <ColorField
        label={s.accent_color_label}
        hint={s.accent_color_hint}
        value={accentColor}
        onChange={setAccentColor}
      />
      
      <ColorField
        label={s.bg_color_label}
        hint={s.bg_color_hint}
        value={bgColor}
        onChange={setBgColor}
      />

      <FieldRow label={s.font_family_label}>
        <input
          type="text"
          dir="ltr"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          placeholder={s.font_family_placeholder}
          className={inputCls}
        />
      </FieldRow>
    </Section>
  );
}

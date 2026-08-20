"use client";

import { useState, useTransition } from "react";
import { Store } from "lucide-react";
import { useSettings } from "@/lib/translations";
import type { StoreConfig } from "@/actions/stores";
import { Section, FieldRow, inputCls } from "./shared-fields";

export interface GeneralSettingsProps {
  storeConfig: StoreConfig;
  onSave: (payload: {
    name?: string;
    lang?: "ar" | "en";
    status?: "active" | "inactive";
  }) => Promise<void>;
}

export function GeneralSettings({ storeConfig, onSave }: GeneralSettingsProps) {
  const t = useSettings();
  const s = t.store;

  const [name, setName] = useState(storeConfig.name);
  const [lang, setLang] = useState<"ar" | "en">(storeConfig.lang);
  const [status, setStatus] = useState<"active" | "inactive">(storeConfig.status);
  const [saving, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await onSave({
        name: name.trim() || storeConfig.name,
        lang,
        status,
      });
    });
  };

  return (
    <Section
      icon={Store}
      title={s.general_title}
      subtitle={s.general_subtitle}
      saving={saving}
      saveLabel={s.save}
      savingLabel={s.saving}
      onSave={handleSave}
    >
      <FieldRow label={s.name_label}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={s.name_placeholder}
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label={s.lang_label}>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as "ar" | "en")}
          className={inputCls}
        >
          <option value="ar">{s.lang_ar}</option>
          <option value="en">{s.lang_en}</option>
        </select>
      </FieldRow>

      <FieldRow label={s.status_label}>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
          className={inputCls}
        >
          <option value="active">{s.status_active}</option>
          <option value="inactive">{s.status_inactive}</option>
        </select>
      </FieldRow>

    </Section>
  );
}

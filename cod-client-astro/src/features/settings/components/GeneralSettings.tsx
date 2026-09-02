import { useState } from "react";
import { Store } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { StoreConfig, StoreLang, StoreStatus } from "@/features/settings/types";
import { FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

export function GeneralSettings({
  storeConfig,
  onSave,
}: {
  storeConfig: StoreConfig;
  onSave: (payload: { name?: string; lang?: StoreLang; status?: StoreStatus }) => Promise<void>;
}) {
  const t = useT("settings");
  const [name, setName] = useState(storeConfig.name);
  const [lang, setLang] = useState<StoreLang>(storeConfig.lang);
  const [status, setStatus] = useState<StoreStatus>(storeConfig.status);

  return (
    <SettingsSection
      icon={Store}
      title={t("store.general_title")}
      subtitle={t("store.general_subtitle")}
      onSave={async () => {
        await onSave({ name: name.trim() || storeConfig.name, lang, status });
      }}
    >
      <FieldRow label={t("store.name_label")}>
        <Input
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder={t("store.name_placeholder")}
        />
      </FieldRow>
      <FieldRow label={t("store.lang_label")}>
        <Select
          value={lang}
          onChange={(event) => setLang(event.currentTarget.value as StoreLang)}
        >
          <option value="ar">{t("store.lang_ar")}</option>
          <option value="en">{t("store.lang_en")}</option>
        </Select>
      </FieldRow>
      <FieldRow label={t("store.status_label")}>
        <Select
          value={status}
          onChange={(event) => setStatus(event.currentTarget.value as StoreStatus)}
        >
          <option value="active">{t("store.status_active")}</option>
          <option value="inactive">{t("store.status_inactive")}</option>
        </Select>
      </FieldRow>
    </SettingsSection>
  );
}

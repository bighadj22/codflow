import { useState } from "react";
import { Megaphone, Search } from "lucide-react";
import { Input, Textarea } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { StoreConfig } from "@/features/settings/types";
import { FieldRow, SettingsSection } from "@/features/settings/components/SettingsSection";

export function SeoSettings({
  storeConfig,
  onSave,
}: {
  storeConfig: StoreConfig;
  onSave: (payload: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    announcementBar?: string | null;
  }) => Promise<void>;
}) {
  const t = useT("settings");
  const [metaTitle, setMetaTitle] = useState(storeConfig.metaTitle ?? "");
  const [metaDesc, setMetaDesc] = useState(storeConfig.metaDescription ?? "");
  const [announcement, setAnnouncement] = useState(storeConfig.announcementBar ?? "");

  return (
    <SettingsSection
      icon={Search}
      title={t("store.seo_title")}
      subtitle={t("store.seo_subtitle")}
      onSave={async () => {
        await onSave({
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDesc.trim() || null,
          announcementBar: announcement.trim() || null,
        });
      }}
    >
      <FieldRow label={t("store.meta_title_label")}>
        <Input
          value={metaTitle}
          onChange={(event) => setMetaTitle(event.currentTarget.value)}
          placeholder={t("store.meta_title_placeholder")}
          maxLength={200}
        />
      </FieldRow>
      <FieldRow label={t("store.meta_desc_label")}>
        <Textarea
          value={metaDesc}
          onChange={(event) => setMetaDesc(event.currentTarget.value)}
          placeholder={t("store.meta_desc_placeholder")}
          maxLength={500}
          rows={3}
        />
      </FieldRow>
      <FieldRow label={t("store.announcement_label")} hint={t("store.announcement_hint")}>
        <div className="relative">
          <Megaphone
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={announcement}
            onChange={(event) => setAnnouncement(event.currentTarget.value)}
            placeholder={t("store.announcement_placeholder")}
            maxLength={500}
            className="ps-9"
          />
        </div>
      </FieldRow>
    </SettingsSection>
  );
}

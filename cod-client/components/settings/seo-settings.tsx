"use client";

import { useState, useTransition } from "react";
import { Search, Megaphone } from "lucide-react";
import { useSettings } from "@/lib/translations";
import type { StoreConfig } from "@/actions/stores";
import { Section, FieldRow, inputCls } from "./shared-fields";

export interface SeoSettingsProps {
  storeConfig: StoreConfig;
  onSave: (payload: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    announcementBar?: string | null;
  }) => Promise<void>;
}

export function SeoSettings({ storeConfig, onSave }: SeoSettingsProps) {
  const t = useSettings();
  const s = t.store;

  const [metaTitle, setMetaTitle] = useState(storeConfig.metaTitle ?? "");
  const [metaDesc, setMetaDesc] = useState(storeConfig.metaDescription ?? "");
  const [announcement, setAnnouncement] = useState(storeConfig.announcementBar ?? "");
  const [saving, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await onSave({
        metaTitle: metaTitle.trim() || null,
        metaDescription: metaDesc.trim() || null,
        announcementBar: announcement.trim() || null,
      });
    });
  };

  return (
    <Section
      icon={Search}
      title={s.seo_title}
      subtitle={s.seo_subtitle}
      saving={saving}
      saveLabel={s.save}
      savingLabel={s.saving}
      onSave={handleSave}
    >
      <FieldRow label={s.meta_title_label}>
        <input
          type="text"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          placeholder={s.meta_title_placeholder}
          maxLength={200}
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label={s.meta_desc_label}>
        <textarea
          value={metaDesc}
          onChange={(e) => setMetaDesc(e.target.value)}
          placeholder={s.meta_desc_placeholder}
          maxLength={500}
          rows={3}
          className={inputCls + " resize-none"}
        />
      </FieldRow>

      <FieldRow label={s.announcement_label} hint={s.announcement_hint}>
        <div className="relative">
          <Megaphone
            size={15}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder={s.announcement_placeholder}
            maxLength={500}
            className={inputCls + " ps-9"}
          />
        </div>
      </FieldRow>
    </Section>
  );
}

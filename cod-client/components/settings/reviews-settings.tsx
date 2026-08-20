"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { useSettings } from "@/lib/translations";
import type { StoreConfig } from "@/actions/stores";
import { Section } from "./shared-fields";

export interface ReviewsSettingsProps {
  storeConfig: StoreConfig;
  onSave: (payload: { reviewsEnabled?: boolean }) => Promise<void>;
}

export function ReviewsSettings({ storeConfig, onSave }: ReviewsSettingsProps) {
  const t = useSettings();
  const s = t.store;

  const [reviewsEnabled, setReviewsEnabled] = useState(storeConfig.reviewsEnabled ?? true);
  const [saving, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await onSave({ reviewsEnabled });
    });
  };

  return (
    <Section
      icon={Star}
      title={s.reviews_title}
      subtitle={s.reviews_subtitle}
      saving={saving}
      saveLabel={s.save}
      savingLabel={s.saving}
      onSave={handleSave}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {s.reviews_enabled_label}
          </span>
          <p className="text-xs text-muted-foreground">
            {s.reviews_enabled_hint}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reviewsEnabled}
          onClick={() => setReviewsEnabled((v) => !v)}
          className={[
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            reviewsEnabled ? "bg-primary" : "bg-muted-foreground/30",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform",
              reviewsEnabled ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>
    </Section>
  );
}

import { useState } from "react";
import { Star } from "lucide-react";
import { useT } from "@/i18n/react";
import type { StoreConfig } from "@/features/settings/types";
import { SettingsSection } from "@/features/settings/components/SettingsSection";

export function ReviewsSettings({
  storeConfig,
  onSave,
}: {
  storeConfig: StoreConfig;
  onSave: (payload: { reviewsEnabled?: boolean }) => Promise<void>;
}) {
  const t = useT("settings");
  const [reviewsEnabled, setReviewsEnabled] = useState(storeConfig.reviewsEnabled ?? true);

  return (
    <SettingsSection
      icon={Star}
      title={t("store.reviews_title")}
      subtitle={t("store.reviews_subtitle")}
      onSave={async () => {
        await onSave({ reviewsEnabled });
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-foreground">
            {t("store.reviews_enabled_label")}
          </span>
          <p className="text-xs text-muted-foreground">{t("store.reviews_enabled_hint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reviewsEnabled}
          onClick={() => setReviewsEnabled((current) => !current)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            reviewsEnabled ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
              reviewsEnabled ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </SettingsSection>
  );
}

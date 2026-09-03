import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Alert, PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { getMyStore, updateMyStore } from "@/features/settings/api";
import { settingsErrorMessage } from "@/features/settings/model";
import type { CategoryId } from "@/features/settings/model";
import type { StoreConfig, UpdateStoreData } from "@/features/settings/types";
import { SettingsSidebar } from "@/features/settings/components/SettingsSidebar";
import { GeneralSettings } from "@/features/settings/components/GeneralSettings";
import { BrandingSettings } from "@/features/settings/components/BrandingSettings";
import { SeoSettings } from "@/features/settings/components/SeoSettings";
import { ReviewsSettings } from "@/features/settings/components/ReviewsSettings";
import { TrackingSettings } from "@/features/settings/components/TrackingSettings";
import { VerificationSettings } from "@/features/settings/components/VerificationSettings";
import { EmailSettings } from "@/features/settings/components/EmailSettings";
import { ApiSettings } from "@/features/settings/components/ApiSettings";

function SettingsContent() {
  const t = useT("settings");
  const auth = useT("auth");
  const common = useT("common");
  const identity = useIdentity();
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("general");

  const isAdmin = identity?.role === "admin";

  async function load() {
    setLoadError(null);
    try {
      setStoreConfig(await getMyStore());
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (isAdmin) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  async function handleSave(payload: UpdateStoreData) {
    try {
      const updated = await updateMyStore(payload);
      setStoreConfig(updated);
    } catch (cause) {
      throw new Error(settingsErrorMessage(cause, t));
    }
  }

  if (!isAdmin)
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (loadError)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("store.error_load")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  if (storeConfig === null)
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex min-h-40 items-center justify-center"
      >
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );

  const renderCategoryView = () => {
    switch (activeCategory) {
      case "general":
        return <GeneralSettings storeConfig={storeConfig} onSave={handleSave} />;
      case "branding":
        return <BrandingSettings storeConfig={storeConfig} onSave={handleSave} />;
      case "seo":
        return <SeoSettings storeConfig={storeConfig} onSave={handleSave} />;
      case "reviews":
        return <ReviewsSettings storeConfig={storeConfig} onSave={handleSave} />;
      case "analytics":
        return <TrackingSettings />;
      case "verification":
        return <VerificationSettings />;
      case "email":
        return <EmailSettings />;
      case "api":
        return <ApiSettings storeConfig={storeConfig} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="md:hidden">
        <SettingsSidebar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          variant="mobile"
        />
      </div>
      <div className="flex items-start gap-6">
        <div className="hidden md:block">
          <SettingsSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            variant="desktop"
          />
        </div>
        <div className="min-w-0 w-full flex-1">{renderCategoryView()}</div>
      </div>
    </div>
  );
}

function Gated() {
  const t = useT("settings");
  return (
    <DashboardChrome currentPath="/settings">
      <PageHeader title={t("store.title")} />
      <SettingsContent />
    </DashboardChrome>
  );
}

export default function SettingsPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}

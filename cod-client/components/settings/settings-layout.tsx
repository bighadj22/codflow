"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/translations";
import { getMyStore, updateMyStore, type StoreConfig } from "@/actions/stores";
import { SettingsSidebar, type CategoryId } from "./settings-sidebar";
import { GeneralSettings } from "./general-settings";
import { BrandingSettings } from "./branding-settings";
import { SeoSettings } from "./seo-settings";
import { ReviewsSettings } from "./reviews-settings";
import { TrackingSettings } from "./tracking-settings";
import { ApiSettings } from "./api-settings";

export function SettingsLayout() {
  const t = useSettings();
  const s = t.store;

  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("general");
  const [loading, setLoading] = useState(true);

  // Fetch store config on mount
  useEffect(() => {
    getMyStore().then((data) => {
      if (data) setStoreConfig(data);
      setLoading(false);
    });
  }, []);

  // Handle category navigation
  const handleCategoryChange = (category: CategoryId) => {
    setActiveCategory(category);
  };

  // Generic save handler
  const handleSave = async (payload: Parameters<typeof updateMyStore>[0]) => {
    try {
      const updated = await updateMyStore(payload);
      setStoreConfig(updated);
      toast.success(s.saved);
    } catch (error) {
      toast.error(s.save_error);
      console.error("Save failed:", error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (!storeConfig) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">{s.loading}</p>
      </div>
    );
  }

  // Render active category view
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
      case "api":
        return <ApiSettings storeConfig={storeConfig} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header - desktop only */}
      <h1 className="hidden md:block text-2xl font-black text-foreground">{s.title}</h1>

      {/* Mobile tabs - full width, outside flex container */}
      <div className="md:hidden">
        <SettingsSidebar
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          variant="mobile"
        />
      </div>

      {/* Settings content with sidebar - desktop only */}
      <div className="flex gap-6 items-start">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <SettingsSidebar
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            variant="desktop"
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 w-full">
          {renderCategoryView()}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useT } from "@/i18n/react";
import { getUpsellConfig, saveUpsellConfig } from "@/features/settings/api";
import { SettingsSection } from "@/features/settings/components/SettingsSection";

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
            checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function UpsellSettings() {
  const t = useT("settings");
  const [inlineEnabled, setInlineEnabled] = useState(false);
  const [modalEnabled, setModalEnabled] = useState(false);
  const [catalogueVisible, setCatalogueVisible] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let alive = true;
    getUpsellConfig().then((data) => {
      if (!alive || !data) return;
      setInlineEnabled(data.showInInlineCheckout);
      setModalEnabled(data.showInConfirmModal);
      setCatalogueVisible(data.showInCatalogue);
      setConfigured(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave() {
    const saved = await saveUpsellConfig({
      showInInlineCheckout: inlineEnabled,
      showInConfirmModal: modalEnabled,
      showInCatalogue: catalogueVisible,
    });
    setInlineEnabled(saved.showInInlineCheckout);
    setModalEnabled(saved.showInConfirmModal);
    setCatalogueVisible(saved.showInCatalogue);
    setConfigured(true);
  }

  return (
    <SettingsSection
      icon={TrendingUp}
      title={t("store.upsell_title")}
      subtitle={t("store.upsell_subtitle")}
      onSave={handleSave}
    >
      {!configured && (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          {t("store.upsell_unconfigured_hint")}
        </p>
      )}
      <Toggle
        checked={inlineEnabled}
        onChange={setInlineEnabled}
        label={t("store.upsell_inline_label")}
        hint={t("store.upsell_inline_hint")}
      />
      <Toggle
        checked={modalEnabled}
        onChange={setModalEnabled}
        label={t("store.upsell_modal_label")}
        hint={t("store.upsell_modal_hint")}
      />
      <div className="border-t border-border pt-5">
        <Toggle
          checked={catalogueVisible}
          onChange={setCatalogueVisible}
          label={t("store.upsell_catalogue_label")}
          hint={t("store.upsell_catalogue_hint")}
        />
      </div>
    </SettingsSection>
  );
}

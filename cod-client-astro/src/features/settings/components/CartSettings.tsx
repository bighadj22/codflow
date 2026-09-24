import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useT } from "@/i18n/react";
import type { StoreConfig } from "@/features/settings/types";
import { SettingsSection } from "@/features/settings/components/SettingsSection";

/**
 * The shopping cart opt-in.
 *
 * Off by default. Turning it on adds "Add to cart" alongside the existing
 * one-click order form — it never replaces it, because the direct form is what
 * converts for merchants selling a single product to ad traffic.
 */
export function CartSettings({
  storeConfig,
  onSave,
}: {
  storeConfig: StoreConfig;
  onSave: (payload: { cartEnabled?: boolean }) => Promise<void>;
}) {
  const t = useT("settings");
  const [cartEnabled, setCartEnabled] = useState(storeConfig.cartEnabled ?? false);

  return (
    <SettingsSection
      icon={ShoppingCart}
      title={t("store.cart_title")}
      subtitle={t("store.cart_subtitle")}
      onSave={async () => {
        await onSave({ cartEnabled });
      }}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-foreground">
              {t("store.cart_enabled_label")}
            </span>
            <p className="text-xs text-muted-foreground">
              {t("store.cart_enabled_hint")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={cartEnabled}
            aria-label={t("store.cart_enabled_label")}
            onClick={() => setCartEnabled((current) => !current)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              cartEnabled ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                cartEnabled ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {cartEnabled && (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("store.cart_enabled_note")}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

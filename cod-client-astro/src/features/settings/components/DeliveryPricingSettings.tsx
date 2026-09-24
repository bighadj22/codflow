import { useState } from "react";
import { Truck } from "lucide-react";
import { useT } from "@/i18n/react";
import type { StoreConfig } from "@/features/settings/types";
import { SettingsSection } from "@/features/settings/components/SettingsSection";

type ShippingMode = "highest" | "default_profile";

/**
 * Delivery pricing controls.
 *
 * Both settings default to today's behaviour, so a merchant who never opens
 * this panel sees no change. The threshold is deliberately a nullable number
 * rather than a toggle plus a value: "off" and "free for everyone" must not be
 * expressible as the same state, and an empty field says off unambiguously.
 */
export function DeliveryPricingSettings({
  storeConfig,
  onSave,
}: {
  storeConfig: StoreConfig;
  onSave: (payload: {
    freeShippingThreshold?: number | null;
    cartShippingMode?: ShippingMode;
  }) => Promise<void>;
}) {
  const t = useT("settings");

  // Held as a string so the field can be genuinely empty (= no threshold)
  // rather than collapsing to 0, which would mean "everything ships free".
  const [threshold, setThreshold] = useState(
    storeConfig.freeShippingThreshold == null
      ? ""
      : String(storeConfig.freeShippingThreshold),
  );
  const [mode, setMode] = useState<ShippingMode>(
    storeConfig.cartShippingMode ?? "highest",
  );

  const trimmed = threshold.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  const invalid =
    parsed !== null && (!Number.isInteger(parsed) || parsed < 1);

  return (
    <SettingsSection
      icon={Truck}
      title={t("store.delivery_pricing_title")}
      subtitle={t("store.delivery_pricing_subtitle")}
      onSave={async () => {
        if (invalid) return;
        await onSave({ freeShippingThreshold: parsed, cartShippingMode: mode });
      }}
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <label
            htmlFor="free-shipping-threshold"
            className="text-sm font-semibold text-foreground"
          >
            {t("store.free_shipping_threshold_label")}
          </label>
          <input
            id="free-shipping-threshold"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder={t("store.free_shipping_threshold_placeholder")}
            aria-invalid={invalid || undefined}
            aria-describedby="free-shipping-threshold-hint"
            className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p
            id="free-shipping-threshold-hint"
            className={`text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}
          >
            {invalid
              ? t("store.free_shipping_threshold_invalid")
              : t("store.free_shipping_threshold_hint")}
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">
            {t("store.cart_shipping_mode_label")}
          </legend>
          <p className="text-xs text-muted-foreground">
            {t("store.cart_shipping_mode_hint")}
          </p>
          <div className="space-y-2 pt-1">
            {(["highest", "default_profile"] as const).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="cartShippingMode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block font-medium text-foreground">
                    {t(`store.cart_shipping_mode_${value}_label`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`store.cart_shipping_mode_${value}_hint`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </SettingsSection>
  );
}

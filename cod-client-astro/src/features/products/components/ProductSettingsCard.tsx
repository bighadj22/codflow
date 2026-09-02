import { Card, Field, Input, Select } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { ProductStatus } from "@/features/products/types";

const STATUS_VALUES: ProductStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];

interface ProductSettingsCardProps {
  status: ProductStatus;
  setStatus: (status: ProductStatus) => void;
  inventory: string;
  setInventory: (val: string) => void;
  lowStockThreshold: string;
  setLowStockThreshold: (val: string) => void;
  trackInventory: boolean;
  setTrackInventory: (val: boolean) => void;
  hasVariantsSwitch: boolean;
  editing: boolean;
  busy: boolean;
}

export function ProductSettingsCard({
  status,
  setStatus,
  inventory,
  setInventory,
  lowStockThreshold,
  setLowStockThreshold,
  trackInventory,
  setTrackInventory,
  hasVariantsSwitch,
  editing,
  busy,
}: ProductSettingsCardProps) {
  const t = useT("products");

  return (
    <Card title={t("form.section_settings")}>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("form.status_label")}>
          <Select
            value={status}
            onChange={(event) =>
              setStatus(event.currentTarget.value as ProductStatus)
            }
            disabled={busy}
          >
            {STATUS_VALUES.map((option) => (
              <option key={option} value={option}>
                {t(`status_options.${option.toLocaleLowerCase()}`)}
              </option>
            ))}
          </Select>
        </Field>
        {!hasVariantsSwitch && !editing && (
          <Field label={t("form.initial_stock_label")}>
            <Input
              type="number"
              value={inventory}
              onChange={(event) => setInventory(event.currentTarget.value)}
              min={0}
              disabled={busy}
            />
          </Field>
        )}
        {!hasVariantsSwitch && (
          <Field label={t("form.threshold_label")}>
            <Input
              type="number"
              value={lowStockThreshold}
              onChange={(event) =>
                setLowStockThreshold(event.currentTarget.value)
              }
              min={0}
              disabled={busy}
            />
          </Field>
        )}
      </div>
      <div className="mt-5 border-t border-border pt-5">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("form.track_stock_label")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("form.track_stock_hint")}
            </p>
          </div>
          <input
            type="checkbox"
            checked={trackInventory}
            onChange={(event) =>
              setTrackInventory(event.currentTarget.checked)
            }
            disabled={busy}
            className="size-5 accent-primary"
          />
        </label>
      </div>
    </Card>
  );
}

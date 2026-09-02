import { Card, Field, Input } from "@/components/ui";
import { useT } from "@/i18n/react";

interface ProductPricingCardProps {
  price: string;
  setPrice: (val: string) => void;
  compareAtPrice: string;
  setCompareAtPrice: (val: string) => void;
  costPrice: string;
  setCostPrice: (val: string) => void;
  margin: number | null;
  hasVariantsSwitch: boolean;
  errors: Record<string, string>;
  busy: boolean;
}

export function ProductPricingCard({
  price,
  setPrice,
  compareAtPrice,
  setCompareAtPrice,
  costPrice,
  setCostPrice,
  margin,
  hasVariantsSwitch,
  errors,
  busy,
}: ProductPricingCardProps) {
  const t = useT("products");
  const common = useT("common");

  return (
    <Card title={t("form.section_pricing")}>
      <p className="mb-4 text-xs font-semibold text-muted-foreground">
        {hasVariantsSwitch
          ? t("form.base_price_hint")
          : t("form.product_price_hint")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={`${t("form.base_price_label")} *`}
          error={errors.price}
        >
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.currentTarget.value)}
              min={0}
              className="pe-16"
              disabled={busy}
            />
            <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {common("currency.symbol")}
            </span>
          </div>
        </Field>
        <Field label={t("form.compare_at_price_label")}>
          <Input
            type="number"
            inputMode="decimal"
            value={compareAtPrice}
            onChange={(event) =>
              setCompareAtPrice(event.currentTarget.value)
            }
            min={0}
            disabled={busy}
          />
        </Field>
        <Field
          label={`${t("form.cost_price_label")}${margin !== null ? ` — ${t("form.margin_label")}: ${margin}%` : ""}`}
        >
          <Input
            type="number"
            inputMode="decimal"
            value={costPrice}
            onChange={(event) => setCostPrice(event.currentTarget.value)}
            min={0}
            disabled={busy}
          />
        </Field>
      </div>
    </Card>
  );
}

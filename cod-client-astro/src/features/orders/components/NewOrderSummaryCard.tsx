import { Save } from "lucide-react";
import { Card } from "@/components/ui";
import { formatMoney } from "@/features/orders/model";
import { useT } from "@/i18n/react";
import type { Locale } from "@/i18n/config";

interface NewOrderSummaryCardProps {
  subtotal: number;
  deliveryFee: number;
  total: number;
  busy: boolean;
  locale: Locale;
  onSave: () => void | Promise<void>;
}

export function NewOrderSummaryCard({
  subtotal,
  deliveryFee,
  total,
  busy,
  locale,
  onSave,
}: NewOrderSummaryCardProps) {
  const t = useT("orders");
  const common = useT("common");

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("form.products_section")}</span>
          <span>{formatMoney(subtotal, locale)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("form.delivery_fee_label")}</span>
          <span>{formatMoney(deliveryFee, locale)}</span>
        </div>
        <div className="flex items-end justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold">
            {t("form.order_total")}
          </span>
          <span className="text-xl font-bold tabular-nums">
            {formatMoney(total, locale)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save size={16} />
          {busy ? t("form.saving") : t("form.form_save_create")}
        </button>
        <a
          href="/orders"
          className="flex h-10 items-center justify-center rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          {common("cancel")}
        </a>
      </div>
    </Card>
  );
}

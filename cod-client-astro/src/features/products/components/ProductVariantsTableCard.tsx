import { useState } from "react";
import { Bell, Check, History } from "lucide-react";
import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import {
  updateProductStockThreshold,
  updateVariantStockThreshold,
} from "@/features/products/api";
import { formatMoneyValue, variantLabel } from "@/features/products/model";
import type { ProductVariant } from "@/features/products/types";
import { notify } from "@/lib/notify";

export function ThresholdEditor({
  productId,
  variantId,
  initial,
}: {
  productId: string;
  variantId?: string;
  initial: number;
}) {
  const common = useT("common");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initial));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const num = parseInt(value, 10);
    if (Number.isNaN(num) || num < 0) {
      setEditing(false);
      setValue(String(initial));
      return;
    }
    setSaving(true);
    try {
      if (variantId)
        await updateVariantStockThreshold(productId, variantId, num);
      else await updateProductStockThreshold(productId, num);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      notify.success(common("feedback.saved"));
    } catch {
      setValue(String(initial));
      notify.error(common("feedback.action_failed"));
    } finally {
      setEditing(false);
      setSaving(false);
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => !editing && setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!editing) setEditing(true);
        }
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${editing ? "cursor-default border-amber-500/50 bg-amber-500/10" : "cursor-pointer border-amber-500/20 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"}`}
    >
      {saved ? (
        <Check size={12} className="shrink-0 text-violet-600" />
      ) : (
        <Bell size={12} className="shrink-0 text-amber-500/70" />
      )}
      {editing ? (
        <input
          autoFocus
          type="number"
          min={0}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={() => void handleSave()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setEditing(false);
              setValue(String(initial));
            }
          }}
          onClick={(event) => event.stopPropagation()}
          className="w-10 bg-transparent text-center text-xs font-bold tabular-nums text-amber-600 outline-none dark:text-amber-400"
        />
      ) : (
        <span className="tabular-nums text-amber-600/80 dark:text-amber-400/80">
          {value}
        </span>
      )}
    </span>
  );
}

export function ProductVariantsTableCard({
  productId,
  variants,
  onOpenHistory,
}: {
  productId: string;
  variants: ProductVariant[];
  onOpenHistory: (variantId: string, label: string | null) => void;
}) {
  const t = useT("products");
  const locale = useLocale();

  if (variants.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
          {t("empty_state.title")}
        </p>
      </Card>
    );
  }

  return (
    <Card title={`${t("table.variants")} (${variants.length})`}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">
                {t("form.variant_label")}
              </TableHead>
              <TableHead className="text-center">
                {t("table.price")}
              </TableHead>
              <TableHead className="text-center">
                {t("stock.in_stock")}
              </TableHead>
              <TableHead className="text-center">
                {t("stock_overview.col_threshold")}
              </TableHead>
              <TableHead className="text-end">
                {t("table.status")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant) => (
              <TableRow key={variant.id} className="hover:bg-muted/20">
                <TableCell>
                  <p className="text-sm font-bold text-foreground">
                    {variantLabel(variant.variations)}
                  </p>
                  {variant.sku && (
                    <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground/50">
                      {variant.sku}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm font-bold tabular-nums">
                  {formatMoneyValue(variant.price, locale)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-bold tabular-nums">
                      {variant.inventory}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenHistory(variant.id, variantLabel(variant.variations))
                      }
                      className="grid size-6 place-items-center rounded-md bg-muted/40 text-muted-foreground/40 transition-colors hover:bg-primary/10 hover:text-primary"
                      title={t("actions.stock_history")}
                      aria-label={t("actions.stock_history")}
                    >
                      <History size={13} />
                    </button>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <ThresholdEditor
                    productId={productId}
                    variantId={variant.id}
                    initial={variant.lowStockThreshold ?? 5}
                  />
                </TableCell>
                <TableCell className="text-end">
                  {variant.active ? (
                    <Badge tone="success">
                      {t("status_options.active")}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      {t("status_options.draft")}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

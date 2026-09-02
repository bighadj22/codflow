import { useState } from "react";
import { useT } from "@/i18n/react";
import { adjustProductStock, adjustVariantStock } from "@/features/products/api";
import type { StockMovementType } from "@/features/products/types";
import { Button, Dialog, Select } from "@/components/ui";
import { notify } from "@/lib/notify";

const REASON_REQUIRED: StockMovementType[] = ["ADJUSTMENT_ADD", "ADJUSTMENT_REMOVE", "OFFLINE_SALE"];
const STOCK_OUT_TYPES: StockMovementType[] = ["ADJUSTMENT_REMOVE", "OFFLINE_SALE"];
const ACTION_TYPES: StockMovementType[] = ["PURCHASE", "OFFLINE_SALE", "ADJUSTMENT_ADD", "ADJUSTMENT_REMOVE"];

export function StockAdjustmentDialog({ productId, variantId, variantDisplayLabel, simpleInventory, onClose, onSuccess }: {
  productId: string;
  variantId?: string | null;
  variantDisplayLabel?: string | null;
  simpleInventory?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT("products");
  const [actionType, setActionType] = useState<StockMovementType>("PURCHASE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentInventory = simpleInventory ?? 0;
  const qtyNum = parseInt(quantity, 10);
  const isOutType = STOCK_OUT_TYPES.includes(actionType);
  const delta = Number.isNaN(qtyNum) || qtyNum <= 0 ? 0 : isOutType ? -qtyNum : qtyNum;
  const preview = currentInventory + delta;
  const reasonRequired = REASON_REQUIRED.includes(actionType);
  const canConfirm = !loading && qtyNum > 0 && preview >= 0 && (!reasonRequired || reason.trim().length > 0);

  async function handleConfirm() {
    if (qtyNum <= 0) { setError(t("stock_dialog.error_nonzero")); return; }
    if (preview < 0) { setError(t("stock_dialog.error_negative")); return; }
    if (reasonRequired && !reason.trim()) { setError(t("stock_dialog.error_reason_required")); return; }
    setLoading(true);
    setError(null);
    const input = { type: actionType, delta, reason: reason.trim() || undefined };
    try {
      if (variantId) await adjustVariantStock(productId, variantId, input);
      else await adjustProductStock(productId, input);
      notify.success(t("stock_dialog.success"));
      onSuccess();
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      const message = code === "INSUFFICIENT_STOCK" ? t("error_insufficient_stock") : t("stock_dialog.error_failed");
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  }

  return <Dialog onClose={onClose} title={t("stock_dialog.title")} description={variantDisplayLabel ?? t("stock_dialog.no_variant")} className="max-w-sm">
    <div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-sm"><span className="text-muted-foreground">{t("stock_dialog.current")}</span><span className="text-base font-bold tabular-nums">{currentInventory}</span></div>
    <div className="space-y-2"><p className="text-sm font-semibold text-foreground">{t("stock_dialog.action_label")}</p><Select value={actionType} onChange={(event) => setActionType(event.currentTarget.value as StockMovementType)}>{ACTION_TYPES.map((type) => <option key={type} value={type}>{t(`stock_dialog.action_${type.toLocaleLowerCase()}`)}</option>)}</Select></div>
    <div className="space-y-2"><p className="text-sm font-semibold text-foreground">{t("stock_dialog.quantity_label")}</p><input type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.currentTarget.value)} placeholder={t("stock_dialog.quantity_placeholder")} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" /></div>
    <div className="space-y-2"><p className="text-sm font-semibold text-foreground">{t("stock_dialog.reason_label")}{reasonRequired && <span className="ms-1 text-destructive">*</span>}</p><textarea value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder={t("stock_dialog.reason_placeholder")} rows={2} className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" /></div>
    {qtyNum > 0 && <div className={`flex items-center justify-between rounded-xl p-3 text-sm font-medium ${preview < 0 ? "bg-destructive/10 text-destructive" : "bg-muted/60"}`}><span className="text-muted-foreground">{t("stock_dialog.after_adjustment")}</span><span className="text-base font-bold tabular-nums">{currentInventory} <span className={delta > 0 ? "text-violet-600" : "text-destructive"}>{delta > 0 ? `+${delta}` : delta}</span> → {preview}</span></div>}
    {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
    <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose} disabled={loading}>{t("stock_dialog.cancel")}</Button><Button type="button" onClick={() => void handleConfirm()} disabled={!canConfirm}>{loading ? t("stock_dialog.saving") : t("stock_dialog.confirm")}</Button></div>
  </Dialog>;
}

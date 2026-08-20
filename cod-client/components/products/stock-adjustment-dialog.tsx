"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useProducts } from "@/lib/translations";
import { adjustProductStock, adjustVariantStock } from "@/actions/stock";
import type { ProductVariant } from "@/types";
import type { StockMovementType } from "@/types/stock.types";

// Movement types that require a reason note
const REASON_REQUIRED: StockMovementType[] = [
  "ADJUSTMENT_ADD",
  "ADJUSTMENT_REMOVE",
  "OFFLINE_SALE",
];

// Which types reduce stock (negative delta)
const STOCK_OUT_TYPES: StockMovementType[] = [
  "ADJUSTMENT_REMOVE",
  "OFFLINE_SALE",
];

interface Props {
  productId: string;
  /** Pass variant for a variant product, null for a simple product */
  variant: ProductVariant | null;
  /** Current inventory for simple products (or when variant object not available) */
  simpleInventory?: number;
  /** Variant id when variant object is not available (e.g. from StockAlertItem) */
  variantId?: string | null;
  /** Variant label when variant object is not available */
  variantDisplayLabel?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({
  productId,
  variant,
  simpleInventory,
  variantId,
  variantDisplayLabel,
  onClose,
  onSuccess,
}: Props) {
  const t = useProducts();
  const [actionType, setActionType] = useState<StockMovementType>("PURCHASE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const currentInventory =
    variant !== null ? (variant?.inventory ?? 0) : (simpleInventory ?? 0);

  const variantLabel =
    variant !== null
      ? Object.entries(variant?.variations ?? {})
          .map(([, v]) => v)
          .join(" / ")
      : (variantDisplayLabel ?? null);

  // Resolved variant id — from full variant object OR the explicit prop
  const resolvedVariantId = variant?.id ?? variantId ?? null;

  const qtyNum = parseInt(quantity, 10);
  const isOutType = STOCK_OUT_TYPES.includes(actionType);
  const delta = isNaN(qtyNum) || qtyNum <= 0 ? 0 : isOutType ? -qtyNum : qtyNum;
  const preview = currentInventory + delta;
  const reasonRequired = REASON_REQUIRED.includes(actionType);
  const canConfirm =
    !loading &&
    qtyNum > 0 &&
    preview >= 0 &&
    (!reasonRequired || reason.trim().length > 0);

  async function handleConfirm() {
    if (qtyNum <= 0) {
      toast.error(t.stock_dialog.error_nonzero);
      return;
    }
    if (preview < 0) {
      toast.error(t.stock_dialog.error_negative);
      return;
    }
    if (reasonRequired && !reason.trim()) {
      toast.error(t.stock_dialog.error_reason_required);
      return;
    }

    setLoading(true);
    try {
      const input = {
        type: actionType,
        delta,
        reason: reason.trim() || undefined,
      };

      if (resolvedVariantId) {
        await adjustVariantStock(productId, resolvedVariantId, input);
      } else {
        await adjustProductStock(productId, input);
      }

      toast.success(t.stock_dialog.success);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.stock_dialog.error_failed);
    } finally {
      setLoading(false);
    }
  }

  // Lock scroll on main container while dialog is open
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.style.overflow = "hidden";
    return () => { main.style.overflow = ""; };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm space-y-5 shadow-2xl p-6">

        {/* Header */}
        <div>
          <h2 className="text-base font-bold">{t.stock_dialog.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {variantLabel ?? t.stock_dialog.no_variant}
          </p>
        </div>

        {/* Current inventory */}
        <div className="bg-muted/60 rounded-xl p-3 flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t.stock_dialog.current}</span>
          <span className="font-bold text-base">{currentInventory}</span>
        </div>

        {/* Action type selector */}
        <div className="space-y-2">
          <Label className="font-bold text-sm">{t.stock_dialog.action_label}</Label>
          <Select
            value={actionType}
            onValueChange={(v) => setActionType((v ?? "PURCHASE") as StockMovementType)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.stock_dialog.action_placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PURCHASE">{t.stock_dialog.action_purchase}</SelectItem>
              <SelectItem value="OFFLINE_SALE">{t.stock_dialog.action_offline_sale}</SelectItem>
              <SelectItem value="ADJUSTMENT_ADD">{t.stock_dialog.action_adjustment_add}</SelectItem>
              <SelectItem value="ADJUSTMENT_REMOVE">{t.stock_dialog.action_adjustment_remove}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <Label className="font-bold text-sm">{t.stock_dialog.quantity_label}</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={t.stock_dialog.quantity_placeholder}
          />
        </div>

        {/* Reason (required for certain types) */}
        <div className="space-y-2">
          <Label className="font-bold text-sm">
            {t.stock_dialog.reason_label}
            {reasonRequired && <span className="text-destructive ms-1">*</span>}
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.stock_dialog.reason_placeholder}
            rows={2}
            className="resize-none"
          />
        </div>

        {/* Preview */}
        {qtyNum > 0 && (
          <div
            className={`rounded-xl p-3 flex justify-between items-center text-sm font-medium ${
              preview < 0
                ? "bg-destructive/10 text-destructive"
                : "bg-muted/60"
            }`}
          >
            <span className="text-muted-foreground">{t.stock_dialog.after_adjustment}</span>
            <span className="font-bold text-base">
              {currentInventory}{" "}
              <span className={delta > 0 ? "text-green-500" : "text-destructive"}>
                {delta > 0 ? `+${delta}` : delta}
              </span>{" "}
              → {preview}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t.stock_dialog.cancel}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {loading ? t.stock_dialog.saving : t.stock_dialog.confirm}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

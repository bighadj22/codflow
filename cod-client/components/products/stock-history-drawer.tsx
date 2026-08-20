"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStockHistory } from "@/actions/stock";
import { useProducts } from "@/lib/translations";
import type { StockMovement, StockMovementType } from "@/types/stock.types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const PAGE_SIZE = 20;

// Types where delta is positive (stock in)
const STOCK_IN_TYPES: StockMovementType[] = [
  "PURCHASE",
  "ADJUSTMENT_ADD",
  "ORDER_CANCELLED",
  "ORDER_RETURNED",
];

function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const t = useProducts();
  const isIn = STOCK_IN_TYPES.includes(type);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
        isIn
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {isIn ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {t.stock_history.movement_types[type]}
    </span>
  );
}

interface Props {
  productId: string;
  variantId?: string;
  productName: string;
  variantLabel?: string | null;
  open: boolean;
  onClose: () => void;
}

export function StockHistoryDrawer({
  productId,
  variantId,
  productName,
  variantLabel,
  open,
  onClose,
}: Props) {
  const t = useProducts();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchMovements = useCallback(
    async (nextOffset: number, replace: boolean) => {
      setLoading(true);
      try {
        const res = await getStockHistory(productId, {
          variantId,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setMovements((prev) => (replace ? res.movements : [...prev, ...res.movements]));
        setTotal(res.total);
        setOffset(nextOffset + res.movements.length);
      } catch {
        // silent — toast would be noise here
      } finally {
        setLoading(false);
      }
    },
    [productId, variantId],
  );

  useEffect(() => {
    if (!open) return;
    setMovements([]);
    setOffset(0);
    fetchMovements(0, true);
  }, [open, fetchMovements]);

  // Lock scroll on the main scroll container when drawer is open
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    if (open) {
      main.style.overflow = "hidden";
    } else {
      main.style.overflow = "";
    }
    return () => { main.style.overflow = ""; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const hasMore = movements.length < total;

  const drawerContent = (
    <>
      {/* Backdrop — rendered via portal, covers full viewport */}
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-[61] flex flex-col bg-card rounded-t-2xl border-t border-border shadow-2xl max-h-[85dvh] sm:inset-y-0 sm:end-0 sm:start-auto sm:w-[420px] sm:rounded-none sm:rounded-s-2xl sm:border-s sm:border-t-0 sm:max-h-full"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-base truncate">{t.stock_history.title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {productName}
              {variantLabel && (
                <span className="text-muted-foreground/60"> — {variantLabel}</span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 -me-1"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Movement list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {movements.length === 0 && !loading && (
            <p className="text-center text-muted-foreground text-sm py-12">
              {t.stock_history.empty}
            </p>
          )}

          {movements.map((m) => (
            <MovementRow key={m.id} movement={m} t={t} />
          ))}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => fetchMovements(offset, false)}
              disabled={loading}
            >
              {loading ? t.stock_history.loading : t.stock_history.load_more}
            </Button>
          )}

          {loading && movements.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">
              {t.stock_history.loading}
            </p>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawerContent, document.body);
}

function MovementRow({
  movement,
  t,
}: {
  movement: StockMovement;
  t: ReturnType<typeof useProducts>;
}) {
  const isIn = movement.delta > 0;
  const relativeTime = formatDistanceToNow(new Date(movement.createdAt), {
    addSuffix: true,
    locale: ar,
  });

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <MovementTypeBadge type={movement.type as StockMovementType} />
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-sm font-bold tabular-nums ${
              isIn ? "text-green-500" : "text-destructive"
            }`}
          >
            {isIn ? "+" : ""}
            {movement.delta}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {movement.qtyBefore} → {movement.qtyAfter}
          </span>
        </div>
      </div>

      {movement.reason && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {movement.reason}
        </p>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
        <span>{movement.createdByName}</span>
        <span dir="ltr">{relativeTime}</span>
      </div>
    </div>
  );
}

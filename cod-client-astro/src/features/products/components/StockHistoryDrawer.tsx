import { useEffect, useState } from "react";
import { AlertCircle, History } from "lucide-react";
import { useT } from "@/i18n/react";
import { getStockHistory } from "@/features/products/api";
import { movementIsStockIn } from "@/features/products/model";
import type {
  StockMovement,
  StockMovementType,
} from "@/features/products/types";
import { Alert, Button, Dialog, EmptyState } from "@/components/ui";

const PAGE_SIZE = 20;
const STOCK_IN_TYPES: StockMovementType[] = [
  "PURCHASE",
  "ADJUSTMENT_ADD",
  "ORDER_CANCELLED",
  "ORDER_RETURNED",
];

function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const t = useT("products");
  const isIn = STOCK_IN_TYPES.includes(type);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${isIn ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-destructive/10 text-destructive"}`}
    >
      {t(`stock_history.movement_types.${type}`)}
    </span>
  );
}

function MovementRow({ movement }: { movement: StockMovement }) {
  const isIn = movementIsStockIn(movement.type);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <MovementTypeBadge type={movement.type} />
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`text-sm font-bold tabular-nums ${isIn ? "text-violet-600 dark:text-violet-400" : "text-destructive"}`}
          >
            {isIn ? "+" : ""}
            {movement.delta}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {movement.qtyBefore} → {movement.qtyAfter}
          </span>
        </div>
      </div>
      {movement.reason && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {movement.reason}
        </p>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
        <span>{movement.createdByName}</span>
        <span dir="ltr">{new Date(movement.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

export function StockHistoryDrawer({
  productId,
  variantId,
  productName,
  variantLabel,
  open,
  onClose,
}: {
  productId: string;
  variantId?: string;
  productName: string;
  variantLabel?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT("products");
  const common = useT("common");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function fetchMovements(nextOffset: number, replace: boolean) {
    setLoading(true);
    setError(false);
    try {
      const result = await getStockHistory(productId, {
        variantId,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setMovements((prev) =>
        replace ? result.movements : [...prev, ...result.movements],
      );
      setTotal(result.total);
      setOffset(nextOffset + result.movements.length);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setMovements([]);
    setOffset(0);
    setError(false);
    void fetchMovements(0, true);
  }, [open, productId, variantId]);

  const hasMore = movements.length < total;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      placement="end"
      title={t("stock_history.title")}
      description={
        <>
          {productName}
          {variantLabel && (
            <span className="text-muted-foreground/60"> · {variantLabel}</span>
          )}
        </>
      }
      icon={<History size={18} aria-hidden="true" />}
    >
      <div className="space-y-2">
        {error && (
          <Alert role="alert" tone="critical">
            <AlertCircle size={18} className="shrink-0" />
            <span className="min-w-0 flex-1">{t("stock_history.error")}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                void fetchMovements(offset, movements.length === 0)
              }
            >
              {common("retry")}
            </Button>
          </Alert>
        )}
        {movements.length === 0 && !loading && !error && (
          <EmptyState
            compact
            icon={<History size={20} />}
            title={t("stock_history.empty")}
          />
        )}
        {movements.map((movement) => (
          <MovementRow key={movement.id} movement={movement} />
        ))}
        {hasMore && (
          <Button
            type="button"
            variant="secondary"
            className="mt-2 w-full"
            disabled={loading}
            onClick={() => void fetchMovements(offset, false)}
          >
            {loading
              ? t("stock_history.loading")
              : t("stock_history.load_more")}
          </Button>
        )}
        {loading && movements.length === 0 && (
          <div role="status" aria-busy="true" className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

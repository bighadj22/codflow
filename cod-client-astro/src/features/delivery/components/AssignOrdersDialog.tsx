import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { useT } from "@/i18n/react";
import { assignDriver } from "@/features/orders/api";
import { driverErrorMessage, driverFullName } from "@/features/delivery/model";
import type { Driver } from "@/features/delivery/types";
import type { OrderListItem } from "@/features/orders/types";
import { notify } from "@/lib/notify";

/**
 * Batch-assign ready orders to a driver. Shows every `ready` order with a
 * checkbox; submitting assigns all selected orders in parallel.
 */
export function AssignOrdersDialog({
  open,
  driver,
  readyOrders,
  onClose,
}: {
  open: boolean;
  driver: Driver | null;
  readyOrders: OrderListItem[];
  onClose: () => void;
}) {
  const t = useT("delivery");
  const common = useT("common");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign() {
    if (!driver || selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all(
        selected.map((orderId) => assignDriver(orderId, driver.id)),
      );
      notify.flashSuccess(common("feedback.assigned"));
      window.location.reload();
    } catch (cause) {
      const message = driverErrorMessage(cause, t);
      setError(message);
      notify.error(message);
      setLoading(false);
    }
  }
  if (!open || !driver) return null;
  return (
    <Dialog
      onClose={() => {
        if (!loading) {
          setSelected([]);
          onClose();
        }
      }}
      title={
        <span>
          {t("assign_dialog.title")} — {driverFullName(driver)}
        </span>
      }
      className="max-w-lg"
    >
      <p className="text-sm text-muted-foreground">
        {t("assign_dialog.select_orders")}
      </p>
      {error && (
        <p className="text-sm font-semibold text-destructive">{error}</p>
      )}
      {readyOrders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("assign_dialog.no_ready_orders")}
        </p>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {readyOrders.map((order) => (
            <label
              key={order.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
            >
              <input
                type="checkbox"
                checked={selected.includes(order.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.currentTarget.checked
                      ? [...current, order.id]
                      : current.filter((id) => id !== order.id),
                  )
                }
                disabled={loading}
                className="size-4 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {order.orderNumber}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {order.customerName} · {order.wilaya || "-"}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!loading) {
              setSelected([]);
              onClose();
            }
          }}
          disabled={loading}
        >
          {t("assign_dialog.cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => void handleAssign()}
          disabled={loading || selected.length === 0}
        >
          {t("assign_dialog.assign")} ({selected.length})
        </Button>
      </div>
    </Dialog>
  );
}

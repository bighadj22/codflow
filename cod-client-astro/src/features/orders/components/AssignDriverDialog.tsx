import { useState } from "react";
import { Check, Search } from "lucide-react";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { assignDriver } from "@/features/orders/api";
import type { Driver, OrderListItem } from "@/features/orders/types";
import { Button, Dialog, Input } from "@/components/ui";

export type OrderForActions = Pick<
  OrderListItem,
  | "id"
  | "orderNumber"
  | "wilaya"
  | "wilayaId"
  | "deliveryType"
  | "deliveryMethod"
  | "driverId"
  | "companyId"
  | "trackingNumber"
  | "status"
>;

export function AssignDriverDialog({
  order,
  drivers,
  onClose,
  onChanged,
  onError,
}: {
  order: OrderForActions;
  drivers: Driver[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const t = useT("orders");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(order.driverId ?? "");
  const [busy, setBusy] = useState(false);
  const filteredDrivers = drivers.filter((driver) =>
    `${driver.firstName} ${driver.lastName}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );

  async function submit() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await assignDriver(order.id, selectedId);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
      notify.error(t("detail.error_assign"));
      setBusy(false);
      return;
    }
    notify.success(t("assign_driver_dialog.success"));
    try {
      await onChanged();
      onClose();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={t("assign_driver_dialog.title")} onClose={onClose}>
      <p className="mb-4 text-xs font-medium text-muted-foreground">
        {order.orderNumber} · {order.wilaya ?? "-"}
      </p>
      <label className="relative block">
        <Search
          size={15}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("assign_driver_dialog.search_placeholder")}
          className="ps-9"
        />
      </label>
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {filteredDrivers.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("assign_driver_dialog.no_drivers")}
          </p>
        )}
        {filteredDrivers.map((driver) => {
          const selected = selectedId === driver.id;
          return (
            <button
              type="button"
              key={driver.id}
              onClick={() => setSelectedId(driver.id)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-start transition-colors ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
                {driver.firstName.charAt(0)}
                {driver.lastName.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {driver.firstName} {driver.lastName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(
                    `assign_driver_dialog.${driver.status === "available" ? "available" : "busy"}`,
                  )}
                </span>
              </span>
              {selected && <Check size={16} className="text-primary" />}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!selectedId || busy}
        onClick={() => void submit()}
      >
        {busy
          ? t("assign_driver_dialog.assigning")
          : t("assign_driver_dialog.assign")}
      </Button>
    </Dialog>
  );
}

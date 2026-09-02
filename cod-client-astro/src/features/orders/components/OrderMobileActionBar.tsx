import { ArrowLeft, Check, Download, Send } from "lucide-react";
import { canScope } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { statusActionLabel } from "@/features/orders/components/OrderShipmentActionsCard";
import type { OrderDetail, OrderStatus } from "@/features/orders/types";
import type { DetailStatusAction, shipmentCapabilities } from "@/features/orders/model";

interface OrderMobileActionBarProps {
  order: Pick<OrderDetail, "status" | "labelUrl">;
  effectiveStatus: OrderStatus;
  explicitStatusActions: DetailStatusAction[];
  caps: ReturnType<typeof shipmentCapabilities>;
  identity: Parameters<typeof canScope>[0];
  busy: boolean;
  onValidateShipment: () => void | Promise<void>;
  onChangeOrderStatus: (next: OrderStatus) => void | Promise<void>;
  onDownloadLabel: () => void | Promise<void>;
}

export function OrderMobileActionBar({
  order,
  effectiveStatus,
  explicitStatusActions,
  caps,
  identity,
  busy,
  onValidateShipment,
  onChangeOrderStatus,
  onDownloadLabel,
}: OrderMobileActionBarProps) {
  const t = useT("orders");

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur lg:hidden">
      <a
        href="/orders"
        aria-label={t("detail.back_to_orders")}
        className="grid size-11 shrink-0 place-items-center rounded-lg border border-input text-muted-foreground"
      >
        <ArrowLeft size={18} className="rtl:rotate-180" />
      </a>
      {caps.canValidate ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onValidateShipment()}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Check size={16} />
          {t("detail.validate_shipment_btn")}
        </button>
      ) : explicitStatusActions[0] && canScope(identity, "orders:update") ? (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onChangeOrderStatus(explicitStatusActions[0].status)
          }
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Send size={16} />
          {statusActionLabel(
            t,
            effectiveStatus,
            explicitStatusActions[0].status,
          )}
        </button>
      ) : (
        <span className="flex h-11 flex-1 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
          {t(`status.${effectiveStatus}`)}
        </span>
      )}
      {order.labelUrl && (
        <button
          type="button"
          onClick={() => void onDownloadLabel()}
          aria-label={t("detail.print_label")}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-input text-muted-foreground"
        >
          <Download size={18} />
        </button>
      )}
    </div>
  );
}

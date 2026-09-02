import { useEffect, useMemo, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useLocale, useT } from "@/i18n/react";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import {
  Alert,
  Button,
  PageHeader,
  useConfirmDialog,
} from "@/components/ui";
import { notify } from "@/lib/notify";
import {
  addShipmentRemark,
  assignDriver,
  cancelShipment,
  deleteOrder,
  dispatchOrder,
  downloadLabel,
  getOrder,
  getTracking,
  listDeliveryCompanies,
  listDrivers,
  updateOrderStatus,
  updateShipment,
  validateShipment,
} from "@/features/orders/api";
import {
  canAssignOrder,
  canDeleteOrderFromDetail,
  canDispatchOrder,
  detailStatusActions,
  dispatchFieldSupport,
  orderStatusFlow,
  shipmentCapabilities,
  shipmentUpdateFieldSupport,
} from "@/features/orders/model";
import type {
  DeliveryCompany,
  Driver,
  OrderDetail as OrderDetailType,
  OrderStatus,
} from "@/features/orders/types";
import { OrderCustomerCard } from "@/features/orders/components/OrderCustomerCard";
import { OrderProductsCard } from "@/features/orders/components/OrderProductsCard";
import { OrderDeliveryCard } from "@/features/orders/components/OrderDeliveryCard";
import { OrderStatusTimelineCard } from "@/features/orders/components/OrderStatusTimelineCard";
import { OrderShipmentActionsCard } from "@/features/orders/components/OrderShipmentActionsCard";
import { OrderMobileActionBar } from "@/features/orders/components/OrderMobileActionBar";

export function OrderDetail({ orderId }: { orderId: string }) {
  const t = useT("orders");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const confirm = useConfirmDialog();

  const [order, setOrder] = useState<OrderDetailType | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const mayReadDelivery = canScope(identity, "delivery:read");
      const [nextOrder, nextDrivers, nextCompanies] = await Promise.all([
        getOrder(orderId),
        mayReadDelivery ? listDrivers() : Promise.resolve([]),
        mayReadDelivery ? listDeliveryCompanies(true) : Promise.resolve([]),
      ]);
      setOrder(nextOrder);
      setStatus(nextOrder.status);
      setDrivers(nextDrivers);
      setCompanies(nextCompanies);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  useEffect(() => {
    void load();
  }, [orderId, identity?.role, identity?.scopes.join(",")]);

  const company = companies.find((item) => item.id === (order?.companyId ?? ""));
  const effectiveStatus = status ?? order?.status;
  const explicitStatusActions = effectiveStatus
    ? detailStatusActions(effectiveStatus, order ?? undefined)
    : [];
  const dispatched = !!order?.trackingNumber;
  const canAssign =
    !!order &&
    canScope(identity, "orders:assign") &&
    canAssignOrder(order) &&
    drivers.length > 0;
  const canDispatch =
    !!order &&
    canScope(identity, "delivery:dispatch") &&
    companies.length > 0 &&
    canDispatchOrder(order);
  const caps = shipmentCapabilities(
    company?.code ?? "",
    effectiveStatus ?? "new",
    dispatched,
  );
  const dispatchFields = dispatchFieldSupport(company?.code ?? "");
  const updateFields = shipmentUpdateFieldSupport(company?.code ?? "");
  const timeline = useMemo(() => order?.statusHistory ?? [], [order]);
  const statusFlow = useMemo(
    () => (order ? orderStatusFlow(order) : []),
    [order],
  );

  async function run(
    action: () => Promise<unknown>,
    successMessage: string | (() => string),
    errorMessage: string = common("feedback.action_failed"),
    after?: () => void,
  ) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      notify.error(errorMessage);
      setBusy(false);
      return;
    }
    notify.success(
      typeof successMessage === "function" ? successMessage() : successMessage,
    );
    try {
      after?.();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeOrder() {
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace(
          "{name}",
          order?.orderNumber ?? orderId,
        ),
        description: common("delete_description"),
        confirmLabel: t("actions.delete"),
        tone: "danger",
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteOrder(orderId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      notify.error(common("feedback.action_failed"));
      setBusy(false);
      return;
    }
    notify.flashSuccess(common("feedback.deleted"));
    window.location.assign("/orders");
  }

  async function confirmShipmentValidation() {
    if (
      await confirm({
        title: t("detail.validate_shipment_btn"),
        description: t("detail.validate_shipment_confirm"),
        confirmLabel: t("detail.validate_shipment_btn"),
      })
    ) {
      await run(
        () => validateShipment(orderId),
        t("detail.validate_shipment_success"),
        t("detail.validate_shipment_error"),
      );
    }
  }

  async function confirmShipmentCancellation() {
    if (
      await confirm({
        title: t("detail.cancel_shipment"),
        description: t("detail.cancel_shipment_confirm"),
        confirmLabel: t("detail.cancel_shipment"),
        tone: "danger",
      })
    ) {
      await run(
        () => cancelShipment(orderId),
        t("detail.cancel_shipment_success"),
        t("detail.cancel_shipment_error"),
      );
    }
  }

  async function changeOrderStatus(next: OrderStatus) {
    if (
      ["out_for_delivery", "delivered", "returned", "cancelled"].includes(next)
    ) {
      const accepted = await confirm({
        title: t("detail.status_change_confirm_title"),
        description: t("detail.status_change_confirm")
          .replace("{order}", order?.orderNumber ?? orderId)
          .replace("{status}", t(`status.${next}`)),
        confirmLabel: common("confirm"),
        tone:
          next === "cancelled" || next === "returned" ? "danger" : "default",
      });
      if (!accepted) return;
    }
    const statusMessage = t("detail.status_updated");
    const localizedStatusMessage = statusMessage.includes("{status}")
      ? statusMessage.replace("{status}", t(`status.${next}`))
      : `${statusMessage}${t(`status.${next}`)}`;
    await run(
      () => updateOrderStatus(orderId, next),
      localizedStatusMessage,
      t("detail.error_status"),
      () => setStatus(next),
    );
  }

  async function downloadOrderLabel() {
    try {
      await downloadLabel(orderId);
      notify.success(common("feedback.downloaded"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      notify.error(common("feedback.action_failed"));
    }
  }

  async function fetchTracking() {
    try {
      const events = await getTracking(orderId);
      notify.success(t("detail.tracking_refreshed"));
      return events;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      notify.error(common("feedback.action_failed"));
      throw cause;
    }
  }

  if (!canScope(identity, "orders:read")) {
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  }

  if (error && !order) {
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <span className="flex-1">{error}</span>
        <Button type="button" variant="ghost" onClick={() => void load()}>
          {common("retry")}
        </Button>
      </Alert>
    );
  }

  if (!order) {
    return (
      <div role="status" aria-busy="true" className="space-y-3">
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageHeader
        title={order.orderNumber}
        subtitle={
          order.orderType === "online" ? t("type.online") : t("type.offline")
        }
        backHref="/orders"
        backLabel={t("detail.back_to_orders")}
        actions={
          <div className="flex items-center gap-2">
            <OrderStatusBadge
              status={effectiveStatus ?? order.status}
              webhook={order.statusHistory[0]?.by?.startsWith("webhook:")}
            />
            {canScope(identity, "orders:delete") &&
              canDeleteOrderFromDetail(effectiveStatus ?? order.status) && (
                <Button
                  type="button"
                  variant="secondary"
                  className="size-9 min-h-9 px-0 text-destructive"
                  onClick={() => void removeOrder()}
                  disabled={busy}
                  aria-label={t("actions.delete")}
                >
                  <X size={16} />
                </Button>
              )}
          </div>
        }
      />
      {error && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <OrderCustomerCard order={order} />
          <OrderProductsCard order={order} locale={locale} />
          <OrderDeliveryCard order={order} company={company} />
        </div>

        <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
          <OrderStatusTimelineCard
            statusFlow={statusFlow}
            timeline={timeline}
            effectiveStatus={effectiveStatus ?? order.status}
            locale={locale}
          />
          <OrderShipmentActionsCard
            order={order}
            effectiveStatus={effectiveStatus ?? order.status}
            explicitStatusActions={explicitStatusActions}
            canAssign={canAssign}
            canDispatch={canDispatch}
            dispatched={dispatched}
            caps={caps}
            dispatchFields={dispatchFields}
            updateFields={updateFields}
            drivers={drivers}
            companies={companies}
            busy={busy}
            identity={identity}
            initialDriverId={order.driverId ?? ""}
            initialCompanyId={order.companyId ?? ""}
            onChangeOrderStatus={changeOrderStatus}
            onAssignDriver={(id) =>
              run(
                () => assignDriver(order.id, id),
                t("assign_driver_dialog.success"),
                t("detail.error_assign"),
              )
            }
            onDispatchOrder={(params) => {
              let trackingNumber = "";
              return run(
                async () => {
                  const response = await dispatchOrder(order.id, params);
                  trackingNumber = response.data.trackingNumber;
                },
                () => `${t("dispatch_dialog.success")}${trackingNumber}`,
                t("detail.dispatch_failed"),
              );
            }}
            onValidateShipment={confirmShipmentValidation}
            onDownloadLabel={downloadOrderLabel}
            onCancelShipment={confirmShipmentCancellation}
            onUpdateShipment={(params) =>
              run(
                () => updateShipment(order.id, params),
                t("detail.update_shipment_success"),
                t("detail.update_shipment_error"),
              )
            }
            onAddRemark={(txt) =>
              run(
                () => addShipmentRemark(order.id, txt),
                t("detail.remark_success"),
                t("detail.remark_error"),
              )
            }
            onFetchTracking={fetchTracking}
          />
        </div>
      </div>

      <OrderMobileActionBar
        order={order}
        effectiveStatus={effectiveStatus ?? order.status}
        explicitStatusActions={explicitStatusActions}
        caps={caps}
        identity={identity}
        busy={busy}
        onValidateShipment={confirmShipmentValidation}
        onChangeOrderStatus={changeOrderStatus}
        onDownloadLabel={downloadOrderLabel}
      />
    </div>
  );
}

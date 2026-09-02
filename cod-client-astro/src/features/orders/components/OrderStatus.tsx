import { useState } from "react";
import { Zap } from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { useConfirmDialog, Select } from "@/components/ui";
import { updateOrderStatus } from "@/features/orders/api";
import { orderStatusOptions } from "@/features/orders/model";
import type { OrderListItem } from "@/features/orders/types";

function statusClass(status: string): string {
  const classes: Record<string, string> = {
    new: "bg-[var(--status-new-bg)] text-[var(--status-new-text)] border-[var(--status-new-border)]",
    confirmed:
      "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)] border-[var(--status-confirmed-border)]",
    unreachable:
      "bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)] border-[var(--status-preparing-border)]",
    preparing:
      "bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)] border-[var(--status-preparing-border)]",
    ready:
      "bg-[var(--status-ready-bg)] text-[var(--status-ready-text)] border-[var(--status-ready-border)]",
    assigned:
      "bg-[var(--status-assigned-bg)] text-[var(--status-assigned-text)] border-[var(--status-assigned-border)]",
    dispatched:
      "bg-[var(--status-dispatched-bg)] text-[var(--status-dispatched-text)] border-[var(--status-dispatched-border)]",
    out_for_delivery:
      "bg-[var(--status-out-bg)] text-[var(--status-out-text)] border-[var(--status-out-border)]",
    delivered:
      "bg-[var(--status-delivered-bg)] text-[var(--status-delivered-text)] border-[var(--status-delivered-border)]",
    returned:
      "bg-[var(--status-returned-bg)] text-[var(--status-returned-text)] border-[var(--status-returned-border)]",
    cancelled:
      "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)] border-[var(--status-cancelled-border)]",
  };
  return classes[status] ?? classes.new;
}

/**
 * Order status cell. Renders a read-only badge when the caller cannot
 * update orders (or the status has no transitions); otherwise a dropdown
 * that confirms destructive transitions before applying them.
 */
export function OrderStatus({
  order,
  onChanged,
  onError,
}: {
  order: OrderListItem;
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const t = useT("orders");
  const identity = useIdentity();
  const common = useT("common");
  const confirm = useConfirmDialog();
  const [busy, setBusy] = useState(false);
  const statusOptions = orderStatusOptions(order.status);

  async function changeStatus(status: string) {
    if (status === order.status) return;
    if (
      ["out_for_delivery", "delivered", "returned", "cancelled"].includes(
        status,
      )
    ) {
      const accepted = await confirm({
        title: t("detail.status_change_confirm_title"),
        description: t("detail.status_change_confirm")
          .replace("{order}", order.orderNumber)
          .replace("{status}", t(`status.${status}`)),
        confirmLabel: common("confirm"),
        tone:
          status === "cancelled" || status === "returned"
            ? "danger"
            : "default",
      });
      if (!accepted) return;
    }
    setBusy(true);
    try {
      await updateOrderStatus(order.id, status);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
      notify.error(t("detail.error_status"));
      setBusy(false);
      return;
    }
    const statusMessage = t("detail.status_updated");
    notify.success(
      statusMessage.includes("{status}")
        ? statusMessage.replace("{status}", t(`status.${status}`))
        : `${statusMessage}${t(`status.${status}`)}`,
    );
    try {
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!canScope(identity, "orders:update") || statusOptions.length === 1) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 ${statusClass(order.status)}`}
      >
        {t(`status.${order.status}`)}
        {order.lastUpdatedBy?.startsWith("webhook:") && (
          <Zap size={11} className="ms-1 text-primary" />
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Select
        aria-label={t("table.status")}
        value={order.status}
        disabled={busy}
        onChange={(event) => void changeStatus(event.currentTarget.value)}
        variant="pill"
        wrapperClassName="inline-flex"
        triggerClassName={`max-w-40 ${statusClass(order.status)}`}
      >
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {t(`status.${status}`)}
          </option>
        ))}
      </Select>
      {order.lastUpdatedBy?.startsWith("webhook:") && (
        <Zap size={11} className="text-primary" />
      )}
    </span>
  );
}

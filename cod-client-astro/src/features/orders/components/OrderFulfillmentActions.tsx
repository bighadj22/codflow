import { useState } from "react";
import {
  Building2,
  Eye,
  MoreHorizontal,
  Trash2,
  Truck,
} from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { deleteOrder } from "@/features/orders/api";
import {
  canAssignOrder,
  canDispatchOrder,
} from "@/features/orders/model";
import type {
  DeliveryCompany,
  Driver,
} from "@/features/orders/types";
import {
  DropdownItem,
  DropdownLink,
  DropdownMenu,
  useConfirmDialog,
} from "@/components/ui";
import {
  AssignDriverDialog,
  type OrderForActions,
} from "@/features/orders/components/AssignDriverDialog";
import { DispatchCompanyDialog } from "@/features/orders/components/DispatchCompanyDialog";

export { AssignDriverDialog, DispatchCompanyDialog, type OrderForActions };

export function OrderRowActions({
  order,
  drivers,
  companies,
  onChanged,
  onError,
}: {
  order: OrderForActions;
  drivers: Driver[];
  companies: DeliveryCompany[];
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const t = useT("orders");
  const common = useT("common");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [assignOpen, setAssignOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const showAssign =
    canScope(identity, "orders:assign") && canAssignOrder(order);
  const showDispatch =
    canScope(identity, "delivery:dispatch") &&
    companies.length > 0 &&
    canDispatchOrder(order);
  const showDelete = canScope(identity, "orders:delete");

  async function remove() {
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace(
          "{name}",
          order.orderNumber,
        ),
        description: common("delete_description"),
        confirmLabel: t("actions.delete"),
        tone: "danger",
      }))
    )
      return;
    setDeleting(true);
    try {
      await deleteOrder(order.id);
      notify.success(common("feedback.deleted"));
      try {
        await onChanged();
      } catch (cause) {
        onError(cause instanceof Error ? cause.message : String(cause));
      }
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
      notify.error(common("feedback.action_failed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu
        trigger={<MoreHorizontal size={16} />}
        triggerLabel={`${common("table.actions")}: ${order.orderNumber}`}
      >
        <DropdownLink href={`/orders/${order.id}`}>
          <Eye size={14} />
          {t("actions.view")}
        </DropdownLink>
        {showAssign && (
          <DropdownItem onClick={() => setAssignOpen(true)}>
            <Truck size={14} />
            {t("actions.assign_driver")}
          </DropdownItem>
        )}
        {showDispatch && (
          <DropdownItem onClick={() => setDispatchOpen(true)}>
            <Building2 size={14} />
            {t("actions.dispatch_to_company")}
          </DropdownItem>
        )}
        {showDelete && (
          <DropdownItem
            disabled={deleting}
            onClick={() => void remove()}
            danger
          >
            <Trash2 size={14} />
            {deleting ? common("remove") : t("actions.delete")}
          </DropdownItem>
        )}
      </DropdownMenu>
      {assignOpen && (
        <AssignDriverDialog
          order={order}
          drivers={drivers}
          onClose={() => setAssignOpen(false)}
          onChanged={onChanged}
          onError={onError}
        />
      )}
      {dispatchOpen && (
        <DispatchCompanyDialog
          order={order}
          companies={companies}
          onClose={() => setDispatchOpen(false)}
          onChanged={onChanged}
          onError={onError}
        />
      )}
    </div>
  );
}

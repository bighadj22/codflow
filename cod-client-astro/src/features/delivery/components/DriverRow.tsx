import {
  DollarSign,
  Eye,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import {
  Badge,
  DropdownItem,
  DropdownMenu,
  TableCell,
  TableRow,
} from "@/components/ui";
import { useT } from "@/i18n/react";
import { driverFullName } from "@/features/delivery/model";
import type { Driver } from "@/features/delivery/types";

function DriverStatusBadge({ status }: { status: Driver["status"] }) {
  const t = useT("delivery");
  if (status === "available")
    return <Badge tone="success">{t("status.available")}</Badge>;
  if (status === "busy")
    return <Badge tone="warning">{t("status.busy")}</Badge>;
  return <Badge tone="neutral">{t("status.inactive")}</Badge>;
}

function DriverActionsMenu({
  driver,
  activeCount,
  canManage,
  onView,
  onAssign,
  onCompensations,
  onEdit,
  onDelete,
}: {
  driver: Driver;
  activeCount: number;
  canManage: boolean;
  onView: (driver: Driver) => void;
  onAssign: (driver: Driver) => void;
  onCompensations: (driver: Driver) => void;
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
}) {
  const t = useT("delivery");
  const common = useT("common");
  const hasOrders = activeCount > 0;
  return (
    <DropdownMenu
      trigger={<MoreHorizontal size={16} />}
      triggerLabel={common("table.actions")}
    >
      <DropdownItem onClick={() => onView(driver)}>
        <Eye size={15} />
        {t("actions.view")}
      </DropdownItem>
      {canManage && (
        <DropdownItem onClick={() => onAssign(driver)}>
          <Package size={15} />
          {t("actions.assign_orders")}
        </DropdownItem>
      )}
      <DropdownItem onClick={() => onCompensations(driver)}>
        <DollarSign size={15} />
        {t("actions.compensations")}
      </DropdownItem>
      {canManage && (
        <DropdownItem onClick={() => onEdit(driver)}>
          <Pencil size={15} />
          {t("actions.edit")}
        </DropdownItem>
      )}
      {canManage && (
        <DropdownItem
          onClick={() => onDelete(driver)}
          disabled={hasOrders}
          danger
        >
          <Trash2 size={15} />
          {t("actions.delete")}
        </DropdownItem>
      )}
    </DropdownMenu>
  );
}

export function DriverDesktopRow({
  driver,
  activeCount,
  canManage,
  onView,
  onAssign,
  onCompensations,
  onEdit,
  onDelete,
}: {
  driver: Driver;
  activeCount: number;
  canManage: boolean;
  onView: (driver: Driver) => void;
  onAssign: (driver: Driver) => void;
  onCompensations: (driver: Driver) => void;
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
}) {
  const t = useT("delivery");
  const hasOrders = activeCount > 0;
  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold text-foreground">
          {driverFullName(driver)}
        </div>
      </TableCell>
      <TableCell className="text-sm" dir="ltr">
        <Phone size={13} className="me-1 inline text-muted-foreground" />
        {driver.phone}
      </TableCell>
      <TableCell>
        <DriverStatusBadge status={driver.status} />
      </TableCell>
      <TableCell>
        {driver.compensationWilayaCount != null &&
        driver.compensationWilayaCount > 0 ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Package size={15} className="text-primary/40" />
            {driver.compensationWilayaCount} {t("table.wilaya")}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground/40">—</span>
        )}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${hasOrders ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          <Package size={12} />
          {activeCount}
        </span>
      </TableCell>
      <TableCell className="text-end">
        <DriverActionsMenu
          driver={driver}
          activeCount={activeCount}
          canManage={canManage}
          onView={onView}
          onAssign={onAssign}
          onCompensations={onCompensations}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

export function DriverMobileCard({
  driver,
  activeCount,
  canManage,
  onView,
  onAssign,
  onCompensations,
  onEdit,
  onDelete,
}: {
  driver: Driver;
  activeCount: number;
  canManage: boolean;
  onView: (driver: Driver) => void;
  onAssign: (driver: Driver) => void;
  onCompensations: (driver: Driver) => void;
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
}) {
  const t = useT("delivery");
  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <UserRound size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-foreground">
              {driverFullName(driver)}
            </p>
            <DriverActionsMenu
              driver={driver}
              activeCount={activeCount}
              canManage={canManage}
              onView={onView}
              onAssign={onAssign}
              onCompensations={onCompensations}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
            <Phone size={12} className="me-1 inline" />
            {driver.phone}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DriverStatusBadge status={driver.status} />
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <span className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
          <Truck size={15} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-muted-foreground">
              {t("table.vehicle")}
            </span>
            <span className="block truncate text-xs font-semibold">
              {driver.vehicleType
                ? t(`vehicle_type.${driver.vehicleType}`)
                : "—"}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
          <Package size={15} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-muted-foreground">
              {t("table.wilaya")}
            </span>
            <span className="block truncate text-xs font-semibold">
              {driver.compensationWilayaCount ?? 0}
            </span>
          </span>
        </span>
      </div>
      <div className="pt-3">
        <a
          href={`/delivery/drivers/${encodeURIComponent(driver.id)}`}
          className="block w-full rounded-xl border border-border bg-card py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-muted/50"
        >
          {t("actions.view")}
        </a>
      </div>
    </article>
  );
}

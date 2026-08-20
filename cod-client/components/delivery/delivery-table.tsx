"use client";

import { Edit, Trash2, Package, Truck, Phone, Eye, MoreHorizontal, ChevronRight, User, DollarSign } from "lucide-react";
import { DataTable, TableColumn, TableAction } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useDelivery } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Driver, Order } from "@/types";

interface Props {
  drivers: Driver[];
  driverOrdersMap: Record<string, Order[]>;
  loading?: boolean;
  onView?: (driver: Driver) => void;
  onEdit?: (driver: Driver) => void;
  onDelete?: (driver: Driver) => void;
  onAssignOrders?: (driver: Driver) => void;
  onCompensations?: (driver: Driver) => void;
}

export function DeliveryTable({
  drivers,
  driverOrdersMap,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onAssignOrders,
  onCompensations,
}: Props) {
  const t = useDelivery();
  const { dir } = useLanguage();
  const router = useRouter();

  const columns: TableColumn<Driver>[] = [
    {
      key: "firstName",
      label: t.table?.driver ?? "Driver",
      sortable: true,
      isTitle: true,
      render: (_, row) => {
        const fullName = `${row.firstName} ${row.lastName}`.trim();
        return (
          <div className="min-w-0">
            <div className="font-bold text-sm text-foreground tracking-tight">
              {fullName}
            </div>
          </div>
        );
      },
    },
    {
      key: "phone",
      label: t.table?.phone ?? "Phone",
      sortable: true,
      render: (value) => (
        <div
          className="text-xs font-bold text-muted-foreground/80 flex items-center gap-1.5"
          dir="ltr"
        >
          <Phone className="w-3 h-3" />
          {value as string}
        </div>
      ),
    },
    {
      key: "status",
      label: t.table?.status ?? "Status",
      sortable: true,
      isStatus: true,
      render: (value) => <StatusBadge status={value} className="py-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm" />,
    },
    {
      key: "compensationWilayaCount",
      label: t.table?.rate_card ?? "Rate Card",
      sortable: false,
      render: (value) => {
        const count = (value as number | undefined) ?? 0;
        return count > 0 ? (
          <div className="flex items-center gap-2 text-sm font-bold text-foreground/80">
            <Package className="w-4 h-4 text-primary/40 shrink-0" />
            <span className="truncate">{count} {(t.table as unknown as Record<string, string>)?.wilayas ?? "wilayas"}</span>
          </div>
        ) : (
          <span className="text-muted-foreground/40 font-mono text-xs">—</span>
        );
      },
      tabletHidden: true,
    },
  ];

  const actions: TableAction<Driver>[] = [
    ...(onView
      ? [
          {
            label: t.actions?.view ?? "View Profile",
            icon: <Eye className="w-4 h-4" />,
            onClick: onView,
          },
        ]
      : []),
    ...(onAssignOrders
      ? [
          {
            label: t.actions?.assign_orders ?? "Assign Orders",
            icon: <Package className="w-4 h-4" />,
            onClick: onAssignOrders,
          },
        ]
      : []),
    ...(onCompensations
      ? [
          {
            label: t.actions?.compensations ?? "Compensations",
            icon: <DollarSign className="w-4 h-4" />,
            onClick: onCompensations,
          },
        ]
      : []),
    ...(onEdit
      ? [
          {
            label: t.actions?.edit ?? "Edit",
            icon: <Edit className="w-4 h-4" />,
            onClick: onEdit,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: t.actions?.delete ?? "Delete",
            icon: <Trash2 className="w-4 h-4 text-rose-500" />,
            onClick: onDelete,
            variant: "destructive" as const,
            disabled: (driver: Driver) => (driverOrdersMap[driver.id]?.length ?? 0) > 0,
          },
        ]
      : []),
  ];

  const filters = [
    {
      key: "status",
      label: t.table?.status ?? "Status",
      options: [
        { label: t.status?.available ?? "Available", value: "available" },
        { label: t.status?.busy ?? "Busy", value: "busy" },
        { label: t.status?.inactive ?? "Inactive", value: "inactive" },
      ],
    },
  ];

  return (
    <DataTable
      data={drivers}
      columns={columns}
      actions={actions}
      loading={loading}
      searchPlaceholder={t.search_placeholder ?? "Search Drivers..."}
      filterable
      filters={filters}
      emptyState={
        <EmptyState
          icon={Truck}
          title={t.empty_state?.drivers_title ?? "No drivers yet"}
          description={t.empty_state?.drivers_description ?? "Add your first delivery driver to start managing local logistics."}
          actionLabel={t.empty_state?.drivers_action ?? "Add Driver"}
          onAction={() => router.push("/delivery/drivers/new")}
        />
      }
      renderMobileCard={(driver) => {
          const fullName = `${driver.firstName} ${driver.lastName}`.trim();
          return (
            <div className="flex flex-col gap-5 py-0.5">
              {/* Header: Avatar + Info + Status/Actions */}
              <div className="flex items-start gap-4">
                {/* Avatar with User icon */}
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 rounded-2xl bg-primary/10 text-primary border-none ring-1 ring-primary/15 shadow-sm">
                    <AvatarFallback className="bg-transparent">
                      <User className="w-4.5 h-4.5 opacity-40" />
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Identity info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-[16px] text-foreground tracking-tight leading-normal truncate pb-0.5">
                      {fullName}
                    </p>
                    <div className="shrink-0 -mt-1 -me-1 flex items-center gap-1.5">
                      {(onEdit || onDelete || onAssignOrders || onCompensations) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<button className="w-8 h-8 rounded-full bg-muted/30 hover:bg-primary/10 flex items-center justify-center text-muted-foreground/60 hover:text-primary transition-all active:scale-90" />}>
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={dir === "rtl" ? "start" : "end"} className="glass-card rounded-2xl">
                            {onAssignOrders && (
                              <DropdownMenuItem onClick={() => onAssignOrders(driver)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                                <Package className="w-3.5 h-3.5 me-2" />{t.actions?.assign_orders ?? "Assign"}
                              </DropdownMenuItem>
                            )}
                            {onCompensations && (
                              <DropdownMenuItem onClick={() => onCompensations(driver)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                                <DollarSign className="w-3.5 h-3.5 me-2" />{t.actions?.compensations ?? "Compensations"}
                              </DropdownMenuItem>
                            )}
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(driver)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                                <Edit className="w-3.5 h-3.5 me-2" />{t.actions?.edit ?? "Edit"}
                              </DropdownMenuItem>
                            )}
                            {onDelete && (
                              <DropdownMenuItem
                                onClick={() => onDelete(driver)}
                                disabled={(driverOrdersMap[driver.id]?.length ?? 0) > 0}
                                className="!text-rose-500 text-[11px] font-bold uppercase tracking-wider py-2.5"
                              >
                                <Trash2 className="w-3.5 h-3.5 me-2" />{t.actions?.delete ?? "Delete"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex items-center gap-2 text-muted-foreground/60">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="text-[13px] font-bold tabular-nums tracking-wide" dir="ltr">
                        {driver.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <StatusBadge status={driver.status} className="h-5 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest border-none shadow-none ring-1 ring-inset" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Grid: Modern app-like pills */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-muted/30 rounded-2xl p-3 flex items-center gap-3 border border-border/5 transition-colors group-hover:bg-muted/40">
                  <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-primary/40" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 leading-none mb-1">Vehicle</span>
                    <span className="text-[11px] font-black text-foreground truncate uppercase">
                      {t.vehicle_type?.[driver.vehicleType as "motorcycle" | "car" | "van"] ?? driver.vehicleType ?? "—"}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-2xl p-3 flex items-center gap-3 border border-border/5 transition-colors group-hover:bg-muted/40">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/5 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-emerald-500/40" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 leading-none mb-1">Wilayas</span>
                    <span className="text-[11px] font-black text-foreground truncate">
                      {driver.compensationWilayaCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* View Action */}
              <div className="pt-1">
                <Button 
                  onClick={() => onView?.(driver)} 
                  className="w-full h-11 rounded-2xl bg-white dark:bg-muted/30 border border-border/10 text-foreground font-black text-[11px] uppercase tracking-widest shadow-sm hover:bg-muted/50 active:scale-[0.98] transition-all"
                >
                  {t.actions?.view ?? "View Profile"}
                </Button>
              </div>
            </div>
          );
        }}
      />
    );
  }

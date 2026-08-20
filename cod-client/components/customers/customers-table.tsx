"use client";

import { Eye, Edit, Trash2, Phone, MapPin, Package, MoreHorizontal, User } from "lucide-react";
import { DataTable, TableColumn, TableAction } from "@/components/ui/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import type { Customer } from "@/types";

interface CustomersTableProps {
  customers: Customer[];
  loading?: boolean;
  onView?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onCreate?: () => void;
  isDeleting?: boolean;
}

export function CustomersTable({ 
  customers, 
  loading = false, 
  onView, 
  onEdit, 
  onDelete,
  onCreate,
  isDeleting = false,
}: CustomersTableProps) {
  const t = useCustomers();
  const { dir } = useLanguage();
  const router = useRouter();

  const columns: TableColumn<Customer>[] = [
    {
      key: "name",
      label: t.table.customer,
      sortable: true,
      isTitle: true,
      render: (value) => (
        <div className="font-black text-sm tracking-tight">
          {value}
        </div>
      ),
    },
    {
      key: "phone",
      label: t.table.phone,
      sortable: false,
      render: (value) => (
        <div className="flex items-center gap-2">
          <Phone className="w-3 h-3 text-primary/40 shrink-0" />
          <span className="text-[13px] font-bold text-muted-foreground/70 tabular-nums tracking-wide" dir="ltr">
            {value}
          </span>
        </div>
      ),
    },
    {
      key: "wilaya",
      label: t.table.wilaya,
      sortable: false,
      render: (value) => value ? (
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-primary/40 shrink-0" />
          <span className="text-[12px] font-bold text-muted-foreground/70 uppercase tracking-tight">
            {value}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground/30 text-[12px]">—</span>
      ),
      mobileHidden: true,
    },
    {
      key: "totalOrders",
      label: t.table.orders,
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-primary/5 flex items-center justify-center">
            <Package className="w-3 h-3 text-primary/60" />
          </div>
          <span className="text-sm font-black text-foreground">{value || 0}</span>
        </div>
      ),
    },
    {
      key: "totalSpent",
      label: t.table.total_spent,
      sortable: true,
      render: (value) => (
        <span className="text-sm font-black text-primary">
          {value ? `${value} دج` : "0 دج"}
        </span>
      ),
      mobileHidden: true,
      tabletHidden: true,
    },
  ];

  const actions: TableAction<Customer>[] = [
    ...(onView ? [{
      label: t.actions.view,
      icon: <Eye className="w-4 h-4" />,
      onClick: onView,
      variant: "ghost" as const,
    }] : []),
    ...(onEdit ? [{
      label: t.actions.edit,
      icon: <Edit className="w-4 h-4" />,
      onClick: onEdit,
      variant: "ghost" as const,
    }] : []),
    ...(onDelete ? [{
      label: t.actions.delete,
      icon: <Trash2 className="w-4 h-4" />,
      onClick: onDelete,
      variant: "ghost" as const,
      disabled: (customer: Customer) => (customer.totalOrders || 0) > 0,
    }] : []),
  ];

  const filters = [
    {
      key: "wilaya",
      label: t.filters.wilaya,
      options: [
        { label: "الجزائر", value: "الجزائر" },
        { label: "وهران", value: "وهران" },
        { label: "قسنطينة", value: "قسنطينة" },
        { label: "عنابة", value: "عنابة" },
        { label: "بليدة", value: "بليدة" },
        { label: "باتنة", value: "باتنة" },
        { label: "جيجل", value: "جيجل" },
        { label: "سطيف", value: "سطيف" },
        { label: "سيدي بلعباس", value: "سيدي بلعباس" },
        { label: "بسكرة", value: "بسكرة" },
      ],
    },
  ];

  return (
    <DataTable
      data={customers}
      columns={columns}
      actions={actions}
      loading={loading}
      searchPlaceholder={t.search_placeholder}
      filterable
      filters={filters}
      emptyState={
        <EmptyState
          icon={User}
          title={t.empty_state.title}
          description={t.empty_state.description}
          actionLabel={t.empty_state.action}
          onAction={onCreate || (() => router.push("/customers/new"))}
        />
      }
      renderMobileCard={(customer) => (
        <div className="flex flex-col gap-5 py-0.5">
          {/* Header: Avatar + Info + Actions */}
          <div className="flex items-start gap-4">
            {/* Avatar Initials */}
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
                  {customer.name}
                </p>
                {(onView || onEdit || onDelete) && (
                  <div className="shrink-0 -mt-1 -me-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger 
                        disabled={isDeleting}
                        render={<button className="w-8 h-8 rounded-full bg-muted/30 hover:bg-primary/10 flex items-center justify-center text-muted-foreground/60 hover:text-primary transition-all active:scale-90" />}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={dir === "rtl" ? "start" : "end"} className="glass-card rounded-2xl">
                        {onView && (
                          <DropdownMenuItem onClick={() => onView(customer)} disabled={isDeleting} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                            <Eye className="w-3.5 h-3.5 me-2" />{t.actions.view}
                          </DropdownMenuItem>
                        )}
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(customer)} disabled={isDeleting} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                            <Edit className="w-3.5 h-3.5 me-2" />{t.actions.edit}
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(customer)}
                            disabled={(customer.totalOrders || 0) > 0 || isDeleting}
                            className="!text-rose-500 text-[11px] font-bold uppercase tracking-wider py-2.5"
                          >
                            {isDeleting ? (
                              <div className="w-3.5 h-3.5 me-2 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 me-2" />
                            )}
                            {t.actions.delete}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center gap-2 text-muted-foreground/60">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="text-[13px] font-bold tabular-nums tracking-wide" dir="ltr">
                    {customer.phone}
                  </span>
                </div>
                {customer.wilaya && (
                  <div className="flex items-center gap-2 text-muted-foreground/50">
                    <MapPin className="w-3 h-3 shrink-0 text-primary/40" />
                    <span className="text-[11px] font-black uppercase tracking-tight" dir="rtl">
                      {customer.wilaya}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid: Modern app-like pills */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-muted/30 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 border border-border/5 transition-colors group-hover:bg-muted/40">
              <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-primary/40" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[14px] font-black text-foreground tabular-nums leading-none">{customer.totalOrders || 0}</span>
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 mt-1">{t.table.orders}</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 border border-border/5 transition-colors group-hover:bg-muted/40">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/5 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-emerald-500/40">دج</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[14px] font-black text-foreground tabular-nums leading-none truncate max-w-[80px]">
                  {customer.totalSpent || 0}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 mt-1">{t.table.total_spent}</span>
              </div>
            </div>
          </div>
        </div>
      ) as any}
    />
  );
}
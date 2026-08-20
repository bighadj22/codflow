"use client";

import { Eye, Edit, Trash2, Users, MoreHorizontal } from "lucide-react";
import { DataTable, TableColumn, TableAction } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCustomerGroups } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import type { CustomerGroup } from "@/types";

interface CustomerGroupsTableProps {
  groups: CustomerGroup[];
  loading?: boolean;
  onView?: (group: CustomerGroup) => void;
  onEdit?: (group: CustomerGroup) => void;
  onDelete?: (group: CustomerGroup) => void;
  onCreate?: () => void;
}

export function CustomerGroupsTable({
  groups,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onCreate,
}: CustomerGroupsTableProps) {
  const t = useCustomerGroups();
  const { dir } = useLanguage();
  const router = useRouter();

  const columns: TableColumn<CustomerGroup>[] = [
    {
      key: "name",
      label: t.table.name,
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl shrink-0"
            style={{ backgroundColor: row.color }}
          />
          <div>
            <div className="font-black text-sm tracking-tight">{value}</div>
            {row.description && (
              <div className="text-[10px] font-bold text-muted-foreground/60 truncate max-w-[200px]">
                {row.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "memberCount",
      label: t.table.members,
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-primary/5 flex items-center justify-center">
            <Users className="w-3 h-3 text-primary/60" />
          </div>
          <span className="text-sm font-black text-foreground">{value ?? 0}</span>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: t.table.created,
      sortable: true,
      render: (value) => (
        <span className="text-xs font-bold text-muted-foreground/80">{formatDate(value)}</span>
      ),
      mobileHidden: true,
    },
  ];

  const actions: TableAction<CustomerGroup>[] = [
    ...(onView
      ? [{ label: t.actions.view, icon: <Eye className="w-4 h-4" />, onClick: onView, variant: "ghost" as const }]
      : []),
    ...(onEdit
      ? [{ label: t.actions.edit, icon: <Edit className="w-4 h-4" />, onClick: onEdit, variant: "ghost" as const }]
      : []),
    ...(onDelete
      ? [{ label: t.actions.delete, icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: "ghost" as const }]
      : []),
  ];

  return (
    <DataTable
      data={groups}
      columns={columns}
      actions={actions}
      loading={loading}
      searchPlaceholder={t.search_placeholder}
      emptyState={
        <EmptyState
          icon={Users}
          title={t.empty_state.title}
          description={t.empty_state.description}
          actionLabel={t.empty_state.action}
          onAction={onCreate || (() => router.push("/customer-groups/new"))}
        />
      }
      renderMobileCard={(group) => (
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl shrink-0" style={{ backgroundColor: group.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-black text-[15px] text-foreground tracking-tight leading-tight">
                {group.name}
              </p>
              {group.description && (
                <p className="text-[11px] font-bold text-muted-foreground/60 mt-0.5 truncate">
                  {group.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <Users className="w-3 h-3 text-primary/40" />
                <span className="text-[11px] font-black text-muted-foreground/70">
                  {group.memberCount ?? 0}
                </span>
              </div>
            </div>
            {(onView || onEdit || onDelete) && (
              <div className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<button className="w-9 h-9 rounded-xl bg-muted/40 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90" />}>
                    <MoreHorizontal className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={dir === "rtl" ? "start" : "end"} className="glass-card rounded-2xl">
                    {onView && (
                      <DropdownMenuItem onClick={() => onView(group)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                        <Eye className="w-3.5 h-3.5 me-2" />{t.actions.view}
                      </DropdownMenuItem>
                    )}
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(group)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                        <Edit className="w-3.5 h-3.5 me-2" />{t.actions.edit}
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem onClick={() => onDelete(group)} className="!text-rose-500 text-[11px] font-bold uppercase tracking-wider py-2.5">
                        <Trash2 className="w-3.5 h-3.5 me-2" />{t.actions.delete}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )}
      />
    );
  }

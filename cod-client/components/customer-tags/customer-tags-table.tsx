"use client";

import { Eye, Edit, Trash2, Users, MoreHorizontal } from "lucide-react";
import { DataTable, TableColumn, TableAction } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCustomerTags } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import type { CustomerTag } from "@/types";

interface Props {
  tags: CustomerTag[];
  loading?: boolean;
  onView?: (tag: CustomerTag) => void;
  onEdit?: (tag: CustomerTag) => void;
  onDelete?: (tag: CustomerTag) => void;
  onCreate?: () => void;
}

export function CustomerTagsTable({ tags, loading = false, onView, onEdit, onDelete, onCreate }: Props) {
  const t = useCustomerTags();
  const { dir } = useLanguage();
  const router = useRouter();

  const columns: TableColumn<CustomerTag>[] = [
    {
      key: "name",
      label: t.table.name,
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2.5">
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-black text-white"
            style={{ backgroundColor: row.color }}
          >
            {value}
          </span>
        </div>
      ),
    },
    {
      key: "assignmentCount",
      label: t.table.customers,
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

  const actions: TableAction<CustomerTag>[] = [
    ...(onView ? [{ label: t.actions.view, icon: <Eye className="w-4 h-4" />, onClick: onView, variant: "ghost" as const }] : []),
    ...(onEdit ? [{ label: t.actions.edit, icon: <Edit className="w-4 h-4" />, onClick: onEdit, variant: "ghost" as const }] : []),
    ...(onDelete ? [{ label: t.actions.delete, icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: "ghost" as const }] : []),
  ];

  return (
    <DataTable
      data={tags}
      columns={columns}
      actions={actions}
      loading={loading}
      searchPlaceholder={t.search_placeholder}
      emptyState={
        <EmptyState
          icon={Tag}
          title={t.empty_state.title}
          description={t.empty_state.description}
          actionLabel={t.empty_state.action}
          onAction={onCreate || (() => router.push("/customer-tags"))}
        />
      }
      renderMobileCard={(tag) => (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="px-3 py-1.5 rounded-full text-[12px] font-black text-white shrink-0"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-primary/40" />
                <span className="text-[11px] font-black text-muted-foreground/70">{tag.assignmentCount ?? 0}</span>
              </div>
            </div>
            {(onView || onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<button className="w-9 h-9 rounded-xl bg-muted/40 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90" />}>
                  <MoreHorizontal className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={dir === "rtl" ? "start" : "end"} className="glass-card rounded-2xl">
                  {onView && <DropdownMenuItem onClick={() => onView(tag)} className="text-[11px] font-bold uppercase tracking-wider py-2.5"><Eye className="w-3.5 h-3.5 me-2" />{t.actions.view}</DropdownMenuItem>}
                  {onEdit && <DropdownMenuItem onClick={() => onEdit(tag)} className="text-[11px] font-bold uppercase tracking-wider py-2.5"><Edit className="w-3.5 h-3.5 me-2" />{t.actions.edit}</DropdownMenuItem>}
                  {onDelete && <DropdownMenuItem onClick={() => onDelete(tag)} className="!text-rose-500 text-[11px] font-bold uppercase tracking-wider py-2.5"><Trash2 className="w-3.5 h-3.5 me-2" />{t.actions.delete}</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      />
    );
  }

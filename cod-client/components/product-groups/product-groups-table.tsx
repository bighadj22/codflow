"use client";

import { Edit, Trash2, FolderOpen } from "lucide-react";
import { DataTable, type TableColumn, type TableAction } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProductGroups } from "@/lib/translations";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import type { ProductCategory } from "@/types";

interface Props {
  groups: ProductCategory[];
  loading?: boolean;
  onEdit?: (g: ProductCategory) => void;
  onDelete?: (g: ProductCategory) => void;
  onCreate?: () => void;
}

export function ProductGroupsTable({ groups, loading = false, onEdit, onDelete, onCreate }: Props) {
  const t = useProductGroups();
  const router = useRouter();
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));

  const columns: TableColumn<ProductCategory>[] = [
    {
      key: "name",
      label: t.table.name,
      sortable: true,
      isTitle: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0 border border-border/50 shadow-sm overflow-hidden">
            {row.imageUrl ? (
              <img src={row.imageUrl} alt={value} className="w-full h-full object-cover" />
            ) : (
              <FolderOpen className="w-4 h-4 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm tracking-tight truncate">{value}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 truncate font-mono">{row.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "parentId",
      label: t.table.parent,
      sortable: false,
      isSubtitle: true,
      render: (value) => value ? (
        <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest py-0 h-5">
          {groupMap[value]?.name ?? "—"}
        </Badge>
      ) : <span className="text-muted-foreground text-[10px]">—</span>,
    },
    {
      key: "productsCount",
      label: t.table.products,
      sortable: true,
      render: (value) => <span className="text-sm font-black text-foreground/80 tabular-nums">{value ?? 0}</span>,
    },
    {
      key: "createdAt",
      label: t.table.created_at,
      sortable: true,
      render: (value) => <span className="text-xs font-bold text-muted-foreground/80">{formatDate(value)}</span>,
      mobileHidden: true,
      tabletHidden: true,
    },
  ];

  const actions: TableAction<ProductCategory>[] = [
    ...(onEdit   ? [{ label: t.actions.edit,   icon: <Edit className="w-4 h-4" />,   onClick: onEdit,   variant: "ghost" as const }] : []),
    ...(onDelete ? [{ label: t.actions.delete, icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: "destructive" as const, disabled: (g: ProductCategory) => (g.productsCount ?? 0) > 0 }] : []),
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
          icon={FolderOpen}
          title={t.empty_state.title}
          description={t.empty_state.description}
          actionLabel={t.empty_state.action}
          onAction={onCreate || (() => router.push("/product-groups/new"))}
        />
      }
      renderMobileCard={(group) => (
          <div className="space-y-4 py-0.5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center shrink-0 border border-border/50 shadow-sm overflow-hidden">
                {group.imageUrl ? (
                  <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                ) : (
                  <FolderOpen className="w-5 h-5 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[15px] text-foreground tracking-tight truncate leading-tight">{group.name}</p>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest font-mono mt-1">{group.slug}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="bg-primary/5 border border-primary/10 rounded-lg px-2 py-1 flex flex-col items-center min-w-12">
                  <span className="text-[10px] font-black text-primary tabular-nums">{group.productsCount ?? 0}</span>
                  <span className="text-[8px] font-bold text-primary/60 uppercase tracking-tighter">Items</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/10">
              <div className="flex items-center gap-2">
                {group.parentId && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    <FolderOpen size={10} className="opacity-50" />
                    {groupMap[group.parentId]?.name}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => onEdit?.(group)} 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg border-border/40 bg-white/50 dark:bg-muted/20 text-[10px] font-black uppercase tracking-widest active:scale-95"
                >
                  <Edit size={12} className="me-1.5" />
                  {t.actions.edit}
                </Button>
                <Button 
                  onClick={() => onDelete?.(group)} 
                  disabled={(group.productsCount ?? 0) > 0}
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg border-rose-500/20 bg-rose-500/5 text-rose-500 text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-30"
                >
                  <Trash2 size={12} className="me-1.5" />
                  {t.actions.delete}
                </Button>
              </div>
            </div>
          </div>
        )}
      />
    );
  }

"use client";

import { Eye, Edit, Trash2, Package, MoreHorizontal, Star } from "lucide-react";
import { DataTable, type TableColumn, type TableAction } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProducts, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import type { Product, ProductCategory } from "@/types";

interface Props {
  products: Product[];
  groups: ProductCategory[];
  loading?: boolean;
  onView?: (p: Product) => void;
  onEdit?: (p: Product) => void;
  onDelete?: (p: Product) => void;
  onCreate?: () => void;
}

function StockBadge({ product }: { product: Product }) {
  const total = product.totalInventory ?? product.inventory ?? 0;
  if (!product.trackInventory) return <Badge variant="secondary">∞</Badge>;
  if (total === 0) return <StatusBadge status="out_of_stock" />;
  return <span className="text-sm font-medium text-foreground">{total}</span>;
}

function statusToVariant(status: string): string {
  if (status === "ACTIVE") return "available";
  if (status === "DRAFT") return "inactive";
  return "out_of_stock"; // ARCHIVED
}

export function ProductsTable({ products, groups, loading = false, onView, onEdit, onDelete, onCreate }: Props) {
  const t = useProducts();
  const common = useCommon();
  const { dir } = useLanguage();
  const router = useRouter();

  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));

  const columns: TableColumn<Product>[] = [
    {
      key: "name",
      label: t.table.name,
      sortable: true,
      isTitle: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-border/50 shadow-sm">
            {row.primaryImageSrc ? (
              <img src={row.primaryImageSrc} alt={value} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-4 h-4 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm tracking-tight truncate">{value}</p>
            {row.sku && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 truncate font-mono">{row.sku}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "categoryId",
      label: t.table.group,
      sortable: false,
      isSubtitle: true,
      render: (value) => value ? (
        <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest py-0 h-5">
          {groupMap[value]?.name ?? "—"}
        </Badge>
      ) : <span className="text-muted-foreground text-[10px]">—</span>,
    },
    {
      key: "status",
      label: t.table.status,
      sortable: true,
      isStatus: true,
      render: (value) => <StatusBadge status={statusToVariant(value)} />,
    },
    {
      key: "price",
      label: t.table.price,
      sortable: true,
      render: (value) => (
        <p className="font-black text-sm text-primary">{formatPrice(value, common.currency.symbol)}</p>
      ),
    },
    {
      key: "variantsCount",
      label: t.table.variants,
      sortable: true,
      render: (value) => (
        <span className="text-sm font-black text-foreground/80">{value ?? 0}</span>
      ),
      mobileHidden: true,
      tabletHidden: true,
    },
    {
      key: "totalInventory",
      label: t.table.stock,
      sortable: true,
      render: (_, row) => <StockBadge product={row} />,
    },
    {
      key: "reviewCount",
      label: t.table.reviews ?? "Reviews",
      sortable: true,
      render: (_, row) => {
        const count = row.reviewCount ?? 0;
        if (count === 0) return <span className="text-muted-foreground/25 text-sm select-none">—</span>;
        return (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            {row.avgRating != null && (
              <span className="text-sm font-black text-foreground/80 tabular-nums">{row.avgRating}</span>
            )}
            <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums">({count})</span>
          </div>
        );
      },
      mobileHidden: true,
      tabletHidden: true,
    },
  ];

  const actions: TableAction<Product>[] = [
    ...(onView  ? [{ label: t.actions.view,   icon: <Eye className="w-4 h-4" />,   onClick: onView,   variant: "ghost" as const }] : []),
    ...(onEdit  ? [{ label: t.actions.edit,   icon: <Edit className="w-4 h-4" />,  onClick: onEdit,   variant: "ghost" as const }] : []),
    ...(onDelete ? [{ label: t.actions.delete, icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: "ghost" as const }] : []),
  ];

  const filters = [
    {
      key: "categoryId",
      label: t.filters.group,
      options: groups.map((g) => ({ label: g.name, value: g.id })),
    },
    {
      key: "status",
      label: t.filters.availability,
      options: [
        { label: common.statuses.ACTIVE, value: "ACTIVE" },
        { label: common.statuses.DRAFT, value: "DRAFT" },
        { label: common.statuses.ARCHIVED, value: "ARCHIVED" },
      ],
    },
  ];

  return (
    <DataTable
      data={products}
      columns={columns}
      actions={actions}
      loading={loading}
      searchPlaceholder={t.search_placeholder}
      filterable
      filters={filters}
      emptyState={
        <EmptyState
          icon={Package}
          title={t.empty_state.title}
          description={t.empty_state.description}
          actionLabel={t.empty_state.action}
          onAction={onCreate || (() => router.push("/products/new"))}
        />
      }
      renderMobileCard={(product) => (
        <div className="space-y-4 py-0.5">
          {/* Top: image + name + sku + status + actions */}
          <div className="flex items-start gap-3.5">
            <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-border/50 shadow-sm">
              {product.primaryImageSrc ? (
                <img src={product.primaryImageSrc} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
              ) : (
                <Package className="w-6 h-6 text-muted-foreground/30" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[15px] text-foreground tracking-tight truncate leading-tight">
                {product.name}
              </p>
              {product.sku && (
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest font-mono mt-1">
                  {product.sku}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={statusToVariant(product.status)} className="py-0.5 px-2 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm" />
                {product.categoryId && groupMap[product.categoryId] && (
                  <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest py-0 h-4 bg-muted/50 text-muted-foreground/70 border-none">
                    {groupMap[product.categoryId].name}
                  </Badge>
                )}
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
                      <DropdownMenuItem onClick={() => onView(product)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                        <Eye className="w-3.5 h-3.5 me-2" />{t.actions.view}
                      </DropdownMenuItem>
                    )}
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(product)} className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                        <Edit className="w-3.5 h-3.5 me-2" />{t.actions.edit}
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem onClick={() => onDelete(product)} className="!text-rose-500 text-[11px] font-bold uppercase tracking-wider py-2.5">
                        <Trash2 className="w-3.5 h-3.5 me-2" />{t.actions.delete}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Bottom strip: price · stock · variants · reviews */}
          {(() => {
            const hasVariants = (product.variantsCount ?? 0) > 0;
            const hasReviews = (product.reviewCount ?? 0) > 0;
            const gridClass = hasVariants && hasReviews ? "grid-cols-4" : (hasVariants || hasReviews) ? "grid-cols-3" : "grid-cols-2";
            return (
              <div className={cn("grid gap-3 pt-3.5 border-t border-border/10", gridClass)}>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">
                    {t.table.price}
                  </p>
                  <p className="text-base font-black text-primary tabular-nums tracking-tight">
                    {formatPrice(product.price, common.currency.symbol)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">
                    {t.table.stock}
                  </p>
                  <div className="mt-0.5"><StockBadge product={product} /></div>
                </div>
                {(product.variantsCount ?? 0) > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">
                      {t.table.variants}
                    </p>
                    <p className="text-sm font-black text-foreground/80">{product.variantsCount}</p>
                  </div>
                )}
                {(product.reviewCount ?? 0) > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">
                      {t.table.reviews ?? "Reviews"}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      {product.avgRating != null && (
                        <span className="text-sm font-black text-foreground/80 tabular-nums">{product.avgRating}</span>
                      )}
                      <span className="text-[10px] font-bold text-muted-foreground/50">({product.reviewCount})</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    />
  );
}

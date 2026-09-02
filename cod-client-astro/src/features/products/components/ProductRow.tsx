import { Package, Pencil, Star, Trash2 } from "lucide-react";
import { Badge, IconButton, TableCell, TableRow } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import {
  formatMoneyValue,
  productStockTone,
} from "@/features/products/model";
import type { Product, ProductCategory } from "@/features/products/types";

function ProductStatusBadge({ product }: { product: Product }) {
  const t = useT("products");
  if (product.status === "ACTIVE")
    return <Badge tone="success">{t("status_options.active")}</Badge>;
  if (product.status === "DRAFT")
    return <Badge tone="neutral">{t("status_options.draft")}</Badge>;
  return <Badge tone="critical">{t("status_options.archived")}</Badge>;
}

function StockValue({ product }: { product: Product }) {
  const t = useT("products");
  const total = product.totalInventory ?? product.inventory ?? 0;
  const tone = productStockTone(product);
  if (tone === "none")
    return <span className="text-sm text-muted-foreground">∞</span>;
  if (tone === "out")
    return <Badge tone="critical">{t("status.out_of_stock")}</Badge>;
  return <span className="text-sm font-semibold tabular-nums">{total}</span>;
}

function ReviewValue({ product }: { product: Product }) {
  const count = product.reviewCount ?? 0;
  if (count === 0)
    return <span className="text-sm text-muted-foreground/30">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Star size={13} className="fill-amber-400 text-amber-400" />
      {product.avgRating != null && (
        <span className="text-sm font-semibold tabular-nums">
          {product.avgRating}
        </span>
      )}
      <span className="text-xs text-muted-foreground tabular-nums">
        ({count})
      </span>
    </span>
  );
}

interface RowProps {
  product: Product;
  categoryMap: Map<string, ProductCategory>;
  canManage: boolean;
  onDelete: (product: Product) => void;
}

export function ProductDesktopRow({ product, categoryMap, canManage, onDelete }: RowProps) {
  const t = useT("products");
  const locale = useLocale();
  const category = product.categoryId
    ? categoryMap.get(product.categoryId)
    : undefined;
  return (
    <TableRow>
      <TableCell>
        <a
          href={`/products/${encodeURIComponent(product.id)}`}
          className="inline-flex min-w-0 items-center gap-3 font-semibold text-link hover:underline"
        >
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
            {product.primaryImageSrc ? (
              <img
                src={product.primaryImageSrc}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <Package size={16} className="text-muted-foreground/50" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{product.name}</span>
            {product.sku && (
              <span className="block truncate font-mono text-[10px] uppercase text-muted-foreground/60">
                {product.sku}
              </span>
            )}
          </span>
        </a>
      </TableCell>
      <TableCell>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {category?.name ?? "—"}
        </span>
      </TableCell>
      <TableCell>
        <ProductStatusBadge product={product} />
      </TableCell>
      <TableCell className="text-sm font-semibold tabular-nums">
        {formatMoneyValue(product.price, locale)}
      </TableCell>
      <TableCell className="text-sm tabular-nums text-muted-foreground">
        {product.variantsCount ?? 0}
      </TableCell>
      <TableCell>
        <StockValue product={product} />
      </TableCell>
      <TableCell>
        <ReviewValue product={product} />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {canManage && (
            <a
              href={`/products/${encodeURIComponent(product.id)}/edit`}
              aria-label={t("actions.edit")}
              title={t("actions.edit")}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil size={15} />
            </a>
          )}
          {canManage && (
            <IconButton
              type="button"
              aria-label={t("actions.delete")}
              title={t("actions.delete")}
              variant="danger"
              onClick={() => onDelete(product)}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ProductMobileCard({ product, categoryMap, canManage, onDelete }: RowProps) {
  const t = useT("products");
  const category = product.categoryId
    ? categoryMap.get(product.categoryId)
    : undefined;
  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
          {product.primaryImageSrc ? (
            <img
              src={product.primaryImageSrc}
              alt={product.name}
              className="size-full object-cover"
            />
          ) : (
            <Package size={20} className="text-muted-foreground/30" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`/products/${encodeURIComponent(product.id)}`}
            className="block truncate font-semibold text-link"
          >
            {product.name}
          </a>
          {product.sku && (
            <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground/60">
              {product.sku}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProductStatusBadge product={product} />
            {category && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {category.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {canManage && (
            <a
              href={`/products/${encodeURIComponent(product.id)}/edit`}
              aria-label={t("actions.edit")}
              title={t("actions.edit")}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil size={15} />
            </a>
          )}
          {canManage && (
            <IconButton
              type="button"
              aria-label={t("actions.delete")}
              title={t("actions.delete")}
              variant="danger"
              onClick={() => onDelete(product)}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </div>
    </article>
  );
}

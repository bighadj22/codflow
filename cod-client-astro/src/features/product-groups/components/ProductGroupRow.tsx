import { FolderOpen, Pencil, Trash2 } from "lucide-react";
import { IconButton, TableCell, TableRow } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import {
  formatGroupDate,
  groupCanDelete,
} from "@/features/product-groups/model";
import type { ProductCategory } from "@/features/product-groups/types";

export function GroupDesktopRow({
  group,
  groupMap,
  canManage,
  onDelete,
}: {
  group: ProductCategory;
  groupMap: Map<string, ProductCategory>;
  canManage: boolean;
  onDelete: (group: ProductCategory) => void;
}) {
  const t = useT("product-groups");
  const locale = useLocale();
  const parent = group.parentId ? groupMap.get(group.parentId) : undefined;
  return (
    <TableRow>
      <TableCell>
        <a
          href={`/product-groups/${encodeURIComponent(group.id)}/edit`}
          className="inline-flex min-w-0 items-center gap-3 font-semibold text-link hover:underline"
        >
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
            {group.imageUrl ? (
              <img
                src={group.imageUrl}
                alt={group.name}
                className="size-full object-cover"
              />
            ) : (
              <FolderOpen size={16} className="text-muted-foreground/50" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{group.name}</span>
            {group.slug && (
              <span className="block truncate font-mono text-[10px] uppercase text-muted-foreground/60">
                {group.slug}
              </span>
            )}
          </span>
        </a>
      </TableCell>
      <TableCell>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {parent?.name ?? "—"}
        </span>
      </TableCell>
      <TableCell className="text-sm font-semibold tabular-nums">
        {group.productsCount ?? 0}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatGroupDate(group.createdAt, locale)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {canManage && (
            <a
              href={`/product-groups/${encodeURIComponent(group.id)}/edit`}
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
              disabled={!groupCanDelete(group)}
              onClick={() => onDelete(group)}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function GroupMobileCard({
  group,
  groupMap,
  canManage,
  onDelete,
}: {
  group: ProductCategory;
  groupMap: Map<string, ProductCategory>;
  canManage: boolean;
  onDelete: (group: ProductCategory) => void;
}) {
  const t = useT("product-groups");
  const parent = group.parentId ? groupMap.get(group.parentId) : undefined;
  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
          {group.imageUrl ? (
            <img
              src={group.imageUrl}
              alt={group.name}
              className="size-full object-cover"
            />
          ) : (
            <FolderOpen size={20} className="text-muted-foreground/30" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`/product-groups/${encodeURIComponent(group.id)}/edit`}
            className="block truncate font-semibold text-link"
          >
            {group.name}
          </a>
          {group.slug && (
            <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground/60">
              {group.slug}
            </p>
          )}
          {parent && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <FolderOpen size={10} className="opacity-50" />
              {parent.name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-lg border border-primary/10 bg-primary/5 px-2 py-1 text-sm font-bold tabular-nums text-primary">
            {group.productsCount ?? 0}
          </span>
          <div className="flex gap-1">
            {canManage && (
              <a
                href={`/product-groups/${encodeURIComponent(group.id)}/edit`}
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
                disabled={!groupCanDelete(group)}
                onClick={() => onDelete(group)}
              >
                <Trash2 size={15} />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

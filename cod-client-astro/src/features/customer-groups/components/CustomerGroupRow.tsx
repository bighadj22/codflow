import { Pencil, Trash2, Users } from "lucide-react";
import { IconButton, TableCell, TableRow } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import {
  formatGroupDate,
  groupCanDelete,
} from "@/features/customer-groups/model";
import type { CustomerGroup } from "@/features/customer-groups/types";

export function GroupDesktopRow({
  group,
  canManage,
  onDelete,
}: {
  group: CustomerGroup;
  canManage: boolean;
  onDelete: (group: CustomerGroup) => void;
}) {
  const t = useT("customer-groups");
  const locale = useLocale();
  return (
    <TableRow>
      <TableCell>
        <a
          href={`/customer-groups/${encodeURIComponent(group.id)}`}
          className="inline-flex min-w-0 items-center gap-3 font-semibold text-link hover:underline"
        >
          <span
            className="size-8 shrink-0 rounded-lg"
            style={{ backgroundColor: group.color }}
          />
          <span className="truncate">{group.name}</span>
        </a>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {group.description || "-"}
      </TableCell>
      <TableCell>
        <div className="inline-flex items-center gap-1.5 text-sm">
          <Users size={14} className="text-muted-foreground" />
          <span className="font-semibold tabular-nums">
            {group.memberCount}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatGroupDate(group.createdAt, locale)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {canManage && (
            <a
              href={`/customer-groups/${encodeURIComponent(group.id)}/edit`}
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
  canManage,
  onDelete,
}: {
  group: CustomerGroup;
  canManage: boolean;
  onDelete: (group: CustomerGroup) => void;
}) {
  const t = useT("customer-groups");
  const locale = useLocale();
  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 size-10 shrink-0 rounded-lg"
          style={{ backgroundColor: group.color }}
        />
        <div className="min-w-0 flex-1">
          <a
            href={`/customer-groups/${encodeURIComponent(group.id)}`}
            className="block truncate font-semibold text-link"
          >
            {group.name}
          </a>
          {group.description && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {group.description}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {canManage && (
            <a
              href={`/customer-groups/${encodeURIComponent(group.id)}/edit`}
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
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Users size={13} />
          <strong className="ms-1 text-foreground">{group.memberCount}</strong>
          {t("table.members")}
        </span>
        <span className="text-end text-muted-foreground">
          {formatGroupDate(group.createdAt, locale)}
        </span>
      </div>
    </article>
  );
}

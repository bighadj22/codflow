import { MapPin, Pencil, Trash2, UserRound } from "lucide-react";
import { IconButton, TableCell, TableRow } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { customerCanDelete } from "@/features/customers/model";
import { formatMoney } from "@/features/orders/model";
import type { Customer } from "@/features/customers/types";

export function CustomerDesktopRow({
  customer,
  canEdit,
  canDelete,
  onDelete,
}: {
  customer: Customer;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (customer: Customer) => void;
}) {
  const t = useT("customers");
  const locale = useLocale();
  return (
    <TableRow>
      <TableCell>
        <a
          href={`/customers/${encodeURIComponent(customer.id)}`}
          className="inline-flex min-w-0 items-center gap-2 font-semibold text-link hover:underline"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <UserRound size={15} />
          </span>
          <span className="truncate">{customer.name}</span>
        </a>
      </TableCell>
      <TableCell className="text-sm" dir="ltr">
        {customer.phone}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {customer.wilaya || "-"}
      </TableCell>
      <TableCell className="text-end text-sm tabular-nums">
        {customer.totalOrders}
      </TableCell>
      <TableCell className="text-end text-sm font-semibold tabular-nums">
        {formatMoney(customer.totalSpent, locale)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {canEdit && (
            <a
              href={`/customers/${encodeURIComponent(customer.id)}/edit`}
              aria-label={t("actions.edit")}
              title={t("actions.edit")}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil size={15} />
            </a>
          )}
          {canDelete && (
            <IconButton
              type="button"
              aria-label={t("actions.delete")}
              title={t("actions.delete")}
              variant="danger"
              disabled={!customerCanDelete(customer)}
              onClick={() => onDelete(customer)}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CustomerMobileCard({
  customer,
  canEdit,
  canDelete,
  onDelete,
}: {
  customer: Customer;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (customer: Customer) => void;
}) {
  const t = useT("customers");
  const locale = useLocale();
  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <UserRound size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`/customers/${encodeURIComponent(customer.id)}`}
            className="block truncate font-semibold text-link"
          >
            {customer.name}
          </a>
          <a
            href={`tel:${customer.phone}`}
            dir="ltr"
            className="mt-1 block text-sm text-muted-foreground"
          >
            {customer.phone}
          </a>
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={13} />
            {customer.wilaya || "-"}
          </span>
        </div>
        <div className="flex gap-1">
          {canEdit && (
            <a
              href={`/customers/${encodeURIComponent(customer.id)}/edit`}
              aria-label={t("actions.edit")}
              title={t("actions.edit")}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil size={15} />
            </a>
          )}
          {canDelete && (
            <IconButton
              type="button"
              aria-label={t("actions.delete")}
              title={t("actions.delete")}
              variant="danger"
              disabled={!customerCanDelete(customer)}
              onClick={() => onDelete(customer)}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">
          {t("table.orders")}{" "}
          <strong className="ms-1 text-foreground">
            {customer.totalOrders}
          </strong>
        </span>
        <span className="text-end text-muted-foreground">
          {t("table.total_spent")}{" "}
          <strong className="ms-1 text-foreground">
            {formatMoney(customer.totalSpent, locale)}
          </strong>
        </span>
      </div>
    </article>
  );
}

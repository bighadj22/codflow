import { Phone, UserMinus } from "lucide-react";
import { IconButton } from "@/components/ui";
import { formatMoney } from "@/features/orders/model";
import { useLocale, useT } from "@/i18n/react";
import type { CustomerTagAssigned } from "@/features/customer-tags/types";

export function CustomerTagAssignedRow({
  customer,
  canManage,
  busy,
  onRemove,
}: {
  customer: CustomerTagAssigned;
  canManage: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const t = useT("customer-tags");
  const locale = useLocale();
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
          {customer.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <a
            href={`/customers/${encodeURIComponent(customer.id)}`}
            className="block truncate text-sm font-semibold text-link hover:underline"
          >
            {customer.name}
          </a>
          <p className="text-xs text-muted-foreground" dir="ltr">
            <Phone size={11} className="me-1 inline" />
            {customer.phone}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-end sm:block">
          <p className="text-sm font-bold tabular-nums">
            {formatMoney(customer.totalSpent, locale)}
          </p>
          <p className="text-xs text-muted-foreground">
            {customer.totalOrders} {t("detail.orders_label")}
          </p>
        </div>
        {canManage && (
          <IconButton
            type="button"
            variant="danger"
            aria-label={t("detail.remove_customer")}
            title={t("detail.remove_customer")}
            disabled={busy}
            onClick={onRemove}
          >
            <UserMinus size={15} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

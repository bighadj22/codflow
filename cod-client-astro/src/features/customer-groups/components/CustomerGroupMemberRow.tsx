import { Phone, UserMinus } from "lucide-react";
import { IconButton } from "@/components/ui";
import { formatMoney } from "@/features/orders/model";
import { useLocale, useT } from "@/i18n/react";
import type { CustomerGroupMember } from "@/features/customer-groups/types";

export function CustomerGroupMemberRow({
  member,
  canManage,
  busy,
  onRemove,
}: {
  member: CustomerGroupMember;
  canManage: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const t = useT("customer-groups");
  const locale = useLocale();
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
          {member.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <a
            href={`/customers/${encodeURIComponent(member.id)}`}
            className="block truncate text-sm font-semibold text-link hover:underline"
          >
            {member.name}
          </a>
          <p className="text-xs text-muted-foreground" dir="ltr">
            <Phone size={11} className="me-1 inline" />
            {member.phone}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-end sm:block">
          <p className="text-sm font-bold tabular-nums">
            {formatMoney(member.totalSpent, locale)}
          </p>
          <p className="text-xs text-muted-foreground">
            {member.totalOrders} {t("detail.orders_label")}
          </p>
        </div>
        {canManage && (
          <IconButton
            type="button"
            variant="danger"
            aria-label={t("detail.remove_member")}
            title={t("detail.remove_member")}
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

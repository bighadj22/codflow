import { Gift, Truck } from "lucide-react";
import { Badge } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { OfferDiscountType, OfferStatus } from "@/features/offers/types";

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const t = useT("offers");
  return status === "active" ? (
    <Badge tone="success">{t("status.active")}</Badge>
  ) : (
    <Badge tone="neutral">{t("status.inactive")}</Badge>
  );
}

export function DiscountTypeBadge({ type }: { type: OfferDiscountType }) {
  const t = useT("offers");
  const Icon = type === "free_shipping" ? Truck : Gift;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${
        type === "free_shipping"
          ? "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <Icon size={12} aria-hidden="true" />
      {t(`discount_type.${type}`)}
    </span>
  );
}

import {
  CalendarDays,
  Gift,
  Package,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { IconButton } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { offerRuleLabel, offerScheduleLabel } from "@/features/offers/model";
import {
  DiscountTypeBadge,
  OfferStatusBadge,
} from "@/features/offers/components/OfferBadges";
import type { Offer } from "@/features/offers/types";

interface OfferMobileCardProps {
  offer: Offer;
  canManage: boolean;
  onToggle: (offer: Offer) => void;
  onDelete: (offer: Offer) => void;
}

export function OfferMobileCard({
  offer,
  canManage,
  onToggle,
  onDelete,
}: OfferMobileCardProps) {
  const t = useT("offers");
  const locale = useLocale();

  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-center gap-2">
        <OfferStatusBadge status={offer.status} />
        <div className="flex-1" />
        <div className="flex gap-1">
          {canManage && (
            <IconButton
              type="button"
              aria-label={
                offer.status === "active"
                  ? t("actions.deactivate")
                  : t("actions.activate")
              }
              title={
                offer.status === "active"
                  ? t("actions.deactivate")
                  : t("actions.activate")
              }
              onClick={() => onToggle(offer)}
            >
              {offer.status === "active" ? (
                <ToggleLeft size={15} />
              ) : (
                <ToggleRight size={15} />
              )}
            </IconButton>
          )}
          {canManage && (
            <IconButton
              type="button"
              aria-label={t("actions.delete")}
              title={t("actions.delete")}
              variant="danger"
              onClick={() => onDelete(offer)}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </div>
      <a
        href={`/offers/${encodeURIComponent(offer.id)}`}
        className="mt-2 block truncate text-[15px] font-bold text-foreground hover:text-link"
      >
        {offer.name}
      </a>
      <p className="mt-0.5 text-[13px] font-semibold text-muted-foreground">
        {offerRuleLabel(offer, t)}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-2 border-b border-border pb-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {offer.triggerProduct?.name ?? "—"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {offer.triggerVariant?.label ?? t("any_variant")}
          </p>
        </div>
        <Package size={16} className="shrink-0 text-primary/40" />
      </div>
      <div className="mt-2.5">
        {offer.discountType === "free_shipping" ? (
          <DiscountTypeBadge type="free_shipping" />
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <Gift size={12} className="shrink-0 text-violet-500/40" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                {offer.rewardProduct?.name ?? "—"}
              </p>
              {offer.rewardVariant && (
                <p className="truncate text-[10px] text-muted-foreground/50">
                  {offer.rewardVariant.label}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {(offer.startsAt || offer.endsAt) && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-2.5 py-2">
          <CalendarDays
            size={11}
            className="shrink-0 text-muted-foreground/60"
          />
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            {t("table.schedule")}
          </span>
          <span className="min-w-0 flex-1 truncate text-end text-[11px] font-bold text-muted-foreground/70">
            {offerScheduleLabel(offer, locale)}
          </span>
        </div>
      )}
    </article>
  );
}

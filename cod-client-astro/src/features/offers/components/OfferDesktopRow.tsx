import {
  CalendarDays,
  Gift,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { IconButton, TableCell, TableRow } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { offerRuleLabel, offerScheduleLabel } from "@/features/offers/model";
import {
  DiscountTypeBadge,
  OfferStatusBadge,
} from "@/features/offers/components/OfferBadges";
import type { Offer } from "@/features/offers/types";

interface OfferDesktopRowProps {
  offer: Offer;
  canManage: boolean;
  onToggle: (offer: Offer) => void;
  onDelete: (offer: Offer) => void;
}

export function OfferDesktopRow({
  offer,
  canManage,
  onToggle,
  onDelete,
}: OfferDesktopRowProps) {
  const t = useT("offers");
  const locale = useLocale();

  return (
    <TableRow>
      <TableCell>
        <div className="inline-flex min-w-0 items-center gap-2 font-semibold text-link">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Gift size={15} />
          </span>
          <span className="truncate">{offer.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {offer.triggerProduct?.name ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {offer.triggerVariant?.label ?? t("any_variant")} ·{" "}
            {offerRuleLabel(offer, t)}
          </p>
        </div>
      </TableCell>
      <TableCell>
        {offer.discountType === "free_shipping" ? (
          <DiscountTypeBadge type="free_shipping" />
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {offer.rewardProduct?.name ?? "—"}
            </p>
            {offer.rewardVariant && (
              <p className="text-xs text-muted-foreground">
                {offer.rewardVariant.label}
              </p>
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays size={13} />
          {offerScheduleLabel(offer, locale)}
        </span>
      </TableCell>
      <TableCell>
        <OfferStatusBadge status={offer.status} />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <a
            href={`/offers/${encodeURIComponent(offer.id)}`}
            aria-label={t("actions.edit")}
            title={t("actions.edit")}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil size={15} />
          </a>
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
      </TableCell>
    </TableRow>
  );
}

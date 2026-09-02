import { MapPin, Package, Package2, Star, Trash2 } from "lucide-react";
import { Badge, Button, LinkButton } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { ShippingProfile } from "@/features/delivery/types";

export function ShippingProfileCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
        <span className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <span className="mt-4 block h-5 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <span className="h-14 animate-pulse rounded-xl bg-muted" />
        <span className="h-14 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="mt-4 flex gap-2">
        <span className="h-10 flex-1 animate-pulse rounded-lg bg-muted" />
        <span className="h-10 flex-1 animate-pulse rounded-lg bg-muted" />
        <span className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export function ShippingProfileCard({
  profile,
  canManage,
  onDelete,
}: {
  profile: ShippingProfile;
  canManage: boolean;
  onDelete: (profile: ShippingProfile) => void;
}) {
  const t = useT("settings");
  return (
    <article
      className={`flex flex-col rounded-xl border bg-card p-5 transition-colors ${
        profile.isDefault ? "border-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-xl ${
            profile.isDefault
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Package size={20} aria-hidden="true" />
        </span>
        {profile.isDefault ? (
          <Badge tone="success">
            <Star size={11} fill="currentColor" aria-hidden="true" />
            <span className="ms-1">{t("shipping.default_badge")}</span>
          </Badge>
        ) : (
          <span className="size-5" aria-hidden="true" />
        )}
      </div>
      <h2 className="mt-4 truncate text-base font-bold text-foreground">
        {profile.name}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <span className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2 py-2.5 text-center">
          <MapPin size={12} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-bold tabular-nums text-foreground">
              {profile.ruleCount}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("shipping.card_wilayas")}
            </span>
          </span>
        </span>
        <span className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2 py-2.5 text-center">
          <Package2 size={12} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-bold tabular-nums text-foreground">
              {profile.productCount ?? 0}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("shipping.card_products")}
            </span>
          </span>
        </span>
      </div>
      <div className="mt-4 flex flex-1 items-end gap-2">
        <LinkButton
          variant="secondary"
          href={`/delivery/shipping-profiles/${encodeURIComponent(profile.id)}`}
          className="flex-1"
        >
          {t("shipping.view_action")}
        </LinkButton>
        <LinkButton
          href={`/delivery/shipping-profiles/${encodeURIComponent(profile.id)}/edit`}
          className="flex-1"
        >
          {t("shipping.edit_action")}
        </LinkButton>
        {canManage && (
          <Button
            type="button"
            variant="dangerOutline"
            size="icon"
            aria-label={t("shipping.delete_action")}
            title={t("shipping.delete_action")}
            onClick={() => onDelete(profile)}
          >
            <Trash2 size={15} />
          </Button>
        )}
      </div>
    </article>
  );
}

import React from "react";
import {
  Boxes,
  Crown,
  Package,
  ShoppingBag,
  Star,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { useT } from "@/i18n/react";
import type { ActivityLogMeta, TeamMember } from "@/features/team/types";

export const ENTITY_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  order: { icon: <Package size={14} />, color: "text-blue-600", bgColor: "bg-blue-500/10 border-blue-500/20" },
  customer: { icon: <Users size={14} />, color: "text-purple-600", bgColor: "bg-purple-500/10 border-purple-500/20" },
  driver: { icon: <Truck size={14} />, color: "text-teal-600", bgColor: "bg-teal-500/10 border-teal-500/20" },
  product: { icon: <ShoppingBag size={14} />, color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/20" },
  stock: { icon: <Boxes size={14} />, color: "text-cyan-600", bgColor: "bg-cyan-500/10 border-cyan-500/20" },
  user: { icon: <UserCog size={14} />, color: "text-rose-600", bgColor: "bg-rose-500/10 border-rose-500/20" },
  review: { icon: <Star size={14} />, color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/20" },
};

export function entityConfig(entityType: string) {
  return ENTITY_CONFIG[entityType] ?? ENTITY_CONFIG.order;
}

export function StatusBadge({ status }: { status: TeamMember["status"] }) {
  const t = useT("team");
  return status === "active" ? (
    <Badge tone="success">{t("status.active")}</Badge>
  ) : (
    <Badge tone="neutral">{t("status.inactive")}</Badge>
  );
}

export function RoleBadge({ role }: { role: TeamMember["role"] }) {
  const common = useT("common");
  return role === "admin" ? (
    <Badge tone="warning">
      <Crown size={11} fill="currentColor" aria-hidden="true" />
      <span className="ms-1">{common("roles.admin")}</span>
    </Badge>
  ) : (
    <Badge tone="neutral">{common("roles.staff")}</Badge>
  );
}

export function MetadataHint({
  action,
  meta,
  locale,
}: {
  action: string;
  meta: ActivityLogMeta | null;
  locale: "ar" | "en" | "fr";
}) {
  const common = useT("common");
  if (!meta) return null;

  if (
    (action === "order.status_changed" ||
      action === "driver.status_changed" ||
      action === "product.status_changed") &&
    meta.status
  ) {
    const label = common(`statuses.${String(meta.status)}`);
    return (
      <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
        {label.startsWith("common.statuses.") ? String(meta.status) : label}
      </span>
    );
  }
  if (action === "stock.adjusted" && meta.delta !== undefined) {
    const delta = Number(meta.delta);
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`text-[10px] font-bold tabular-nums ${delta >= 0 ? "text-violet-600" : "text-rose-500"}`}>
          {delta >= 0 ? "+" : ""}
          {new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "en-DZ").format(delta)}
        </span>
        {meta.stockType != null && (
          <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {String(meta.stockType)}
          </span>
        )}
        {meta.reason != null && (
          <span className="text-[10px] font-medium text-muted-foreground/60">
            · {String(meta.reason)}
          </span>
        )}
      </span>
    );
  }
  if (
    (action === "user.scope_granted" || action === "user.scope_revoked") &&
    meta.scope
  ) {
    return (
      <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {String(meta.scope)}
      </span>
    );
  }
  if (action === "user.role_changed" && meta.role) {
    const label = common(`roles.${String(meta.role)}`);
    return (
      <span className="rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700">
        {label.startsWith("common.roles.") ? String(meta.role) : label}
      </span>
    );
  }
  if (
    (action === "review.approved" ||
      action === "review.rejected" ||
      action === "review.deleted") &&
    meta.rating
  ) {
    const rating = Number(meta.rating);
    return (
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((step) => (
          <Star
            key={step}
            size={10}
            className={step <= rating ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/30"}
          />
        ))}
      </span>
    );
  }
  return <span className="select-none text-sm text-muted-foreground/20">—</span>;
}

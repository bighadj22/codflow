"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Gift, Pencil, Trash2, ToggleLeft, ToggleRight, 
  Package, CalendarDays, MoreHorizontal, Zap 
} from "lucide-react";
import { DataTable, TableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useOffers, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { deleteOffer, updateOffer } from "@/actions/offers";
import { useConfirm } from "@/components/ui/use-confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Offer } from "@/actions/offers";
import { SCOPES } from "@/../cod-shared/rbac/scopes";

// ── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  const t = useOffers();
  return (
    <Badge
      className={cn(
        "text-[0.7rem] font-bold px-2 py-0.5 rounded-full",
        status === "active"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-slate-100 text-slate-500 border border-slate-200"
      )}
    >
      {t.status[status]}
    </Badge>
  );
}

// ── Discount Type Badge ────────────────────────────────────────────────────

function DiscountTypeBadge({ type }: { type: "free" | "free_shipping" }) {
  const t = useOffers();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full border",
        type === "free_shipping"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-primary/5 text-primary border-primary/20"
      )}
    >
      {type === "free_shipping" ? "🚚" : "🎁"}
      {(t.discount_type as Record<string, string>)[type]}
    </span>
  );
}

// ── Schedule Label ─────────────────────────────────────────────────────────

function ScheduleLabel({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  if (!startsAt && !endsAt) return <span className="text-muted-foreground text-xs">—</span>;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (startsAt && endsAt) return <span className="text-xs text-muted-foreground">{fmt(startsAt)} → {fmt(endsAt)}</span>;
  if (startsAt) return <span className="text-xs text-muted-foreground">من {fmt(startsAt)}</span>;
  return <span className="text-xs text-muted-foreground">حتى {fmt(endsAt!)}</span>;
}

// ── Row Actions ────────────────────────────────────────────────────────────

function OfferRowActions({
  offer,
  userScopes,
  onRefresh,
}: {
  offer: Offer;
  userScopes: string[];
  onRefresh: () => void;
}) {
  const t = useOffers();
  const common = useCommon();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const hasScope = (scope: string) => userScopes.includes(scope) || userScopes.includes(SCOPES.ALL);

  async function handleToggleStatus() {
    const newStatus = offer.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        await updateOffer(offer.id, { status: newStatus });
        toast.success(t.form.success_edit);
        onRefresh();
      } catch {
        toast.error(t.form.error_save);
      }
    });
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: t.form.delete_confirm,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteOffer(offer.id);
        toast.success(t.form.success_edit);
        onRefresh();
      } catch {
        toast.error(t.form.error_save);
      }
    });
  }

  return (
    <>
      {ConfirmDialog}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" />}>
          <MoreHorizontal size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => router.push(`/offers/${offer.id}`)}>
            <Pencil size={13} className="me-2" />
            {t.actions?.edit ?? "Edit"}
          </DropdownMenuItem>
          {hasScope(SCOPES.OFFERS_MANAGE) && (
            <>
              <DropdownMenuItem onClick={handleToggleStatus} disabled={isPending}>
                {offer.status === "active" ? (
                  <>
                    <ToggleLeft size={13} className="me-2" />
                    {t.actions?.deactivate ?? "Deactivate"}
                  </>
                ) : (
                  <>
                    <ToggleRight size={13} className="me-2" />
                    {t.actions?.activate ?? "Activate"}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleDelete} 
                disabled={isPending}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={13} className="me-2" />
                {t.actions?.delete ?? "Delete"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// ── Main Table ─────────────────────────────────────────────────────────────

interface OffersTableProps {
  offers: Offer[];
  userScopes?: string[];
  loading?: boolean;
}

export function OffersTable({
  offers,
  userScopes = [],
  loading = false,
}: OffersTableProps) {
  const t = useOffers();
  const { dir } = useLanguage();
  const router = useRouter();

  function handleRefresh() {
    router.refresh();
  }

  const columns: TableColumn<Offer>[] = [
    {
      key: "name",
      label: t.table.name,
      sortable: true,
      isTitle: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shadow-sm shrink-0">
            <Gift className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-tight">{value}</span>
        </div>
      ),
    },
    {
      key: "triggerProduct",
      label: t.table.trigger,
      sortable: true,
      isSubtitle: true,
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="font-bold text-sm truncate tracking-tight">
            {row.triggerProduct?.name ?? "—"}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground opacity-60 truncate">
            {row.triggerVariant ? row.triggerVariant.label : t.any_variant}
            {" · "}
            {row.discountType === "free_shipping"
              ? (t.buy_x_free_shipping as string).replace("{x}", String(row.triggerQuantity))
              : t.buy_x_get_y
                  .replace("{x}", String(row.triggerQuantity))
                  .replace("{y}", String(row.rewardQuantity))}
          </div>
        </div>
      ),
    },
    {
      key: "rewardProduct",
      label: t.table.reward,
      render: (_value, row) => {
        if (row.discountType === "free_shipping") {
          return <DiscountTypeBadge type="free_shipping" />;
        }
        return (
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">
              {row.rewardProduct?.name ?? "—"}
            </div>
            {row.rewardVariant && (
              <div className="text-[10px] font-semibold text-muted-foreground/60 truncate">
                {row.rewardVariant.label}
              </div>
            )}
          </div>
        );
      },
      tabletHidden: true,
    },
    {
      key: "startsAt",
      label: t.table.schedule,
      render: (_value, row) => (
        <ScheduleLabel startsAt={row.startsAt} endsAt={row.endsAt} />
      ),
      tabletHidden: true,
    },
    {
      key: "status",
      label: t.table.status,
      sortable: true,
      isStatus: true,
      render: (_value, row) => <StatusBadge status={row.status} />,
    },
    {
      key: "id",
      label: "",
      render: (_value, row) => (
        <OfferRowActions
          offer={row}
          userScopes={userScopes}
          onRefresh={handleRefresh}
        />
      ),
      className: "w-10 text-end",
    },
  ];

  const filters = [
    {
      key: "status",
      label: (t as any).filters?.status ?? "Status",
      options: [
        { label: t.status.active, value: "active" },
        { label: t.status.inactive, value: "inactive" },
      ],
    },
    {
      key: "discountType",
      label: (t as any).filters?.discount_type ?? "Type",
      options: [
        { label: (t.discount_type as Record<string, string>).free, value: "free" },
        { label: (t.discount_type as Record<string, string>).free_shipping, value: "free_shipping" },
      ],
    },
  ];

  return (
    <DataTable
      data={offers}
      columns={columns}
      loading={loading}
      searchPlaceholder={(t as any).search_placeholder ?? "Search offers..."}
      filterable
      filters={filters}
      emptyState={
        <EmptyState
          icon={Gift}
          title={t.empty_state.title}
          description={t.empty_state.description}
          actionLabel={t.empty_state.action}
          onAction={() => router.push("/offers/new")}
        />
      }
      renderMobileCard={(offer) => (
          <div className="flex flex-col gap-2.5 py-0.5">

            {/* Top bar: status + actions at logical end */}
            <div className="flex items-center gap-1.5 justify-end">
              <StatusBadge status={offer.status} />
              <OfferRowActions
                offer={offer}
                userScopes={userScopes}
                onRefresh={handleRefresh}
              />
            </div>

            {/* Offer name */}
            <p className="text-[15px] font-black text-foreground tracking-tight leading-snug truncate">
              {offer.name}
            </p>

            {/* Rule description — large, prominent */}
            <p className="text-[13px] font-bold text-muted-foreground/70 tracking-wide -mt-1.5">
              {offer.discountType === "free_shipping"
                ? (t.buy_x_free_shipping as string).replace("{x}", String(offer.triggerQuantity))
                : t.buy_x_get_y
                    .replace("{x}", String(offer.triggerQuantity))
                    .replace("{y}", String(offer.rewardQuantity))}
            </p>

            {/* Trigger product + variant */}
            <div className="flex items-baseline justify-between gap-2 pt-1 pb-2.5 border-b border-border/10">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-foreground tracking-tight leading-snug truncate">
                  {offer.triggerProduct?.name ?? "—"}
                </p>
                <p className="text-[11px] font-semibold text-muted-foreground/60 mt-0.5 truncate">
                  {offer.triggerVariant ? offer.triggerVariant.label : t.any_variant}
                </p>
              </div>
              <Package className="w-4 h-4 text-primary/40 shrink-0" />
            </div>

            {/* Reward section */}
            {offer.discountType === "free_shipping" ? (
              <div className="flex items-center gap-2">
                <Gift className="w-3 h-3 text-emerald-500/40 shrink-0" />
                <DiscountTypeBadge type="free_shipping" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <Gift className="w-3 h-3 text-emerald-500/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground truncate">
                    {offer.rewardProduct?.name ?? "—"}
                  </p>
                  {offer.rewardVariant && (
                    <p className="text-[10px] font-semibold text-muted-foreground/50 truncate">
                      {offer.rewardVariant.label}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Schedule strip */}
            {(offer.startsAt || offer.endsAt) && (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-muted/40 border border-border/5">
                <CalendarDays size={11} className="text-muted-foreground/60 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 shrink-0">
                  {t.table.schedule}
                </span>
                <span
                  className="flex-1 min-w-0 text-[11px] font-bold text-muted-foreground/70 tracking-tight truncate text-end"
                >
                  <ScheduleLabel startsAt={offer.startsAt} endsAt={offer.endsAt} />
                </span>
              </div>
            )}

          </div>
        )}
      />
    );
  }

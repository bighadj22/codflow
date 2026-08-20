"use client";

import { useState } from "react";
import {
  Package,
  AlertTriangle,
  XCircle,
  Wallet,
  History,
  ChevronDown,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { StockHistoryDrawer } from "./stock-history-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import { useProducts, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatPrice } from "@/lib/format";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { cn } from "@/lib/utils";
import type { StockOverview, StockAlertItem } from "@/types/stock.types";

interface Props {
  overview: StockOverview;
  userScopes: string[];
}

type TabKey = "out" | "low" | "all";
type Tone = "neutral" | "destructive" | "warning" | "primary";

// ─── Tone styles ──────────────────────────────────────────────────────────────

const toneStyles: Record<
  Tone,
  { iconWrap: string; icon: string; value: string; cardWrap: string }
> = {
  neutral: {
    iconWrap: "bg-muted",
    icon: "text-muted-foreground",
    value: "text-foreground",
    cardWrap: "border-border/60 bg-card",
  },
  destructive: {
    iconWrap: "bg-destructive/10",
    icon: "text-destructive",
    value: "text-destructive",
    cardWrap: "border-destructive/30 bg-destructive/[0.04]",
  },
  warning: {
    iconWrap: "bg-warning/10",
    icon: "text-warning",
    value: "text-foreground",
    cardWrap: "border-warning/30 bg-warning/[0.04]",
  },
  primary: {
    iconWrap: "bg-primary/10",
    icon: "text-primary",
    value: "text-foreground",
    cardWrap: "border-primary/25 bg-primary/[0.04]",
  },
};

// ─── Mobile stat cell (inside hero panel) ─────────────────────────────────────

function StatCell({
  title,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const s = toneStyles[tone];
  return (
    <div className="flex min-h-[88px] items-start gap-3 p-4">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          s.iconWrap,
        )}
      >
        <Icon size={17} className={s.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p
          className={cn(
            "mt-1 truncate text-xl font-black leading-none tabular-nums tracking-tight",
            s.value,
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Desktop stat card (sm+) ──────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const s = toneStyles[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 transition-all",
        s.cardWrap,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              "mt-2 text-3xl font-black tabular-nums leading-none tracking-tight",
              s.value,
            )}
          >
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            s.iconWrap,
          )}
        >
          <Icon size={18} className={s.icon} />
        </div>
      </div>
    </div>
  );
}

// ─── Group items by product ───────────────────────────────────────────────────

interface ProductGroup {
  productId: string;
  productName: string;
  items: StockAlertItem[];
}

function groupByProduct(items: StockAlertItem[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const item of items) {
    const existing = map.get(item.productId);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        items: [item],
      });
    }
  }
  return Array.from(map.values());
}

function itemTone(item: StockAlertItem): Tone {
  if (item.isOutOfStock) return "destructive";
  if (item.inventory <= item.lowStockThreshold) return "warning";
  return "neutral";
}

// ─── Stock count chip ─────────────────────────────────────────────────────────

function StockChip({ item }: { item: StockAlertItem }) {
  const tone = itemTone(item);
  const styles: Record<Tone, string> = {
    destructive: "bg-destructive/10 text-destructive ring-destructive/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
    neutral: "bg-muted text-foreground ring-border/60",
    primary: "bg-primary/10 text-primary ring-primary/20",
  };

  return (
    <div
      className={cn(
        "inline-flex h-9 min-w-[3rem] items-center justify-center rounded-xl px-2.5 text-base font-black tabular-nums ring-1 ring-inset",
        styles[tone],
      )}
    >
      {item.inventory}
    </div>
  );
}

// ─── Single SKU row ───────────────────────────────────────────────────────────

function StockRow({
  item,
  isVariant,
  userScopes,
  onAdjust,
  onHistory,
}: {
  item: StockAlertItem;
  isVariant: boolean;
  userScopes: string[];
  onAdjust: (item: StockAlertItem) => void;
  onHistory: (item: StockAlertItem) => void;
}) {
  const t = useProducts();
  const tone = itemTone(item);
  const stripeColor =
    tone === "destructive"
      ? "bg-destructive"
      : tone === "warning"
      ? "bg-warning"
      : "bg-transparent";

  return (
    <div
      className={cn(
        "group relative flex min-h-[64px] items-center gap-3 overflow-hidden rounded-2xl border bg-card pe-2 ps-3 transition-colors",
        "hover:bg-muted/30 active:bg-muted/40",
        tone === "destructive" && "border-destructive/20",
        tone === "warning" && "border-warning/20",
        tone === "neutral" && "border-border/60",
        isVariant && "min-h-[56px] bg-muted/20",
      )}
    >
      {/* leading state stripe */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 start-0 w-[3px] rounded-full",
          stripeColor,
        )}
      />

      {/* tappable label area — opens history */}
      <button
        type="button"
        onClick={() => onHistory(item)}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-3 text-start"
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold text-foreground",
              isVariant ? "text-[13px]" : "text-sm",
            )}
          >
            {isVariant
              ? item.variantLabel ?? item.productName
              : item.productName}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {tone === "destructive"
              ? t.stock_overview.out_of_stock
              : tone === "warning"
              ? `${t.stock_overview.threshold_label} ${item.lowStockThreshold}`
              : `${t.stock_overview.threshold_label} ${item.lowStockThreshold} ${t.stock_overview.threshold_units}`}
          </p>
        </div>
      </button>

      {/* stock chip */}
      <StockChip item={item} />

      {/* actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onHistory(item)}
          className="hidden h-10 w-10 text-muted-foreground hover:text-primary sm:inline-flex"
          title={t.actions.stock_history}
          aria-label={t.actions.stock_history}
        >
          <History className="size-4" />
        </Button>
        <ProtectedAction
          userScopes={userScopes}
          requiredScope={SCOPES.PRODUCTS_MANAGE}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdjust(item)}
            className="h-10 gap-1.5 px-3 text-[12px] font-bold"
            aria-label={t.actions.adjust_stock}
          >
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">{t.actions.adjust_stock}</span>
          </Button>
        </ProtectedAction>
      </div>
    </div>
  );
}

// ─── Product group block ──────────────────────────────────────────────────────

function ProductGroupBlock({
  group,
  userScopes,
  onAdjust,
  onHistory,
}: {
  group: ProductGroup;
  userScopes: string[];
  onAdjust: (item: StockAlertItem) => void;
  onHistory: (item: StockAlertItem) => void;
}) {
  const hasMultiple = group.items.length > 1;
  const [open, setOpen] = useState(true);

  if (!hasMultiple && !group.items[0].variantLabel) {
    return (
      <StockRow
        item={group.items[0]}
        isVariant={false}
        userScopes={userScopes}
        onAdjust={onAdjust}
        onHistory={onHistory}
      />
    );
  }

  const totalInventory = group.items.reduce((sum, i) => sum + i.inventory, 0);
  const groupTone: Tone = group.items.some((i) => i.isOutOfStock)
    ? "destructive"
    : group.items.some((i) => i.inventory <= i.lowStockThreshold)
    ? "warning"
    : "neutral";

  const stripeColor =
    groupTone === "destructive"
      ? "bg-destructive"
      : groupTone === "warning"
      ? "bg-warning"
      : "bg-transparent";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        groupTone === "destructive" && "border-destructive/20",
        groupTone === "warning" && "border-warning/20",
        groupTone === "neutral" && "border-border/60",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex w-full min-h-[56px] items-center gap-3 px-4 py-3 text-start transition-colors",
          "bg-muted/30 hover:bg-muted/50 active:bg-muted/60",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-2 start-0 w-[3px] rounded-full",
            stripeColor,
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-foreground">
            {group.productName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {group.items.length} SKU
          </span>
        </div>
        <span className="shrink-0 text-sm font-black tabular-nums text-foreground">
          {totalInventory}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-1.5 p-2">
          {group.items.map((item) => (
            <StockRow
              key={`${item.productId}__${item.variantId ?? ""}`}
              item={item}
              isVariant={true}
              userScopes={userScopes}
              onAdjust={onAdjust}
              onHistory={onHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function StockOverviewView({ overview, userScopes }: Props) {
  const t = useProducts();
  const common = useCommon();
  const { locale } = useLanguage();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");

  const [adjustItem, setAdjustItem] = useState<StockAlertItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockAlertItem | null>(null);

  const tabs: { key: TabKey; label: string; count?: number; tone: Tone }[] = [
    { key: "all", label: t.stock_overview.tab_all, tone: "primary" },
    {
      key: "low",
      label: t.stock_overview.tab_low,
      count: overview.lowStockCount,
      tone: "warning",
    },
    {
      key: "out",
      label: t.stock_overview.tab_out,
      count: overview.outOfStockCount,
      tone: "destructive",
    },
  ];

  const rawRows =
    tab === "out"
      ? overview.outOfStockItems
      : tab === "low"
      ? overview.lowStockItems
      : overview.allItems ?? [];

  const groups = groupByProduct(rawRows);

  const emptyConfig =
    tab === "out"
      ? {
          title: t.stock_overview.empty_out,
          desc: t.stock_overview.empty_out_desc,
          icon: Package,
        }
      : tab === "low"
      ? {
          title: t.stock_overview.empty_low,
          desc: t.stock_overview.empty_low_desc,
          icon: AlertTriangle,
        }
      : {
          title: t.stock_overview.empty_all,
          desc: t.stock_overview.empty_all_desc,
          icon: Package,
        };

  const numLocale = locale === "ar" ? "ar-DZ" : "en";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ─── Mobile: hero panel (single integrated card with internal grid) ─── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card sm:hidden">
        <div className="grid grid-cols-2 [&>*]:border-border/60">
          <div className="border-e border-b">
            <StatCell
              title={t.stock_overview.total_skus}
              value={overview.totalSkus.toLocaleString(numLocale)}
              icon={Package}
            />
          </div>
          <div className="border-b">
            <StatCell
              title={t.stock_overview.out_of_stock}
              value={overview.outOfStockCount.toLocaleString(numLocale)}
              icon={XCircle}
              tone={overview.outOfStockCount > 0 ? "destructive" : "neutral"}
            />
          </div>
          <div className="border-e">
            <StatCell
              title={t.stock_overview.low_stock}
              value={overview.lowStockCount.toLocaleString(numLocale)}
              icon={AlertTriangle}
              tone={overview.lowStockCount > 0 ? "warning" : "neutral"}
            />
          </div>
          <ProtectedAction
            userScopes={userScopes}
            requiredScope={SCOPES.PRODUCTS_MANAGE}
          >
            <StatCell
              title={t.stock_overview.stock_value}
              value={formatPrice(
                overview.totalInventoryValue,
                common.currency.symbol,
              )}
              icon={Wallet}
              tone="primary"
            />
          </ProtectedAction>
        </div>
      </div>

      {/* ─── Desktop: 4-column grid of separate cards ─── */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-4">
        <StatCard
          title={t.stock_overview.total_skus}
          value={overview.totalSkus.toLocaleString(numLocale)}
          icon={Package}
        />
        <StatCard
          title={t.stock_overview.out_of_stock}
          value={overview.outOfStockCount.toLocaleString(numLocale)}
          icon={XCircle}
          tone={overview.outOfStockCount > 0 ? "destructive" : "neutral"}
        />
        <StatCard
          title={t.stock_overview.low_stock}
          value={overview.lowStockCount.toLocaleString(numLocale)}
          icon={AlertTriangle}
          tone={overview.lowStockCount > 0 ? "warning" : "neutral"}
        />
        <ProtectedAction
          userScopes={userScopes}
          requiredScope={SCOPES.PRODUCTS_MANAGE}
        >
          <StatCard
            title={t.stock_overview.stock_value}
            value={formatPrice(
              overview.totalInventoryValue,
              common.currency.symbol,
            )}
            icon={Wallet}
            tone="primary"
          />
        </ProtectedAction>
      </div>

      {/* ─── Segmented tab pill (mobile-native) ─── */}
      <div className="flex w-full gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1">
        {tabs.map((tab_item) => {
          const active = tab === tab_item.key;
          return (
            <button
              key={tab_item.key}
              type="button"
              onClick={() => setTab(tab_item.key)}
              className={cn(
                "flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-bold transition-all",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={active}
            >
              <span className="truncate">{tab_item.label}</span>
              {tab_item.count !== undefined && tab_item.count > 0 && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums ring-1 ring-inset",
                    active
                      ? tab_item.tone === "destructive"
                        ? "bg-destructive/10 text-destructive ring-destructive/20"
                        : tab_item.tone === "warning"
                        ? "bg-warning/10 text-warning ring-warning/20"
                        : "bg-primary/10 text-primary ring-primary/20"
                      : "bg-muted text-muted-foreground ring-border/60",
                  )}
                >
                  {tab_item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── List ─── */}
      <div className="space-y-2.5">
        {groups.length === 0 ? (
          <EmptyState
            icon={emptyConfig.icon}
            title={emptyConfig.title}
            description={emptyConfig.desc}
            actionLabel={tab === "all" ? t.stock_overview.empty_action : undefined}
            onAction={tab === "all" ? () => router.push("/products/new") : undefined}
            className="py-20"
          />
        ) : (
          groups.map((group) => (
            <ProductGroupBlock
              key={group.productId}
              group={group}
              userScopes={userScopes}
              onAdjust={setAdjustItem}
              onHistory={setHistoryItem}
            />
          ))
        )}
      </div>

      {adjustItem && (
        <StockAdjustmentDialog
          productId={adjustItem.productId}
          variant={null}
          variantId={adjustItem.variantId}
          variantDisplayLabel={adjustItem.variantLabel}
          simpleInventory={adjustItem.inventory}
          onClose={() => setAdjustItem(null)}
          onSuccess={() => {
            setAdjustItem(null);
            router.refresh();
          }}
        />
      )}

      {historyItem && (
        <StockHistoryDrawer
          productId={historyItem.productId}
          variantId={historyItem.variantId ?? undefined}
          productName={historyItem.productName}
          variantLabel={historyItem.variantLabel}
          open={true}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  );
}

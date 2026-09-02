import { useEffect, useState } from "react";
import { AlertCircle, Pencil, X, XCircle, AlertTriangle, Wallet, Package, History } from "lucide-react";
import { canScope, RequireAuth, useIdentity } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { Button, EmptyState, IconButton, Alert, PageHeader, StatCard } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { getStockOverview } from "@/features/products/api";
import { formatMoneyValue, groupStockByProduct, stockAlertTone } from "@/features/products/model";
import type { StockAlertItem, StockOverview } from "@/features/products/types";
import { StockHistoryDrawer } from "@/features/products/components/StockHistoryDrawer";
import { StockAdjustmentDialog } from "@/features/products/components/StockAdjustmentDialog";

function Loading() { return <div role="status" aria-busy="true" className="space-y-4"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>; }

type TabKey = "out" | "low" | "all";

function StockChip({ item }: { item: StockAlertItem }) {
  const tone = stockAlertTone(item);
  const classes = tone === "out" ? "bg-destructive/10 text-destructive ring-destructive/20" : tone === "low" ? "bg-amber-500/10 text-amber-600 ring-amber-500/20" : "bg-muted text-foreground ring-border/60";
  return <span className={`inline-flex h-9 min-w-12 items-center justify-center rounded-xl px-2.5 text-base font-bold tabular-nums ring-1 ring-inset ${classes}`}>{item.inventory}</span>;
}

function StockRow({ item, isVariant, onAdjust, onHistory }: { item: StockAlertItem; isVariant: boolean; onAdjust: (item: StockAlertItem) => void; onHistory: (item: StockAlertItem) => void }) {
  const t = useT("products");
  const tone = stockAlertTone(item);
  const stripeColor = tone === "out" ? "bg-destructive" : tone === "low" ? "bg-amber-500" : "bg-transparent";
  return <div className={`group relative flex min-h-16 items-center gap-3 overflow-hidden rounded-xl border bg-card px-3 py-2 ${tone === "out" ? "border-destructive/20" : tone === "low" ? "border-amber-500/20" : "border-border/60"} ${isVariant ? "min-h-14 bg-muted/20" : ""}`}>
    <span aria-hidden className={`absolute inset-y-2 start-0 w-[3px] rounded-full ${stripeColor}`} />
    <button type="button" onClick={() => onHistory(item)} className="flex min-w-0 flex-1 items-center gap-2.5 py-3 text-start">
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold text-foreground ${isVariant ? "text-[13px]" : "text-sm"}`}>{isVariant ? item.variantLabel ?? item.productName : item.productName}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{tone === "out" ? t("stock_overview.out_of_stock") : `${t("stock_overview.threshold_label")} ${item.lowStockThreshold}`}</p>
      </div>
    </button>
    <StockChip item={item} />
    <div className="flex shrink-0 items-center gap-1">
      <IconButton type="button" aria-label={t("actions.stock_history")} title={t("actions.stock_history")} onClick={() => onHistory(item)} className="hidden sm:grid"><History size={15} /></IconButton>
      <Button type="button" variant="secondary" onClick={() => onAdjust(item)} className="h-9 px-3 text-xs"><Pencil size={14} />{t("actions.adjust_stock")}</Button>
    </div>
  </div>;
}

function ProductGroupBlock({ group, onAdjust, onHistory }: { group: ReturnType<typeof groupStockByProduct>[number]; onAdjust: (item: StockAlertItem) => void; onHistory: (item: StockAlertItem) => void }) {
  const [open, setOpen] = useState(true);
  const hasMultiple = group.items.length > 1;
  if (!hasMultiple && !group.items[0].variantLabel) {
    return <StockRow item={group.items[0]} isVariant={false} onAdjust={onAdjust} onHistory={onHistory} />;
  }
  const totalInventory = group.items.reduce((sum, item) => sum + item.inventory, 0);
  const groupTone = group.items.some((item) => item.isOutOfStock) ? "out" : group.items.some((item) => item.inventory <= item.lowStockThreshold) ? "low" : "ok";
  const stripeColor = groupTone === "out" ? "bg-destructive" : groupTone === "low" ? "bg-amber-500" : "bg-transparent";
  return <div className={`overflow-hidden rounded-xl border ${groupTone === "out" ? "border-destructive/20" : groupTone === "low" ? "border-amber-500/20" : "border-border/60"}`}>
    <button type="button" onClick={() => setOpen((current) => !current)} className={`relative flex w-full min-h-14 items-center gap-3 px-4 py-3 text-start transition-colors ${open ? "bg-muted/50" : "bg-muted/30 hover:bg-muted/50"}`}>
      <span aria-hidden className={`absolute inset-y-2 start-0 w-[3px] rounded-full ${stripeColor}`} />
      <div className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-bold text-foreground">{group.productName}</span><span className="text-[11px] text-muted-foreground">{group.items.length} SKU</span></div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{totalInventory}</span>
      <span className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
    </button>
    {open && <div className="space-y-1.5 p-2">{group.items.map((item) => <StockRow key={`${item.productId}__${item.variantId ?? ""}`} item={item} isVariant onAdjust={onAdjust} onHistory={onHistory} />)}</div>}
  </div>;
}

function StockOverviewList() {
  const t = useT("products");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const [overview, setOverview] = useState<StockOverview | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [adjustItem, setAdjustItem] = useState<StockAlertItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockAlertItem | null>(null);

  async function load() {
    setLoadError(null);
    try { setOverview(await getStockOverview()); } catch (cause) { setLoadError(cause); }
  }
  useEffect(() => { if (canScope(identity, SCOPES.PRODUCTS_READ)) void load(); }, [identity?.role, identity?.scopes.join(",")]);

  if (!canScope(identity, SCOPES.PRODUCTS_READ)) return <Alert role="alert" tone="critical">{auth("no_access")}</Alert>;
  if (loadError) return <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><div className="flex-1"><p className="font-semibold">{t("error_load")}</p><button type="button" onClick={() => void load()} className="mt-3 text-xs font-semibold underline underline-offset-4">{common("retry")}</button></div></Alert>;
  if (overview === null) return <Loading />;

  const tabs = [
    { key: "all" as TabKey, label: t("stock_overview.tab_all"), count: undefined as number | undefined },
    { key: "low" as TabKey, label: t("stock_overview.tab_low"), count: overview.lowStockCount },
    { key: "out" as TabKey, label: t("stock_overview.tab_out"), count: overview.outOfStockCount },
  ];
  const rawRows = tab === "out" ? overview.outOfStockItems : tab === "low" ? overview.lowStockItems : overview.allItems ?? [];
  const groups = groupStockByProduct(rawRows);
  const emptyConfig = tab === "out" ? { title: t("stock_overview.empty_out"), desc: t("stock_overview.empty_out_desc"), icon: <XCircle size={22} /> } : tab === "low" ? { title: t("stock_overview.empty_low"), desc: t("stock_overview.empty_low_desc"), icon: <AlertTriangle size={22} /> } : { title: t("stock_overview.empty_all"), desc: t("stock_overview.empty_all_desc"), icon: <Package size={22} /> };

  return <div className="space-y-5">
    {actionError && <Alert role="alert" tone="critical"><AlertCircle size={18} className="shrink-0" /><span className="flex-1">{actionError}</span><button type="button" onClick={() => setActionError(null)} aria-label={common("cancel")}><X size={16} /></button></Alert>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4"><StatCard label={t("stock_overview.total_skus")} value={overview.totalSkus.toLocaleString(locale === "ar" ? "ar-DZ" : "en")} icon={<Package size={20} />} /><StatCard label={t("stock_overview.out_of_stock")} value={overview.outOfStockCount.toLocaleString(locale === "ar" ? "ar-DZ" : "en")} icon={<XCircle size={20} />} tone={overview.outOfStockCount > 0 ? "critical" : "neutral"} /><StatCard label={t("stock_overview.low_stock")} value={overview.lowStockCount.toLocaleString(locale === "ar" ? "ar-DZ" : "en")} icon={<AlertTriangle size={20} />} tone={overview.lowStockCount > 0 ? "warning" : "neutral"} /><StatCard label={t("stock_overview.stock_value")} value={formatMoneyValue(overview.totalInventoryValue, locale)} icon={<Wallet size={20} />} /></div>
    <div className="flex gap-1.5 rounded-xl border border-border bg-muted/40 p-1">{tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-pressed={tab === item.key} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-bold transition-all ${tab === item.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{item.label}{item.count !== undefined && item.count > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground ring-1 ring-inset ring-border/60">{item.count}</span>}</button>)}</div>
    {groups.length === 0 ? <EmptyState icon={emptyConfig.icon} title={emptyConfig.title} description={emptyConfig.desc} /> : <div className="space-y-2.5">{groups.map((group) => <ProductGroupBlock key={group.productId} group={group} onAdjust={setAdjustItem} onHistory={setHistoryItem} />)}</div>}
    {adjustItem && <StockAdjustmentDialog productId={adjustItem.productId} variantId={adjustItem.variantId} variantDisplayLabel={adjustItem.variantLabel} simpleInventory={adjustItem.inventory} onClose={() => setAdjustItem(null)} onSuccess={() => { setAdjustItem(null); void load(); }} />}
    {historyItem && <StockHistoryDrawer productId={historyItem.productId} variantId={historyItem.variantId ?? undefined} productName={historyItem.productName} variantLabel={historyItem.variantLabel} open onClose={() => setHistoryItem(null)} />}
  </div>;
}

function Gated() {
  const t = useT("products");
  return <DashboardChrome currentPath="/products/stock"><PageHeader title={t("stock_overview.page_title")} /><StockOverviewList /></DashboardChrome>;
}

export default function StockOverviewPageApp() { return <RequireAuth><Gated /></RequireAuth>; }

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  MapPin,
  PackageX,
  Phone,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  canScope,
  RequireAuth,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import {
  deleteAbandonedOrder,
  getAbandonedStats,
  listAbandonedOrders,
  updateAbandonedStatus,
} from "@/features/orders/api";
import {
  abandonedStatusOptions,
  filterAbandonedOrders,
  formatMoney,
} from "@/features/orders/model";
import type {
  AbandonedOrder,
  AbandonedOrderStatus,
  AbandonedStats,
} from "@/features/orders/types";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmDialog,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";

const STATUS_TONE: Record<
  AbandonedOrderStatus,
  "neutral" | "warning" | "info" | "success"
> = {
  pending: "neutral",
  abandoned: "warning",
  contacted: "info",
  converted: "success",
};

const STATUS_PILL: Record<AbandonedOrderStatus, string> = {
  pending:
    "bg-[var(--status-new-bg)] text-[var(--status-new-text)] border-[var(--status-new-border)]",
  abandoned:
    "bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)] border-[var(--status-preparing-border)]",
  contacted:
    "bg-[var(--status-ready-bg)] text-[var(--status-ready-text)] border-[var(--status-ready-border)]",
  converted:
    "bg-[var(--status-delivered-bg)] text-[var(--status-delivered-text)] border-[var(--status-delivered-border)]",
};

function formatDate(value: string, locale: "ar" | "en" | "fr"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function StatusControl({
  row,
  busy,
  onChange,
}: {
  row: AbandonedOrder;
  busy: boolean;
  onChange: (status: AbandonedOrderStatus) => void;
}) {
  const t = useT("orders");
  const identity = useIdentity();
  const canManage = canScope(identity, "abandoned_orders:manage");
  const options = abandonedStatusOptions(row.status);

  if (!canManage || options.length === 1) {
    return (
      <Badge tone={STATUS_TONE[row.status]}>
        {t(`abandoned.status.${row.status}`)}
      </Badge>
    );
  }

  return (
    <Select
      aria-label={t(`abandoned.status.${row.status}`)}
      value={row.status}
      disabled={busy}
      onChange={(event) =>
        onChange(event.currentTarget.value as AbandonedOrderStatus)
      }
      variant="pill"
      wrapperClassName="inline-flex"
      triggerClassName={`max-w-40 ${STATUS_PILL[row.status]}`}
    >
      {options.map((status) => (
        <option key={status} value={status}>
          {t(`abandoned.status.${status}`)}
        </option>
      ))}
    </Select>
  );
}

function RecoveredLink({ row }: { row: AbandonedOrder }) {
  const t = useT("orders");
  if (!row.convertedOrderId || !row.convertedOrderNumber) return null;
  return (
    <a
      href={`/orders/${row.convertedOrderId}`}
      className="mt-1 inline-block text-xs font-semibold text-link underline-offset-4 hover:underline"
    >
      {t("abandoned.recovered_order").replace(
        "{number}",
        row.convertedOrderNumber,
      )}
    </a>
  );
}

function AbandonedDesktopRow({
  row,
  busy,
  onStatusChange,
  onDelete,
}: {
  row: AbandonedOrder;
  busy: boolean;
  onStatusChange: (row: AbandonedOrder, status: AbandonedOrderStatus) => void;
  onDelete: (row: AbandonedOrder) => void;
}) {
  const common = useT("common");
  const locale = useLocale();
  const identity = useIdentity();
  const canManage = canScope(identity, "abandoned_orders:manage");

  return (
    <TableRow className="border-b border-border last:border-0 transition-colors hover:bg-muted/40">
      <TableCell>
        <p className="font-medium text-foreground">{row.customerName}</p>
        {row.wilayaName && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0" />
            {row.wilayaName}
            {row.communeName ? ` · ${row.communeName}` : ""}
          </p>
        )}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <Phone size={13} className="shrink-0 text-muted-foreground" />
          <span dir="ltr">{row.phone}</span>
        </span>
      </TableCell>
      <TableCell>
        {row.productName ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {row.productName}
            </p>
            {row.variantLabel && (
              <p className="truncate text-xs text-muted-foreground">
                {row.variantLabel}
              </p>
            )}
            <RecoveredLink row={row} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-end font-bold tabular-nums text-foreground">
        {formatMoney(row.price, locale)}
      </TableCell>
      <TableCell>
        <StatusControl row={row} busy={busy} onChange={(status) => onStatusChange(row, status)} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(row.createdAt, locale)}
      </TableCell>
      <TableCell className="text-end">
        {canManage && (
          <IconButton
            type="button"
            variant="danger"
            onClick={() => onDelete(row)}
            disabled={busy}
            aria-label={common("delete")}
            title={common("delete")}
          >
            <Trash2 size={16} />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
}

function AbandonedMobileCard({
  row,
  busy,
  onStatusChange,
  onDelete,
}: {
  row: AbandonedOrder;
  busy: boolean;
  onStatusChange: (row: AbandonedOrder, status: AbandonedOrderStatus) => void;
  onDelete: (row: AbandonedOrder) => void;
}) {
  const common = useT("common");
  const locale = useLocale();
  const identity = useIdentity();
  const canManage = canScope(identity, "abandoned_orders:manage");

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {row.customerName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {row.phone}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusControl row={row} busy={busy} onChange={(status) => onStatusChange(row, status)} />
          {canManage && (
            <IconButton
              type="button"
              variant="danger"
              onClick={() => onDelete(row)}
              disabled={busy}
              aria-label={common("delete")}
              title={common("delete")}
            >
              <Trash2 size={16} />
            </IconButton>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {row.productName ? (
            <>
              <p className="truncate text-sm font-medium text-foreground">
                {row.productName}
              </p>
              {row.variantLabel && (
                <p className="truncate text-xs text-muted-foreground">
                  {row.variantLabel}
                </p>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          <RecoveredLink row={row} />
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
          {formatMoney(row.price, locale)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <MapPin size={13} className="shrink-0" />
          {row.wilayaName ?? row.communeName ?? "—"}
        </span>
        <span className="shrink-0">{formatDate(row.createdAt, locale)}</span>
      </div>
    </article>
  );
}

function AbandonedSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="h-14 border-b border-border bg-muted/35" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid h-14 grid-cols-[1.2fr_1fr_1fr_0.6fr_0.8fr] items-center gap-4 border-b border-border px-4 last:border-0"
        >
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 justify-self-end animate-pulse rounded bg-muted" />
          <span className="h-6 w-20 justify-self-end animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function AbandonedOrdersView() {
  const identity = useIdentity();
  const t = useT("orders");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const confirm = useConfirmDialog();
  const [stats, setStats] = useState<AbandonedStats | null>(null);
  const [rows, setRows] = useState<AbandonedOrder[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    if (!canScope(identity, "abandoned_orders:read")) return;
    setLoadError(null);
    try {
      const [nextStats, listResponse] = await Promise.all([
        getAbandonedStats(),
        listAbandonedOrders({ limit: 100, offset: 0 }),
      ]);
      setStats(nextStats);
      setRows(listResponse.data ?? []);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }

  useEffect(() => {
    void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  async function changeStatus(row: AbandonedOrder, next: AbandonedOrderStatus) {
    if (next === row.status) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      await updateAbandonedStatus(row.id, next);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : String(cause),
      );
      notify.error(common("feedback.action_failed"));
      setBusyId(null);
      return;
    }
    notify.success(common("feedback.updated"));
    try {
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: AbandonedOrder) {
    const accepted = await confirm({
      title: common("confirm_delete_title"),
      description: common("delete_description"),
      confirmLabel: common("delete"),
      tone: "danger",
    });
    if (!accepted) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      await deleteAbandonedOrder(row.id);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : String(cause),
      );
      notify.error(common("feedback.action_failed"));
      setBusyId(null);
      return;
    }
    notify.success(common("feedback.deleted"));
    try {
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <PageHeader
      title={t("abandoned.title")}
      subtitle={t("abandoned.subtitle")}
    />
  );

  if (!canScope(identity, "abandoned_orders:read")) {
    return (
      <div>
        {header}
        <Alert role="alert" tone="critical">
          {auth("no_access")}
        </Alert>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        {header}
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{t("abandoned.load_error")}</p>
            <p className="mt-1 text-xs opacity-80">{loadError.message}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4"
            >
              <RefreshCw size={13} />
              {common("retry")}
            </button>
          </div>
        </Alert>
      </div>
    );
  }

  if (stats === null || rows === null) {
    return (
      <div>
        {header}
        <div role="status" aria-busy="true" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[88px] animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
          <AbandonedSkeleton />
        </div>
      </div>
    );
  }

  const filtered = filterAbandonedOrders(rows, { query, status });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasFilters = query.trim() !== "" || status !== "all";

  return (
    <div className="space-y-5">
      {header}

      {actionError && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <div className="flex-1">{actionError}</div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("abandoned.stats.abandoned")}
          value={stats.totalAbandoned.toLocaleString(locale)}
          tone="warning"
          icon={<PackageX size={20} />}
        />
        <StatCard
          label={t("abandoned.stats.recovered")}
          value={stats.totalConverted.toLocaleString(locale)}
          tone="success"
          icon={<CheckCircle2 size={20} />}
        />
        <StatCard
          label={t("abandoned.stats.conversion_rate")}
          value={`${stats.conversionRate}%`}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label={t("abandoned.stats.lost_revenue")}
          value={formatMoney(stats.estimatedLostRevenue, locale)}
          tone="critical"
          icon={<Wallet size={20} />}
        />
      </div>

      <Card flush>
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("abandoned.search_placeholder")}
            />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {t("abandoned.count_label").replace(
                "{count}",
                String(filtered.length),
              )}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Select
              aria-label={t("abandoned.status.all")}
              value={status}
              onChange={(event) => setStatus(event.currentTarget.value)}
              wrapperClassName="sm:w-44"
            >
              <option value="all">{t("abandoned.status.all")}</option>
              {(["pending", "abandoned", "contacted", "converted"] as const).map(
                (value) => (
                  <option key={value} value={value}>
                    {t(`abandoned.status.${value}`)}
                  </option>
                ),
              )}
            </Select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
                className="h-10 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {common("cancel")}
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title={
              hasFilters
                ? common("no_results_found")
                : t("abandoned.empty.title")
            }
            description={hasFilters ? undefined : t("abandoned.empty.description")}
          />
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {visible.map((row) => (
                <AbandonedMobileCard
                  key={row.id}
                  row={row}
                  busy={busyId === row.id}
                  onStatusChange={changeStatus}
                  onDelete={remove}
                />
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow className="text-xs font-semibold text-muted-foreground">
                    <TableHead className="text-start">
                      {t("table.customer")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("table.phone")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("abandoned.table.product")}
                    </TableHead>
                    <TableHead className="text-end">
                      {t("abandoned.table.basket")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("table.status")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("table.date")}
                    </TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">{common("table.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => (
                    <AbandonedDesktopRow
                      key={row.id}
                      row={row}
                      busy={busyId === row.id}
                      onStatusChange={changeStatus}
                      onDelete={remove}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}

export default function AbandonedOrdersPageApp() {
  return (
    <RequireAuth>
      <DashboardChrome currentPath="/orders/abandoned">
        <AbandonedOrdersView />
      </DashboardChrome>
    </RequireAuth>
  );
}

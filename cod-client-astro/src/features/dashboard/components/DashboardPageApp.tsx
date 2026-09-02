import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  PackageX,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  canScope,
  RequireAuth,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import {
  Button,
  EmptyState,
  LinkButton,
  Alert,
  PageHeader,
  StatCard,
  Card,
} from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { getDashboardStats } from "@/features/dashboard/api";
import { fillStatusStats } from "@/features/dashboard/model";
import { listOrders } from "@/features/orders/api";
import { formatMoney, orderTotal } from "@/features/orders/model";
import type { OrderListItem, OrderStatus } from "@/features/orders/types";

const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-[var(--status-new-text)]",
  confirmed: "bg-[var(--status-confirmed-text)]",
  unreachable: "bg-[var(--status-preparing-text)]",
  preparing: "bg-[var(--status-preparing-text)]",
  ready: "bg-[var(--status-ready-text)]",
  assigned: "bg-[var(--status-assigned-text)]",
  dispatched: "bg-[var(--status-dispatched-text)]",
  out_for_delivery: "bg-[var(--status-out-text)]",
  delivered: "bg-[var(--status-delivered-text)]",
  returned: "bg-[var(--status-returned-text)]",
  cancelled: "bg-[var(--status-cancelled-text)]",
};

const IN_PROGRESS: OrderStatus[] = [
  "new",
  "confirmed",
  "unreachable",
  "preparing",
  "ready",
  "assigned",
  "dispatched",
  "out_for_delivery",
];

function relativeTime(value: string, tCommon: (key: string) => string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return tCommon("time.moments_ago");
  if (minutes < 60)
    return tCommon("time.minutes_ago").replace("{count}", String(minutes));
  const hours = Math.round(minutes / 60);
  if (hours < 24)
    return tCommon("time.hours_ago").replace("{count}", String(hours));
  const days = Math.round(hours / 24);
  return tCommon("time.days_ago").replace("{count}", String(days));
}

function DashboardOverview() {
  const identity = useIdentity();
  const t = useT("dashboard");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null);
  const [recent, setRecent] = useState<OrderListItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function load() {
    setError(null);
    try {
      const [nextStats, nextRecent] = await Promise.all([
        getDashboardStats(),
        canScope(identity, "orders:read")
          ? listOrders({ limit: 5 })
          : Promise.resolve(null),
      ]);
      setStats(nextStats);
      setRecent(nextRecent ? nextRecent.data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }

  useEffect(() => {
    if (canScope(identity, "dashboard:view")) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  const header = (
    <PageHeader
      title={t("header.title")}
      subtitle={t("header.subtitle")}
      actions={
        canScope(identity, "orders:create") ? (
          <LinkButton href="/orders/new">
            <Plus size={16} />
            {t("recent_orders.new_order")}
          </LinkButton>
        ) : undefined
      }
    />
  );

  if (!canScope(identity, "dashboard:view")) {
    return (
      <div>
        {header}
        <Alert role="alert" tone="critical">
          {auth("no_access")}
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {header}
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{common("error_occurred")}</p>
            <p className="mt-1 text-xs opacity-80">{error.message}</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void load()}
              className="mt-3 min-h-9 px-0 text-xs underline underline-offset-4"
            >
              <RefreshCw size={13} />
              {common("retry")}
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!stats || recent === null) {
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
          <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </div>
    );
  }

  const rows = fillStatusStats(stats);
  const counts = new Map(rows.map((row) => [row.status, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const delivered = counts.get("delivered") ?? 0;
  const returned = counts.get("returned") ?? 0;
  const active = IN_PROGRESS.reduce(
    (sum, status) => sum + (counts.get(status) ?? 0),
    0,
  );

  return (
    <div className="space-y-5">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("stats.total_orders")}
          value={total.toLocaleString(locale)}
          icon={<BarChart3 size={20} />}
        />
        <StatCard
          label={t("stats.active_orders")}
          value={active.toLocaleString(locale)}
          tone="warning"
          icon={<PackageX size={20} />}
        />
        <StatCard
          label={t("stats.delivered")}
          value={delivered.toLocaleString(locale)}
          tone="success"
          icon={<CheckCircle2 size={20} />}
        />
        <StatCard
          label={t("stats.returned")}
          value={returned.toLocaleString(locale)}
          tone="critical"
          icon={<RotateCcw size={20} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card
          flush
          title={t("recent_orders.title")}
          action={
            <a
              href="/orders"
              className="text-xs font-semibold text-link hover:underline"
            >
              {t("recent_orders.view_all")}
            </a>
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              compact
              icon={<BarChart3 size={20} />}
              title={t("recent_orders.empty")}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((order) => (
                <li key={order.id}>
                  <a
                    href={`/orders/${order.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-link">
                        {order.orderNumber}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {order.customerName}
                      </span>
                    </span>
                    <OrderStatusBadge status={order.status} />
                    <span className="w-24 shrink-0 text-end text-sm font-bold tabular-nums text-foreground">
                      {formatMoney(orderTotal(order), locale)}
                    </span>
                    <span className="hidden w-24 shrink-0 text-end text-xs text-muted-foreground sm:block">
                      {relativeTime(order.createdAt, common)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush title={t("status_breakdown.title")}>
          <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
            {t("status_breakdown.subtitle")}
          </p>
          {total === 0 ? (
            <EmptyState
              compact
              icon={<BarChart3 size={20} />}
              title={t("recent_orders.empty")}
            />
          ) : (
            <div className="divide-y divide-border">
              {rows.map(({ status, count }) => {
                const percentage = Math.round((count / total) * 100);
                return (
                  <div
                    key={status}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)_64px] sm:items-center sm:px-5"
                  >
                    <div className="flex items-center justify-between gap-3 sm:justify-start">
                      <OrderStatusBadge status={status} />
                      <span className="text-sm font-bold tabular-nums text-foreground sm:hidden">
                        {count.toLocaleString(locale)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label={common(`statuses.${status}`)}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={count}
                      >
                        <div
                          className={`h-full rounded-full ${STATUS_TONE[status]}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-10 text-end text-xs font-semibold tabular-nums text-muted-foreground">
                        {percentage}%
                      </span>
                    </div>
                    <span className="hidden text-end text-sm font-bold tabular-nums text-foreground sm:block">
                      {count.toLocaleString(locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPageApp() {
  return (
    <RequireAuth>
      <DashboardChrome currentPath="/dashboard">
        <DashboardOverview />
      </DashboardChrome>
    </RequireAuth>
  );
}

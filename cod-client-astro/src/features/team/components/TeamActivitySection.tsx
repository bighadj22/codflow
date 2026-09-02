import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useLocale, useT } from "@/i18n/react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { listUserActivityLogs } from "@/features/team/api";
import {
  activityActionLabel,
  activityEntityLabel,
  formatRelativeTime,
  parseActivityMeta,
} from "@/features/team/model";
import type { ActivityLog } from "@/features/team/types";
import {
  entityConfig,
  MetadataHint,
} from "@/features/team/components/TeamMemberBadges";

const PAGE_SIZE = 30;

export function ActivityRow({
  log,
  locale,
}: {
  log: ActivityLog;
  locale: "ar" | "en" | "fr";
}) {
  const t = useT("team");
  const config = entityConfig(log.entityType);
  const meta = parseActivityMeta(log.metadata);
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg border ${config.bgColor} ${config.color}`}>
            {config.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {activityActionLabel(log.action, t)}
            </p>
            {log.entityLabel && (
              <p className={`truncate text-xs font-semibold ${config.color}`}>
                {log.entityLabel}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.bgColor} ${config.color}`}>
          {activityEntityLabel(log.entityType, t)}
        </span>
      </TableCell>
      <TableCell>
        <MetadataHint action={log.action} meta={meta} locale={locale} />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <Clock size={11} className="text-primary/40" />
          {formatRelativeTime(log.createdAt, locale)}
        </span>
      </TableCell>
    </TableRow>
  );
}

export function ActivityMobileCard({
  log,
  locale,
}: {
  log: ActivityLog;
  locale: "ar" | "en" | "fr";
}) {
  const t = useT("team");
  const config = entityConfig(log.entityType);
  const meta = parseActivityMeta(log.metadata);
  const hasHint =
    meta &&
    ((["order.status_changed", "driver.status_changed", "product.status_changed"].includes(log.action) && meta.status) ||
    (log.action === "stock.adjusted" && meta.delta !== undefined) ||
    (["user.scope_granted", "user.scope_revoked"].includes(log.action) && meta.scope) ||
    (log.action === "user.role_changed" && meta.role) ||
    (["review.approved", "review.rejected", "review.deleted"].includes(log.action) && meta.rating));
  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.bgColor} ${config.color}`}>
          {activityEntityLabel(log.entityType, t)}
        </span>
        <span className="whitespace-nowrap text-[10px] font-bold text-muted-foreground/50">
          {formatRelativeTime(log.createdAt, locale)}
        </span>
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border ${config.bgColor} ${config.color}`}>
          {config.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-foreground">
            {activityActionLabel(log.action, t)}
          </p>
          {log.entityLabel && (
            <p className={`truncate text-xs font-semibold ${config.color}`}>
              {log.entityLabel}
            </p>
          )}
        </div>
      </div>
      {hasHint ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <span className={`grid size-6 shrink-0 place-items-center rounded-lg ${config.bgColor}`}>
            {config.icon}
          </span>
          <span className="min-w-0 flex-1 text-xs font-semibold text-foreground/80">
            <MetadataHint action={log.action} meta={meta} locale={locale} />
          </span>
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2 text-[10px] text-muted-foreground/40">
        <Clock size={10} className="shrink-0" />
        <span dir="ltr">{log.createdAt}</span>
      </div>
    </article>
  );
}

export function TeamActivitySection({ memberId }: { memberId: string }) {
  const t = useT("team");
  const common = useT("common");
  const locale = useLocale();
  const [logs, setLogs] = useState<ActivityLog[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entityType, setEntityType] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function load(offset = 0, append = false) {
    if (!append) setLoadError(null);
    try {
      const data = await listUserActivityLogs(memberId, {
        limit: PAGE_SIZE,
        offset,
      });
      setLogs((current) => (append ? [...(current ?? []), ...data] : data));
      setHasMore(data.length === PAGE_SIZE);
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    void load(0, false);
  }, [memberId]);

  async function loadMore() {
    if (loadingMore || logs === null) return;
    setLoadingMore(true);
    await load(logs.length, true);
    setLoadingMore(false);
  }

  const filtered = useMemo(() => {
    if (!logs) return [];
    const q = search.trim().toLocaleLowerCase();
    return logs.filter((log) => {
      if (entityType !== "all" && log.entityType !== entityType) return false;
      if (q && !activityActionLabel(log.action, t).toLocaleLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, entityType, search, t]);

  const entityTypes = useMemo(
    () => (logs ? [...new Set(logs.map((log) => log.entityType))].sort() : []),
    [logs],
  );

  if (loadError)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("error_load")}</p>
          <button
            type="button"
            onClick={() => void load(0, false)}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  if (logs === null)
    return (
      <div role="status" aria-busy="true" className="h-64 animate-pulse rounded-xl bg-muted" />
    );

  return (
    <Card
      title={t("activity_log.title")}
      action={
        <span className="text-xs font-semibold text-muted-foreground">
          {logs.length} {t("activity_log.stats.actions")}
        </span>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label={t("activity_log.filters.type")}
          value={entityType}
          onChange={(event) => setEntityType(event.currentTarget.value)}
          wrapperClassName="sm:w-52"
        >
          <option value="all">{common("table.all")}</option>
          {entityTypes.map((type) => (
            <option key={type} value={type}>
              {activityEntityLabel(type, t)}
            </option>
          ))}
        </Select>
        <label className="relative block min-w-0 flex-1">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder={t("activity_log.search_placeholder")}
            className="h-10 w-full rounded-lg border border-input bg-background ps-3 pe-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Activity size={22} />}
          title={t("activity_log.empty")}
        />
      ) : (
        <>
          <div className="divide-y divide-border md:hidden">
            {filtered.map((log) => (
              <ActivityMobileCard key={log.id} log={log} locale={locale} />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activity_log.table.action")}</TableHead>
                  <TableHead>{t("activity_log.table.type")}</TableHead>
                  <TableHead>{t("activity_log.table.details")}</TableHead>
                  <TableHead>{t("activity_log.table.time")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <ActivityRow key={log.id} log={log} locale={locale} />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {hasMore && (
        <div className="flex justify-center border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            <RefreshCw size={14} className={loadingMore ? "animate-spin" : ""} />
            {loadingMore ? t("activity_log.loading") : t("activity_log.load_more")}
          </Button>
        </div>
      )}
    </Card>
  );
}

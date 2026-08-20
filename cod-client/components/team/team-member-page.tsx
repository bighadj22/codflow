"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  User as UserIcon,
  Package,
  Users,
  Truck,
  ShoppingBag,
  UserCog,
  RefreshCw,
  Shield,
  CalendarDays,
  Mail,
  Clock,
  Activity,
  User,
  Star,
  Boxes,
} from "lucide-react";
import { getUserActivityLogs, type ActivityLog } from "@/actions/activity-logs";
import type { User as TeamUser } from "@/actions/users";
import { useTeam, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { DataTable, type TableColumn } from "@/components/ui/data-table";

interface TeamMemberPageProps {
  user: TeamUser;
  initialLogs: ActivityLog[];
  isAdmin: boolean;
}

const PAGE_SIZE = 30;

const ENTITY_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  order:    { icon: <Package className="w-3.5 h-3.5" />,      color: "text-blue-600",    bgColor: "bg-blue-500/10 border-blue-500/20" },
  customer: { icon: <Users className="w-3.5 h-3.5" />,        color: "text-purple-600",  bgColor: "bg-purple-500/10 border-purple-500/20" },
  driver:   { icon: <Truck className="w-3.5 h-3.5" />,        color: "text-emerald-600", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  product:  { icon: <ShoppingBag className="w-3.5 h-3.5" />,  color: "text-orange-600",  bgColor: "bg-orange-500/10 border-orange-500/20" },
  stock:    { icon: <Boxes className="w-3.5 h-3.5" />,        color: "text-cyan-600",    bgColor: "bg-cyan-500/10 border-cyan-500/20" },
  user:     { icon: <UserCog className="w-3.5 h-3.5" />,      color: "text-rose-600",    bgColor: "bg-rose-500/10 border-rose-500/20" },
  review:   { icon: <Star className="w-3.5 h-3.5" />,         color: "text-amber-600",   bgColor: "bg-amber-500/10 border-amber-500/20" },
};

export function TeamMemberPage({ user, initialLogs, isAdmin }: TeamMemberPageProps) {
  const t = useTeam();
  const common = useCommon();
  const { locale } = useLanguage();
  const timeLocale = locale === "ar" ? "ar" : "en";

  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [hasMore, setHasMore] = useState(initialLogs.length === PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await getUserActivityLogs(user.id, { limit: PAGE_SIZE, offset: logs.length });
      setLogs((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [user.id, logs.length, loadingMore]);

  const lastActive = logs.length > 0 ? logs[0].createdAt : null;

  const getActionLabel = (action: string) =>
    (t as any).activity_log?.actions?.[action] ?? action;

  const parseMetadata = (raw: string | null): Record<string, unknown> | null => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const renderMetadataHint = (action: string, meta: Record<string, unknown> | null) => {
    if (!meta) return null;
    if ((action === "order.status_changed" || action === "driver.status_changed" || action === "product.status_changed") && meta.status) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
          {(common.statuses as any)[meta.status as string] ?? String(meta.status)}
        </span>
      );
    }
    if (action === "stock.adjusted" && meta.delta !== undefined) {
      const delta = Number(meta.delta);
      const stockType = meta.stockType != null ? String(meta.stockType) : null;
      const reason = meta.reason != null ? String(meta.reason) : null;
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("text-[10px] font-black tabular-nums", delta >= 0 ? "text-emerald-600" : "text-rose-500")}>
            {delta >= 0 ? "+" : ""}{delta.toLocaleString("ar-DZ")}
          </span>
          {stockType && (
            <span className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">
              {stockType}
            </span>
          )}
          {reason && (
            <span className="text-[10px] text-muted-foreground/60 font-medium">
              · {reason}
            </span>
          )}
        </span>
      );
    }
    if ((action === "user.scope_granted" || action === "user.scope_revoked") && meta.scope) {
      return (
        <span className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">
          {String(meta.scope)}
        </span>
      );
    }
    if (action === "user.role_changed" && meta.role) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-500/10 text-yellow-700">
          {(common.roles as any)[meta.role as string] ?? String(meta.role)}
        </span>
      );
    }
    if ((action === "review.approved" || action === "review.rejected" || action === "review.deleted") && meta.rating) {
      const rating = Number(meta.rating);
      return (
        <span className="inline-flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={cn(
                "w-2.5 h-2.5",
                s <= rating ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/30"
              )}
            />
          ))}
        </span>
      );
    }
    return null;
  };

  // Table columns for activity logs
  const columns: TableColumn<ActivityLog>[] = [
    {
      key: "action",
      label: (t as any).activity_log?.table?.action ?? "Action",
      sortable: true,
      isTitle: true,
      render: (value, row) => {
        const config = ENTITY_CONFIG[row.entityType] ?? ENTITY_CONFIG.order;
        return (
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-sm",
                config.bgColor,
                config.color,
              )}
            >
              {config.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground leading-snug truncate">
                {getActionLabel(value)}
              </p>
              {row.entityLabel && (
                <p className={cn("text-[11px] font-black mt-0.5 uppercase tracking-tighter truncate", config.color)}>
                  {row.entityLabel}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "entityType",
      label: (t as any).activity_log?.table?.type ?? "Type",
      sortable: true,
      isStatus: true,
      render: (value) => {
        const config = ENTITY_CONFIG[value] ?? ENTITY_CONFIG.order;
        return (
          <Badge
            variant="secondary"
            className={cn(
              "text-[9px] font-black uppercase tracking-widest py-0.5 px-2 border-none",
              config.bgColor,
              config.color,
            )}
          >
            {(t as any).activity_log?.filters?.[value] ?? value}
          </Badge>
        );
      },
    },
    {
      key: "metadata",
      label: (t as any).activity_log?.table?.details ?? "Details",
      render: (_value, row) => {
        const meta = parseMetadata(row.metadata);
        const hint = renderMetadataHint(row.action, meta);
        return hint ? <div className="flex items-center gap-2">{hint}</div> : <span className="text-muted-foreground/20 text-sm select-none">—</span>;
      },
      tabletHidden: true,
    },
    {
      key: "createdAt",
      label: (t as any).activity_log?.table?.time ?? "Time",
      sortable: true,
      render: (value) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
            <Clock size={10} className="text-primary/40" />
            {formatRelativeTime(value, timeLocale)}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums" dir="ltr">
            {formatDateTime(value).split(" ").slice(1).join(" ")}
          </span>
        </div>
      ),
    },
  ];

  // Filter options for entity types
  const entityTypeOptions = useMemo(() => {
    const types = [...new Set(logs.map((l) => l.entityType))];
    return types.map((type) => ({
      label: (t as any).activity_log?.filters?.[type] ?? type,
      value: type,
    }));
  }, [logs, t]);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Action row */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/team"
          className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
        
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/5 border border-primary/10 rounded-xl">
          <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
          <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-primary/80">
            {logs.length} {(t as any).activity_log?.stats?.actions ?? "Activities"}
          </p>
        </div>
      </div>

      {/* Hero Glass Card */}
      <div className="group relative glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-sm transition-all duration-500 hover:shadow-premium">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[80px] pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 duration-700" />
        
        <div className="relative z-10 p-5 sm:p-8">
          <div className="flex items-start gap-4 sm:gap-6 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-inner group-hover:scale-105 transition-transform duration-500",
                user.role === "admin" ? "bg-primary" : "bg-muted text-muted-foreground/40"
              )}>
                {user.role === "admin" ? <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-white" /> : <UserIcon className="w-8 h-8 sm:w-10 sm:h-10" />}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-background rounded-xl flex items-center justify-center border border-border/50 shadow-sm">
                <User size={12} className="sm:size-14 text-primary/70" />
              </div>
            </div>
            
            <div className="space-y-2 sm:space-y-3 min-w-0 flex-1">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight font-display truncate">
                  {user.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-muted-foreground/70" dir="ltr">
                    <Mail size={12} className="text-primary/40" />
                    {user.email}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-0 h-5 border-none",
                      user.role === "admin"
                        ? "bg-yellow-500/10 text-yellow-700"
                        : "bg-muted/50 text-muted-foreground/70",
                    )}
                  >
                    {(common.roles as any)[user.role] ?? user.role}
                  </Badge>
                  <StatusBadge status={user.status} className="py-0.5 px-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-border/10">
            <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm">
              <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                <CalendarDays className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
                Joined
              </p>
              <p className="text-sm sm:text-base font-black text-foreground font-display leading-none">
                {formatDate(user.createdAt)}
              </p>
            </div>
            <div className="bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm">
              <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/50" />
                Scopes
              </p>
              <p className="text-sm sm:text-base font-black text-foreground font-display leading-none tabular-nums">
                {Array.isArray(user.scopes) ? user.scopes.length : 0}
              </p>
            </div>
            <div className="hidden sm:block bg-muted/20 border border-border/10 rounded-xl p-3 sm:p-4 transition-all hover:bg-primary/[0.02] hover:border-primary/10 shadow-sm">
              <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1.5">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500/50" />
                Active
              </p>
              <p className="text-sm sm:text-base font-black text-foreground font-display leading-none truncate">
                {lastActive ? formatRelativeTime(lastActive, timeLocale) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log Table */}
      {isAdmin && (
        <DataTable
          data={logs}
          columns={columns}
          searchable={true}
          searchPlaceholder={(t as any).activity_log?.search_placeholder ?? "Search activities..."}
          filterable={entityTypeOptions.length > 1}
          filters={[
            {
              key: "entityType",
              label: (t as any).activity_log?.filters?.type ?? "Type",
              options: entityTypeOptions,
            },
          ]}
          pagination={false}
          emptyMessage={(t as any).activity_log?.empty ?? "No activity recorded yet"}
          emptyState={
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-4 opacity-20">
                <Activity size={28} />
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40 max-w-xs mx-auto">
                {(t as any).activity_log?.empty ?? "No activity recorded yet"}
              </p>
            </div>
          }
          renderMobileCard={(log) => {
            const config = ENTITY_CONFIG[log.entityType] ?? ENTITY_CONFIG.order;
            const meta = parseMetadata(log.metadata);
            const hint = renderMetadataHint(log.action, meta);
            
            return (
              <div className="flex flex-col gap-3 py-0.5">
                {/* Row 1: Type badge + Time */}
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest py-1 px-2.5 border-none",
                      config.bgColor,
                      config.color,
                    )}
                  >
                    {(t as any).activity_log?.filters?.[log.entityType] ?? log.entityType}
                  </Badge>
                  <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums whitespace-nowrap" dir="ltr">
                    {formatRelativeTime(log.createdAt, timeLocale)}
                  </span>
                </div>

                {/* Row 2: Action name (main title) */}
                <p className="text-[16px] font-black text-foreground tracking-tight leading-snug">
                  {getActionLabel(log.action)}
                </p>

                {/* Row 3: Entity label if exists */}
                {log.entityLabel && (
                  <p className={cn("text-[13px] font-black uppercase tracking-tight -mt-1.5", config.color)}>
                    {log.entityLabel}
                  </p>
                )}

                {/* Row 4: Details section */}
                {hint && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/20">
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", config.bgColor)}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50">
                        {(t as any).activity_log?.table?.details ?? "Details"}
                      </p>
                      <div className="text-[12px] font-semibold text-foreground/80 mt-0.5">
                        {hint}
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 5: Full timestamp */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-border/10">
                  <Clock size={10} className="text-muted-foreground/30 shrink-0" />
                  <span className="text-[10px] font-semibold text-muted-foreground/40 tabular-nums" dir="ltr">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* Load More Button */}
      {isAdmin && hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            variant="outline"
            className="h-10 rounded-xl border-border/60 font-black text-[11px] uppercase tracking-widest hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95"
          >
            {loadingMore ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 me-2 animate-spin" />
                {(t as any).activity_log?.loading ?? "Loading..."}
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 me-2" />
                {(t as any).activity_log?.load_more ?? "Load more activity"}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

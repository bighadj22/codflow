"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Package,
  Users,
  Truck,
  ShoppingBag,
  UserCog,
  Crown,
  User as UserIcon,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { getUserActivityLogs, type ActivityLog } from "@/actions/activity-logs";
import type { User } from "@/actions/users";
import { useTeam, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ActivityLogSheetProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

const ENTITY_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  order:    { icon: <Package className="w-3.5 h-3.5" />,  color: "text-blue-600",    bgColor: "bg-blue-500/10 border-blue-500/20" },
  customer: { icon: <Users className="w-3.5 h-3.5" />,   color: "text-purple-600",  bgColor: "bg-purple-500/10 border-purple-500/20" },
  driver:   { icon: <Truck className="w-3.5 h-3.5" />,   color: "text-emerald-600", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  product:  { icon: <ShoppingBag className="w-3.5 h-3.5" />, color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/20" },
  user:     { icon: <UserCog className="w-3.5 h-3.5" />, color: "text-rose-600",    bgColor: "bg-rose-500/10 border-rose-500/20" },
};

const PAGE_SIZE = 20;

export function ActivityLogSheet({ user, open, onClose }: ActivityLogSheetProps) {
  const t = useTeam();
  const common = useCommon();
  const { dir } = useLanguage();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (userId: string, offset = 0) => {
    try {
      const data = await getUserActivityLogs(userId, { limit: PAGE_SIZE, offset });
      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  useEffect(() => {
    if (!open || !user) {
      setLogs([]);
      setHasMore(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetchLogs(user.id)
      .then((data) => {
        setLogs(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => setError("Failed to load activity"))
      .finally(() => setLoading(false));
  }, [open, user, fetchLogs]);

  const loadMore = async () => {
    if (!user || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchLogs(user.id, logs.length);
      setLogs((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silently fail — existing entries still shown
    } finally {
      setLoadingMore(false);
    }
  };

  const getActionLabel = (action: string): string => {
    const actions = (t as any).activity_log?.actions ?? {};
    return actions[action] ?? action;
  };

  const getEntityConfig = (entityType: string) =>
    ENTITY_CONFIG[entityType] ?? ENTITY_CONFIG.order;

  const parseMetadata = (raw: string | null): Record<string, unknown> | null => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const renderMetadataHint = (action: string, meta: Record<string, unknown> | null) => {
    if (!meta) return null;

    if (action === "order.status_changed" && meta.status) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
          {(common.statuses as any)[meta.status as string] ?? String(meta.status)}
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
    if ((action === "product.status_changed") && meta.status) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
          {(common.statuses as any)[meta.status as string] ?? String(meta.status)}
        </span>
      );
    }
    if (action === "driver.status_changed" && meta.status) {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
          {(common.statuses as any)[meta.status as string] ?? String(meta.status)}
        </span>
      );
    }
    return null;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 w-full max-w-md bg-background border-l border-border/50 shadow-2xl flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <UserCog className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-black text-sm text-foreground">
                  {user?.name ?? ""}
                </p>
                {user?.role === "admin" ? (
                  <Crown className="w-3.5 h-3.5 text-yellow-500" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest py-0 h-4",
                    user?.role === "admin"
                      ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/20"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {(common.roles as any)[user?.role ?? ""] ?? user?.role}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                {(t as any).activity_log?.title ?? "Activity Log"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-lg bg-muted/50 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-3 bg-muted/50 rounded-md w-3/4" />
                    <div className="h-2.5 bg-muted/40 rounded-md w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6">
              <RefreshCw className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-bold text-muted-foreground">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                <UserCog className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">
                {(t as any).activity_log?.empty ?? "No activity yet"}
              </p>
            </div>
          ) : (
            <div className="relative p-5">
              {/* Vertical timeline line */}
              <div className="absolute top-5 bottom-5 start-[calc(1.25rem+14px)] w-px bg-border/40" />

              <div className="space-y-0">
                {logs.map((log, index) => {
                  const config = getEntityConfig(log.entityType);
                  const meta = parseMetadata(log.metadata);
                  const isLast = index === logs.length - 1;

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-3 relative",
                        !isLast && "pb-4",
                      )}
                    >
                      {/* Icon dot */}
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 z-10 bg-background",
                          config.bgColor,
                          config.color,
                        )}
                      >
                        {config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[12.5px] font-bold text-foreground leading-snug">
                          {getActionLabel(log.action)}
                        </p>

                        {log.entityLabel && (
                          <p className={cn(
                            "text-[11px] font-semibold truncate mt-0.5",
                            config.color,
                          )}>
                            {log.entityLabel}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {renderMetadataHint(log.action, meta)}
                          <span className="text-[10px] font-bold text-muted-foreground/50">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className={cn("mt-4 flex", dir === "rtl" ? "justify-end" : "justify-start", "ps-10")}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    {(t as any).activity_log?.load_more ?? "Load more"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — entry count */}
        {!loading && logs.length > 0 && (
          <div className="px-5 py-3 border-t border-border/30 shrink-0">
            <p className="text-[10px] font-bold text-muted-foreground/40 text-center uppercase tracking-widest">
              {logs.length} {(t as any).activity_log?.title?.toLowerCase() ?? "entries"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

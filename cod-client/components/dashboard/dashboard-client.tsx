"use client";

import {
  ShoppingBag,
  Sparkles,
  BadgeCheck,
  PhoneOff,
  Package,
  PackageCheck,
  UserCheck,
  Send,
  Truck,
  CheckCircle2,
  Undo2,
  Ban,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OrderStatusStat } from "@/../cod-shared/queries/analytics";

const ORDER_STATUSES = [
  "new",
  "confirmed",
  "unreachable",
  "preparing",
  "ready",
  "assigned",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "returned",
  "cancelled",
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

interface StatusConfig {
  icon: LucideIcon;
  iconBg: string;
  bgClass: string;
  subColor: string;
}

const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  new: {
    icon: Sparkles,
    iconBg: "bg-green-500 shadow-lg shadow-green-500/20",
    bgClass: "from-green-500/10 via-green-500/5 to-transparent",
    subColor: "text-green-600 dark:text-green-400",
  },
  confirmed: {
    icon: BadgeCheck,
    iconBg: "bg-blue-500 shadow-lg shadow-blue-500/20",
    bgClass: "from-blue-500/10 via-blue-500/5 to-transparent",
    subColor: "text-blue-600 dark:text-blue-400",
  },
  unreachable: {
    icon: PhoneOff,
    iconBg: "bg-orange-500 shadow-lg shadow-orange-500/20",
    bgClass: "from-orange-500/10 via-orange-500/5 to-transparent",
    subColor: "text-orange-600 dark:text-orange-400",
  },
  preparing: {
    icon: Package,
    iconBg: "bg-violet-500 shadow-lg shadow-violet-500/20",
    bgClass: "from-violet-500/10 via-violet-500/5 to-transparent",
    subColor: "text-violet-600 dark:text-violet-400",
  },
  ready: {
    icon: PackageCheck,
    iconBg: "bg-indigo-500 shadow-lg shadow-indigo-500/20",
    bgClass: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    subColor: "text-indigo-600 dark:text-indigo-400",
  },
  assigned: {
    icon: UserCheck,
    iconBg: "bg-purple-500 shadow-lg shadow-purple-500/20",
    bgClass: "from-purple-500/10 via-purple-500/5 to-transparent",
    subColor: "text-purple-600 dark:text-purple-400",
  },
  dispatched: {
    icon: Send,
    iconBg: "bg-cyan-500 shadow-lg shadow-cyan-500/20",
    bgClass: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    subColor: "text-cyan-600 dark:text-cyan-400",
  },
  out_for_delivery: {
    icon: Truck,
    iconBg: "bg-amber-500 shadow-lg shadow-amber-500/20",
    bgClass: "from-amber-500/10 via-amber-500/5 to-transparent",
    subColor: "text-amber-600 dark:text-amber-400",
  },
  delivered: {
    icon: CheckCircle2,
    iconBg: "bg-emerald-500 shadow-lg shadow-emerald-500/20",
    bgClass: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    subColor: "text-emerald-600 dark:text-emerald-400",
  },
  returned: {
    icon: Undo2,
    iconBg: "bg-rose-500 shadow-lg shadow-rose-500/20",
    bgClass: "from-rose-500/10 via-rose-500/5 to-transparent",
    subColor: "text-rose-600 dark:text-rose-400",
  },
  cancelled: {
    icon: Ban,
    iconBg: "bg-slate-500 shadow-lg shadow-slate-500/20",
    bgClass: "from-slate-500/10 via-slate-500/5 to-transparent",
    subColor: "text-slate-600 dark:text-slate-400",
  },
};

interface DashboardClientProps {
  statusStats: OrderStatusStat[];
}

export function DashboardClient({ statusStats }: DashboardClientProps) {
  const t = useDashboard();
  const common = useCommon();
  const { locale, dir } = useLanguage();

  const statsMap = Object.fromEntries(statusStats.map((s) => [s.status, s.count]));
  const total = statusStats.reduce((sum, s) => sum + s.count, 0);
  const fmt = (n: number) =>
    n.toLocaleString(locale === "ar" ? "ar-DZ" : "en");

  // Tooltip descriptions keyed by status (+ total_orders)
  const tooltips = t.status_tooltips as Record<string, string>;

  return (
    <div className="space-y-8 pb-12 pt-4 relative">
      {/* Ambient glows — low opacity per style guide */}
      <div className="absolute top-[-10%] left-[20%] w-[30%] h-[20%] bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-[25%] h-[15%] bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/*
        12-card grid:
        · Mobile  → 1 col  (cards stacked, full width)
        · sm      → 2 cols
        · md      → 3 cols
        · lg      → 4 cols  (3 rows of 4 = 12 exact)
      */}
      <TooltipProvider delay={400}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6 relative z-10">

          {/* ── Card 1: Total Orders ──────────────────────────────── */}
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  className="animate-fade-in-up group relative overflow-hidden glass-card rounded-[2.5rem] p-6 sm:p-7 border-white/40 dark:border-white/5 transition-all duration-700 hover:shadow-xl hover:-translate-y-2 hover:border-primary/30 cursor-default"
                  style={{ animationDelay: "0ms" }}
                />
              }
            >
              <div className="absolute inset-0 bg-noise opacity-[0.02] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <div className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-70 transition-opacity bg-primary shadow-lg shadow-primary/20" />
                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 relative z-10 shadow-lg bg-primary shadow-primary/20">
                      <ShoppingBag size={22} className="text-white" />
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-muted/20 group-hover:bg-primary/10 transition-all duration-500 group-hover:rotate-45">
                    <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-1.5">
                    {t.stats.total_orders}
                  </p>
                  <p className="text-3xl sm:text-4xl font-black leading-none tracking-tighter text-foreground">
                    {fmt(total)}
                  </p>
                </div>
                <div className="h-[38px]" />
              </div>
            </TooltipTrigger>

            <TooltipContent
              side="bottom"
              className="max-w-[220px] rounded-2xl px-4 py-3"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-1">
                {t.stats.total_orders}
              </p>
              <p className="text-xs leading-relaxed" dir={dir}>
                {tooltips.total_orders}
              </p>
            </TooltipContent>
          </Tooltip>

          {/* ── Cards 2–12: One per order status ─────────────────── */}
          {ORDER_STATUSES.map((status, i) => {
            const count = statsMap[status] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const { icon: Icon, iconBg, bgClass, subColor } = STATUS_CONFIG[status];
            const label =
              (common.statuses as Record<string, string>)[status] ?? status;

            return (
              <Tooltip key={status}>
                <TooltipTrigger
                  render={
                    <div
                      className={cn(
                        "animate-fade-in-up group relative overflow-hidden",
                        "glass-card rounded-[2.5rem] p-6 sm:p-7 border-white/40 dark:border-white/5",
                        "transition-all duration-700 hover:shadow-xl hover:-translate-y-2 cursor-default",
                        count === 0 && "opacity-50",
                      )}
                      style={{ animationDelay: `${(i + 1) * 60}ms` }}
                    />
                  }
                >
                  <div className="absolute inset-0 bg-noise opacity-[0.02] pointer-events-none" />
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700",
                      bgClass,
                    )}
                  />

                  <div className="relative z-10 space-y-5">
                    {/* Icon + arrow */}
                    <div className="flex items-center justify-between">
                      <div className="relative">
                        <div className={cn("absolute inset-0 blur-xl opacity-40 group-hover:opacity-70 transition-opacity", iconBg)} />
                        <div className={cn("w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 relative z-10", iconBg)}>
                          <Icon size={22} className="text-white" />
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-muted/20 group-hover:bg-white/20 transition-all duration-500 group-hover:rotate-45">
                        <ArrowUpRight size={16} className="text-muted-foreground/50 group-hover:text-foreground/60 transition-colors" />
                      </div>
                    </div>

                    {/* Label + count */}
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-1.5">
                        {label}
                      </p>
                      <p className="text-3xl sm:text-4xl font-black leading-none tracking-tighter text-foreground">
                        {fmt(count)}
                      </p>
                    </div>

                    {/* Percentage sub-stat pill */}
                    {total > 0 ? (
                      <div className="flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 w-fit group-hover:border-white/30 transition-all duration-500 shadow-sm">
                        <TrendingUp size={14} className={subColor} />
                        <span className={cn("text-[11px] font-black uppercase tracking-widest", subColor)}>
                          {pct}%
                        </span>
                      </div>
                    ) : (
                      <div className="h-[38px]" />
                    )}
                  </div>
                </TooltipTrigger>

                <TooltipContent
                  side="bottom"
                  className="max-w-[220px] rounded-2xl px-4 py-3"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-1">
                    {label}
                  </p>
                  <p className="text-xs leading-relaxed" dir={dir}>
                    {tooltips[status]}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

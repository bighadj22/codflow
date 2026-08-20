import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "group relative bg-card rounded-2xl border border-border/50 p-6 transition-all duration-300",
      "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1",
      "overflow-hidden",
      className
    )}>
      {/* Decorative Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-0" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
            <Icon size={22} className="text-primary" />
          </div>
          {trend && (
            <div
              className={cn(
                "text-[11px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm",
                trend.isPositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {trend.value}
            </div>
          )}
        </div>
        <div>
          <p className="text-3xl font-black text-foreground mb-1 tracking-tight group-hover:text-primary transition-colors duration-300">
            {value}
          </p>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest opacity-70">
            {title}
          </p>
        </div>
      </div>
    </div>
  );
}

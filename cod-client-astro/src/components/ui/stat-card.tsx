import type { ReactNode } from "react";

export type StatCardTone =
  | "neutral"
  | "success"
  | "warning"
  | "critical"
  | "brand";

const tones: Record<StatCardTone, string> = {
  neutral: "border-border/60 bg-muted/60 text-muted-foreground",
  success:
    "border-[var(--status-delivered-border)] bg-[var(--status-delivered-bg)] text-[var(--status-delivered-text)]",
  warning:
    "border-[var(--status-preparing-border)] bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)]",
  critical:
    "border-[var(--status-returned-border)] bg-[var(--status-returned-bg)] text-[var(--status-returned-text)]",
  brand: "border-brand/25 bg-brand/10 text-brand",
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: StatCardTone;
}) {
  return (
    <section className="flex items-center gap-3.5 rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-border">
      {icon && (
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-lg border shadow-2xs ${tones[tone]}`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {hint && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    </section>
  );
}

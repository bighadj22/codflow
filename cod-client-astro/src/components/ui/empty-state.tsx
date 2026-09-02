import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center ${
        compact ? "min-h-32 py-6" : "min-h-52 py-10"
      }`}
    >
      <span className="grid size-12 place-items-center rounded-2xl border border-border/80 bg-muted/40 text-muted-foreground shadow-2xs">
        {icon}
      </span>
      <h2 className="mt-3.5 text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

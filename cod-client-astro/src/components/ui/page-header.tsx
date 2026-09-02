import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {backHref && (
          <a
            href={backHref}
            aria-label={backLabel}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-2xs transition-all hover:bg-muted hover:text-foreground active:scale-[0.98]"
          >
            <ArrowLeft
              size={16}
              className="rtl:rotate-180"
              aria-hidden="true"
            />
          </a>
        )}
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}

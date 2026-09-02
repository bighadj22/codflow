import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "critical"
  | "info"
  | "brand";

export type BadgeSize = "default" | "sm";

const tones: Record<BadgeTone, string> = {
  neutral:
    "border-[var(--status-new-border)] bg-[var(--status-new-bg)] text-[var(--status-new-text)]",
  success:
    "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]",
  warning:
    "border-[var(--status-preparing-border)] bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)]",
  critical:
    "border-[var(--status-returned-border)] bg-[var(--status-returned-bg)] text-[var(--status-returned-text)]",
  info:
    "border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]",
  brand:
    "border-brand/25 bg-brand/10 text-brand dark:bg-brand/20",
};

const sizes: Record<BadgeSize, string> = {
  default: "min-h-[22px] px-2 py-0.5 text-xs",
  sm: "min-h-[18px] px-1.5 py-0.2 text-[10.5px]",
};

export function Badge({
  children,
  tone = "neutral",
  size = "default",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold tracking-normal transition-colors select-none ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {dot && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

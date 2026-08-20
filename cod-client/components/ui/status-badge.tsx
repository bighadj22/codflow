"use client";

import { cn } from "@/lib/utils";
import { useCommon } from "@/lib/translations";

// Maps any status string to a CSS var key defined in globals.css
const STATUS_VAR_KEY: Record<string, string> = {
  // Order statuses
  new:              "new",
  confirmed:        "confirmed",
  unreachable:      "unreachable",
  preparing:        "preparing",
  ready:            "ready",
  assigned:         "assigned",
  dispatched:       "dispatched",
  out_for_delivery: "out",
  delivered:        "delivered",
  returned:         "returned",
  cancelled:        "cancelled",
  // Driver statuses
  available:        "delivered",
  active:           "delivered",
  busy:             "out",
  inactive:         "cancelled",
  offline:          "cancelled",
  // Product / user statuses
  suspended:        "returned",
  out_of_stock:     "returned",
  low_stock:        "out",
  discontinued:     "cancelled",
  // Product catalog statuses (uppercase)
  ACTIVE:           "delivered",
  DRAFT:            "preparing",
  ARCHIVED:         "cancelled",
};

export interface StatusBadgeProps {
  status: string;
  /** Display label — if omitted, uses translated status from common.statuses */
  label?: string;
  /** Show the colored dot indicator (default: true) */
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const common = useCommon();
  const varKey = STATUS_VAR_KEY[status] ?? STATUS_VAR_KEY[status.toLowerCase()] ?? "cancelled";
  const displayLabel = label ?? (common.statuses as Record<string, string>)[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap shadow-sm",
        className
      )}
      style={{
        backgroundColor: `var(--status-${varKey}-bg)`,
        color: `var(--status-${varKey}-text)`,
        borderColor: `var(--status-${varKey}-border)`,
      }}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: `var(--status-dot-${varKey})` }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ backgroundColor: `var(--status-dot-${varKey})` }} />
        </span>
      )}
      {displayLabel}
    </span>
  );
}

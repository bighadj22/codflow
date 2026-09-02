import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export type AlertTone = "info" | "critical" | "warning" | "success";

const tones: Record<
  AlertTone,
  { container: string; icon: typeof Info }
> = {
  info: {
    container:
      "border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]",
    icon: Info,
  },
  critical: {
    container:
      "border-[var(--status-returned-border)] bg-[var(--status-returned-bg)] text-[var(--status-returned-text)]",
    icon: AlertCircle,
  },
  warning: {
    container:
      "border-[var(--status-preparing-border)] bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)]",
    icon: AlertTriangle,
  },
  success: {
    container:
      "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]",
    icon: CheckCircle2,
  },
};

export function Alert({
  children,
  tone = "info",
  role,
  className = "",
}: {
  children: ReactNode;
  tone?: AlertTone;
  role?: "alert" | "status";
  className?: string;
}) {
  const config = tones[tone];
  const Icon = config.icon;
  return (
    <div
      role={role}
      className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm shadow-2xs ${config.container} ${className}`}
    >
      <Icon
        size={18}
        className="mt-0.5 shrink-0 opacity-90"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

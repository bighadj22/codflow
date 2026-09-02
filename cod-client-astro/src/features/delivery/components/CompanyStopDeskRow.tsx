import { MapPin, ToggleLeft, ToggleRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui";
import { useT } from "@/i18n/react";
import { cn } from "@/lib/utils";
import type { StopDesk } from "@/features/delivery/types";

export function CompanyStopDeskDesktopRow({
  desk,
  wilayaName,
  canManage,
  togglingCode,
  onToggle,
}: {
  desk: StopDesk;
  wilayaName: string;
  canManage: boolean;
  togglingCode: string | null;
  onToggle: (desk: StopDesk) => void;
}) {
  const t = useT("delivery_companies");

  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-primary/5 text-primary/70">
            <MapPin size={15} aria-hidden="true" />
          </span>
          <span className="truncate text-sm font-semibold text-foreground">
            {desk.name}
          </span>
        </span>
      </TableCell>
      <TableCell>
        <span className="text-xs font-medium text-muted-foreground">
          {wilayaName}
        </span>
      </TableCell>
      <TableCell>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground/60">
          {desk.code}
        </span>
      </TableCell>
      <TableCell className="text-center">
        {canManage && (
          <button
            type="button"
            onClick={() => onToggle(desk)}
            disabled={togglingCode === desk.code}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              desk.active
                ? "border-border bg-muted/20 text-muted-foreground hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-500"
                : "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]",
              togglingCode === desk.code && "cursor-not-allowed opacity-40",
            )}
          >
            {desk.active ? (
              <ToggleRight size={12} aria-hidden="true" />
            ) : (
              <ToggleLeft size={12} aria-hidden="true" />
            )}
            {desk.active ? t("stop_desks_on") : t("stop_desks_off")}
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function CompanyStopDeskMobileCard({
  desk,
  wilayaName,
  canManage,
  togglingCode,
  onToggle,
}: {
  desk: StopDesk;
  wilayaName: string;
  canManage: boolean;
  togglingCode: string | null;
  onToggle: (desk: StopDesk) => void;
}) {
  const t = useT("delivery_companies");

  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-primary/5 text-primary/70">
          <MapPin size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{desk.name}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground/60">
            {wilayaName} · {desk.code}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => onToggle(desk)}
              disabled={togglingCode === desk.code}
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                desk.active
                  ? "border-border bg-muted/20 text-muted-foreground"
                  : "border-[var(--status-confirmed-border)] bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-text)]",
                togglingCode === desk.code && "cursor-not-allowed opacity-40",
              )}
            >
              {desk.active ? (
                <ToggleRight size={12} aria-hidden="true" />
              ) : (
                <ToggleLeft size={12} aria-hidden="true" />
              )}
              {desk.active ? t("stop_desks_on") : t("stop_desks_off")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

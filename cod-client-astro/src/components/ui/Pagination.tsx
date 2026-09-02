import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/react";

/**
 * Standard list pagination footer: a "Showing X to Y of Z" line plus
 * prev / next controls. All copy comes from the `common` namespace.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className = "",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const common = useT("common");
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div
      className={`flex flex-col gap-3 border-t border-border/70 p-3 text-xs font-medium text-muted-foreground sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <span>
        {common("table.showing")
          .replace("{from}", String(from))
          .replace("{to}", String(to))
          .replace("{total}", String(total))}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="grid size-8 place-items-center rounded-lg border border-border/80 bg-card text-foreground shadow-2xs transition-all hover:bg-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          aria-label={common("table.page")}
        >
          <ChevronLeft size={15} className="rtl:rotate-180" />
        </button>
        <span className="px-1 text-[13px] font-semibold text-foreground">
          {safePage}{" "}
          <span className="font-normal text-muted-foreground">
            {common("table.of")}
          </span>{" "}
          {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="grid size-8 place-items-center rounded-lg border border-border/80 bg-card text-foreground shadow-2xs transition-all hover:bg-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          aria-label={common("table.page")}
        >
          <ChevronRight size={15} className="rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}

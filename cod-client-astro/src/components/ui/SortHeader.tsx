import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "./table";

/**
 * Clickable, sort-aware table header. `sortKey` is generic so any list
 * domain (orders, drivers, offers, …) can reuse it — `onSort` receives it
 * back, and the active/direction props drive the icon + aria-sort state.
 */
export function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "start",
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  direction: "asc" | "desc";
  onSort: (key: string) => void;
  align?: "start" | "end";
}) {
  const isSorted = activeKey === sortKey;
  const Icon = !isSorted
    ? ArrowUpDown
    : direction === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <TableHead
      aria-sort={
        isSorted
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={align === "end" ? "text-end" : "text-start"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex min-h-7 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors hover:text-foreground ${
          isSorted ? "text-foreground" : "text-muted-foreground"
        } ${align === "end" ? "justify-end" : "justify-start"}`}
      >
        <span>{label}</span>
        <Icon
          size={12}
          strokeWidth={2}
          className={`shrink-0 transition-all ${
            isSorted
              ? "text-brand opacity-100"
              : "opacity-40 group-hover:opacity-80"
          }`}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}

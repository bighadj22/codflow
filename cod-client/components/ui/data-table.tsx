"use client";

import { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n-context";
import { useCommon } from "@/lib/translations";

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
  mobileHidden?: boolean;
  tabletHidden?: boolean;
  /** For mobile card view: use as primary title */
  isTitle?: boolean;
  /** For mobile card view: use as subtitle */
  isSubtitle?: boolean;
  /** For mobile card view: use as status/badge area */
  isStatus?: boolean;
}

export interface TableAction<T = any> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  disabled?: (row: T) => boolean;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
  filters?: Array<{
    key: string;
    label: string;
    options: Array<{ label: string; value: string }>;
  }>;
  pagination?: boolean;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  className?: string;
  /** Optional custom renderer for mobile card view. If not provided, a default card will be generated. */
  renderMobileCard?: (row: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  searchable = true,
  searchPlaceholder = "Search...",
  filterable = false,
  filters = [],
  pagination = true,
  pageSize = 10,
  loading = false,
  emptyMessage = "No data available",
  emptyState,
  className,
  renderMobileCard
}: DataTableProps<T>) {
  const { dir } = useLanguage();
  const common = useCommon();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Filter and search data
  let filteredData = data;

  // Apply search
  if (searchQuery && searchable) {
    const searchableColumns = columns.filter(col => col.searchable !== false);
    filteredData = filteredData.filter(row =>
      searchableColumns.some(col => {
        const value = row[col.key];
        return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }

  // Apply filters
  Object.entries(activeFilters).forEach(([key, value]) => {
    if (value && value !== "all") {
      filteredData = filteredData.filter(row => row[key] === value);
    }
  });

  // Apply sorting
  if (sortColumn) {
    filteredData = [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = pagination 
    ? filteredData.slice(startIndex, startIndex + pageSize)
    : filteredData;

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-muted/60 animate-pulse rounded-lg" />
        <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-[0_2px_8px_0_rgb(0_0_0/0.06)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[52px] bg-muted/30 animate-pulse border-b border-border/30 last:border-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Filters */}
      {(searchable || filterable) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {searchable && (
            <div className="relative flex-1 group">
              <Search className={cn(
                "absolute top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary",
                dir === "rtl" ? "right-3.5" : "left-3.5"
              )} />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "bg-card border-border/60 shadow-xs h-10",
                  dir === "rtl" ? "pr-11" : "pl-11"
                )}
                dir={dir}
              />
            </div>
          )}

          {filterable && filters.map((filter) => (
            <Select
              key={filter.key}
              value={activeFilters[filter.key] || "all"}
              onValueChange={(value) =>
                setActiveFilters(prev => ({ ...prev, [filter.key]: value || "" }))
              }
            >
              <SelectTrigger className="w-full sm:w-48 bg-card border-border/60 shadow-xs h-10">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="truncate text-[13px] font-medium">
                    {(() => {
                      const active = activeFilters[filter.key];
                      if (!active || active === "all") return `${common.table.all} · ${filter.label}`;
                      return filter.options.find(o => o.value === active)?.label ?? filter.label;
                    })()}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{common.table.all} {filter.label}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}

      {/* Mobile Card View (shown only on mobile) */}
      <div className="md:hidden space-y-4">
        {paginatedData.length === 0 ? (
          emptyState ? (
            emptyState
          ) : (
            <div className="p-14 text-center bg-card rounded-xl border border-border/50 shadow-[0_2px_8px_0_rgb(0_0_0/0.05)]">
               <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
                  {emptyMessage}
               </div>
            </div>
          )
        ) : (
          paginatedData.map((row, index) => (
            <div key={index} className="group relative bg-card rounded-xl border border-border/50 p-5 shadow-[0_2px_6px_0_rgb(0_0_0/0.05)] hover:shadow-[0_4px_16px_0_rgb(0_0_0/0.08)] transition-all duration-200 active:scale-[0.99]">
               <div className="absolute inset-0 bg-primary/0 group-active:bg-primary/3 rounded-xl transition-colors pointer-events-none" />
               
               {renderMobileCard ? (
                 renderMobileCard(row)
               ) : (
                 <div className="relative z-10 space-y-4">
                   {/* Card Header: Title, Subtitle, Status, Actions */}
                   <div className="flex justify-between items-start gap-3">
                     <div className="flex-1 min-w-0 space-y-0.5">
                        {columns.filter(c => c.isTitle).map((col) => (
                          <div key={col.key} className="text-[15px] font-bold text-foreground truncate">
                             {col.render ? col.render(row[col.key], row) : row[col.key]}
                          </div>
                        ))}
                        {columns.filter(c => c.isSubtitle).map((col) => (
                          <div key={col.key} className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider truncate">
                             {col.render ? col.render(row[col.key], row) : row[col.key]}
                          </div>
                        ))}
                     </div>

                     <div className="flex flex-col items-end gap-2 shrink-0">
                        {columns.filter(c => c.isStatus).map((col) => (
                          <div key={col.key}>
                             {col.render ? col.render(row[col.key], row) : row[col.key]}
                          </div>
                        ))}
                        {actions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg bg-muted/40 hover:bg-muted transition-all" />}>
                              <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={dir === "rtl" ? "start" : "end"}>
                              {actions.map((action, actionIndex) => (
                                <DropdownMenuItem
                                  key={actionIndex}
                                  onClick={() => action.onClick(row)}
                                  disabled={action.disabled?.(row)}
                                >
                                  {action.icon}
                                  <span className={cn(dir === "rtl" ? "mr-2" : "ml-2")}>{action.label}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                     </div>
                   </div>

                   {/* Card Details Grid */}
                   <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/30">
                      {columns.filter(c => !c.isTitle && !c.isSubtitle && !c.isStatus && !c.mobileHidden).map((col) => (
                        <div key={col.key} className="space-y-1">
                           <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
                              {col.label}
                           </div>
                           <div className="text-[12px] font-semibold text-foreground/80">
                              {col.render ? col.render(row[col.key], row) : row[col.key]}
                           </div>
                        </div>
                      ))}
                   </div>
                 </div>
               )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden on mobile) */}
      <div className="hidden md:block glass-card rounded-2xl border-border/30 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full border-collapse" dir={dir}>
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "h-11 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap",
                      dir === "rtl" ? "text-right" : "text-left",
                      column.className,
                      column.tabletHidden && "hidden lg:table-cell"
                    )}
                  >
                    {column.sortable ? (
                      <button
                        className="group inline-flex items-center gap-1.5 hover:text-foreground transition-colors focus:outline-none"
                        onClick={() => handleSort(column.key)}
                      >
                        {column.label}
                        <span className="text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60">
                          {getSortIcon(column.key)}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
                {actions.length > 0 && (
                  <th className={cn(
                    "h-11 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-16",
                    dir === "rtl" ? "text-left" : "text-right"
                  )}>
                    {common.table.actions}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                    className="px-5 py-4"
                  >
                    {emptyState ? (
                      <div className="py-10">{emptyState}</div>
                    ) : (
                      <div className="text-center text-muted-foreground/40 font-semibold uppercase tracking-wider text-[11px] py-10">
                        {emptyMessage}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/25 transition-colors"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-5 py-3.5 text-[13px] text-foreground",
                          column.className,
                          column.tabletHidden && "hidden lg:table-cell"
                        )}
                      >
                        {column.render
                          ? column.render(row[column.key], row)
                          : row[column.key]
                        }
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className={cn(
                        "px-5 py-3.5",
                        dir === "rtl" ? "text-left" : "text-right"
                      )}>
                        <div className="flex items-center justify-end gap-1">
                          {actions.length === 1 ? (
                            <Button
                              variant={actions[0].variant || "ghost"}
                              size="sm"
                              className="h-8 rounded-lg text-xs"
                              onClick={() => actions[0].onClick(row)}
                              disabled={actions[0].disabled?.(row)}
                            >
                              {actions[0].icon}
                              <span className={cn(
                                "hidden lg:inline",
                                dir === "rtl" ? "mr-2" : "ml-2"
                              )}>
                                {actions[0].label}
                              </span>
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg hover:bg-muted transition-colors" />}>
                                <MoreHorizontal className="w-4 h-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={dir === "rtl" ? "start" : "end"}>
                                {actions.map((action, actionIndex) => (
                                  <DropdownMenuItem
                                    key={actionIndex}
                                    onClick={() => action.onClick(row)}
                                    disabled={action.disabled?.(row)}
                                  >
                                    {action.icon}
                                    <span className={cn(
                                      dir === "rtl" ? "mr-2" : "ml-2"
                                    )}>{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <div className="text-[11px] font-medium text-muted-foreground/60">
            {common.table.showing
              .replace("{from}", String(startIndex + 1))
              .replace("{to}", String(Math.min(startIndex + pageSize, filteredData.length)))
              .replace("{total}", String(filteredData.length))}
          </div>

          <div className="flex items-center gap-1.5 pagination-controls">
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              {dir === "rtl" ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              {dir === "rtl" ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </Button>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-border/60 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground/60">{common.table.page}</span>
              <span className="text-[13px] font-bold text-primary">{currentPage}</span>
              <span className="text-[11px] font-medium text-muted-foreground/60">{common.table.of} {totalPages}</span>
            </div>

            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              {dir === "rtl" ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              {dir === "rtl" ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
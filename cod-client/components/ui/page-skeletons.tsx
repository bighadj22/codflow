import { Skeleton } from "@/components/ui/skeleton";

/**
 * Header used by list pages: pill badge + optional "New" button.
 */
export function ListHeaderSkeleton({ showAction = true }: { showAction?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <Skeleton className="h-7 w-32 rounded-xl" />
      {showAction ? <Skeleton className="h-9 sm:h-10 w-32 sm:w-40 rounded-xl" /> : null}
    </div>
  );
}

/**
 * Search + filter bar used by most list pages.
 */
export function ListFiltersSkeleton({ filterCount = 1 }: { filterCount?: number }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Skeleton className="h-10 flex-1 rounded-xl" />
      {[...Array(filterCount)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-full sm:w-32 rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Table (desktop) + cards (mobile) list skeleton.
 */
export function TableListSkeleton({
  columns = 4,
  rows = 5,
  mobileCards = 3,
}: {
  columns?: number;
  rows?: number;
  mobileCards?: number;
}) {
  return (
    <>
      <div className="hidden sm:block border rounded-2xl overflow-hidden glass-card">
        <div className="bg-muted/30 p-4 border-b">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {[...Array(columns)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="p-4 border-b last:border-0 flex items-center justify-between">
            <div
              className="grid gap-4 flex-1"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {[...Array(columns)].map((_, j) => (
                <Skeleton key={j} className={j === 0 ? "h-5 w-32" : j === 2 ? "h-6 w-20 rounded-full" : "h-4 w-24"} />
              ))}
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>

      <div className="sm:hidden space-y-3">
        {[...Array(mobileCards)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Composite list view: header + filters + table.
 */
export function ListViewSkeleton({
  columns = 4,
  rows = 5,
  filterCount = 1,
  showAction = true,
}: {
  columns?: number;
  rows?: number;
  filterCount?: number;
  showAction?: boolean;
}) {
  return (
    <div className="space-y-4">
      <ListHeaderSkeleton showAction={showAction} />
      <ListFiltersSkeleton filterCount={filterCount} />
      <TableListSkeleton columns={columns} rows={rows} />
    </div>
  );
}

/**
 * Grid-of-cards list skeleton (used where the view isn't a table).
 */
export function CardGridSkeleton({
  cards = 6,
  columns = 3,
}: {
  cards?: number;
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid ${colClass} gap-4`}>
      {[...Array(cards)].map((_, i) => (
        <div key={i} className="glass-card rounded-2xl border-border/30 overflow-hidden p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/**
 * Two-column form (left: fields; right: sidebar).
 */
export function FormViewSkeleton({
  sections = 2,
  fieldRows = 2,
  showSidebar = true,
}: {
  sections?: number;
  fieldRows?: number;
  showSidebar?: boolean;
}) {
  return (
    <div className="max-w-5xl mx-auto pb-48 md:pb-12 pt-8 space-y-6">
      <div className={`grid grid-cols-1 ${showSidebar ? "md:grid-cols-12" : ""} gap-6`}>
        <div className={`${showSidebar ? "md:col-span-8" : ""} space-y-6`}>
          {[...Array(sections)].map((_, s) => (
            <div key={s} className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden">
              <div className="flex items-center gap-3 px-8 py-6 border-b border-border/10">
                <Skeleton className="w-10 h-10 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="p-8 space-y-8">
                {[...Array(fieldRows)].map((_, r) => (
                  <div key={r} className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-12 w-full rounded-2xl" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-12 w-full rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {showSidebar ? (
          <div className="md:col-span-4 space-y-6">
            <div className="glass-card rounded-[2.5rem] border-border/30 p-6 space-y-4">
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            </div>
            <div className="hidden md:flex flex-col gap-3">
              <Skeleton className="h-14 w-full rounded-3xl" />
              <Skeleton className="h-14 w-full rounded-3xl" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Detail/profile page: header, info card with stats, content sections.
 */
export function DetailViewSkeleton({
  sections = 2,
  showStats = true,
}: {
  sections?: number;
  showStats?: boolean;
}) {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 md:w-80" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-12 w-32 rounded-2xl" />
          <Skeleton className="h-12 w-12 rounded-2xl" />
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] border-border/30 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col items-center lg:items-start lg:flex-row gap-6 flex-1">
            <Skeleton className="w-24 h-24 rounded-[2rem] shrink-0" />
            <div className="space-y-4 flex-1">
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-xl" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Skeleton className="h-10 w-40 rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </div>
          </div>
          {showStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 shrink-0 lg:w-56 w-full">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl col-span-2 lg:col-span-1" />
            </div>
          ) : null}
        </div>
      </div>

      {[...Array(sections)].map((_, s) => (
        <div key={s} className="space-y-4">
          <div className="flex items-center gap-3 ml-2">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-6 border-b border-border/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Main dashboard: stats grid + chart placeholder + recent activity.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="glass-card rounded-2xl border-border/30 p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-4 w-10 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 glass-card rounded-[2.5rem] border-border/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>

        <div className="glass-card rounded-[2.5rem] border-border/30 p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-24 flex-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] border-border/30 p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-2xl border border-border/10">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple single-card content (settings, profile, etc).
 */
export function SimpleCardSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {[...Array(cards)].map((_, s) => (
        <div key={s} className="glass-card rounded-[2.5rem] border-border/30 p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

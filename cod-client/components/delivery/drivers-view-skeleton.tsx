import { Skeleton } from "@/components/ui/skeleton";

export function DriversViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 sm:h-10 w-32 sm:w-40 rounded-xl" />
      </div>

      {/* Search & Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-full sm:w-32 rounded-xl" />
      </div>

      {/* Table Skeleton (Desktop) */}
      <div className="hidden sm:block border rounded-2xl overflow-hidden glass-card">
        <div className="bg-muted/30 p-4 border-b">
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border-b last:border-0 flex items-center justify-between">
            <div className="grid grid-cols-4 gap-4 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>

      {/* Mobile Card Skeleton */}
      <div className="sm:hidden space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
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
            <Skeleton className="h-11 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

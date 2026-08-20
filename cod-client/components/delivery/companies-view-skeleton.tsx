import { Skeleton } from "@/components/ui/skeleton";

export function CompaniesViewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-3 w-24 mt-2" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl border-border/30 overflow-hidden p-5 space-y-4">
            {/* Top row: logo + info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="w-4 h-4" />
            </div>

            {/* Capabilities tags */}
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>

            {/* Tap to connect border */}
            <div className="pt-3 border-t border-border/10">
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

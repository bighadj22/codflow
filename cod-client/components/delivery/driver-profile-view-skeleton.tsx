import { Skeleton } from "@/components/ui/skeleton";

export function DriverProfileViewSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      {/* Premium Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 md:w-80" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-12 w-32 rounded-2xl" />
          <Skeleton className="h-12 w-32 rounded-2xl" />
          <Skeleton className="h-12 w-12 rounded-2xl" />
        </div>
      </div>

      {/* Profile Info Glass Card Skeleton */}
      <div className="glass-card rounded-[2.5rem] border-border/30 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col items-center lg:items-start lg:flex-row gap-6 flex-1">
            <Skeleton className="w-24 h-24 rounded-[2rem] shrink-0" />
            
            <div className="space-y-4 flex-1 text-center lg:text-left">
              <div>
                <Skeleton className="h-8 w-48 mx-auto lg:mx-0 mb-2" />
                <div className="flex items-center justify-center lg:justify-start gap-3">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-xl" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Skeleton className="h-10 w-40 rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 shrink-0 lg:w-56 w-full">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl col-span-2 lg:col-span-1" />
          </div>
        </div>
      </div>

      {/* Active Shipments Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 ml-2">
          <Skeleton className="w-8 h-8 rounded-xl" />
          <Skeleton className="h-6 w-40" />
        </div>
        
        <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden">
          <div className="p-0">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-6 border-b border-border/5 last:border-0">
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
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function DriverFormSkeleton() {
  return (
    <div className="max-w-3xl mx-auto pb-48 md:pb-12 pt-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column Skeleton */}
        <div className="md:col-span-8 space-y-6">
          {/* Personal Info Card Skeleton */}
          <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden">
            <div className="flex items-center gap-3 px-8 py-6 border-b border-border/10">
              <Skeleton className="w-10 h-10 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              </div>
            </div>
          </div>

          {/* Notes Card Skeleton */}
          <div className="glass-card rounded-[2.5rem] border-border/30 overflow-hidden">
            <div className="px-8 py-5 border-b border-border/10">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="p-8">
              <Skeleton className="h-32 w-full rounded-[1.5rem]" />
            </div>
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="md:col-span-4 space-y-6">
          <div className="glass-card rounded-[2.5rem] border-border/30 p-6 space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            </div>
          </div>

          {/* Actions Skeleton */}
          <div className="hidden md:flex flex-col gap-3">
            <Skeleton className="h-14 w-full rounded-3xl" />
            <Skeleton className="h-14 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

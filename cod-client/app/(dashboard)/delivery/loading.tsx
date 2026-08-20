import { CardGridSkeleton } from "@/components/ui/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <CardGridSkeleton cards={3} columns={3} />
    </div>
  );
}

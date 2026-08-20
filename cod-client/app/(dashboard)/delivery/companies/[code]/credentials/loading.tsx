import { FormViewSkeleton } from "@/components/ui/page-skeletons";

export default function Loading() {
  return <FormViewSkeleton sections={1} fieldRows={2} showSidebar={false} />;
}

import { ListViewSkeleton } from "@/components/ui/page-skeletons";

export default function Loading() {
  return <ListViewSkeleton columns={6} rows={8} filterCount={3} />;
}

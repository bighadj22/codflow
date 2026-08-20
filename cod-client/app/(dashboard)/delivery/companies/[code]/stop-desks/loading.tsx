import { ListViewSkeleton } from "@/components/ui/page-skeletons";

export default function Loading() {
  return <ListViewSkeleton columns={4} rows={6} filterCount={1} />;
}

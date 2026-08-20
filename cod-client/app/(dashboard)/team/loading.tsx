import { ListViewSkeleton } from "@/components/ui/page-skeletons";

export default function Loading() {
  return <ListViewSkeleton columns={5} rows={6} filterCount={1} />;
}

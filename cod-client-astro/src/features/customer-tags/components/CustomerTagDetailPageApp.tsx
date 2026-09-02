import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { CustomerTagDetail } from "@/features/customer-tags/components/CustomerTagDetail";

function Gated({ tagId }: { tagId: string }) {
  return (
    <DashboardChrome currentPath={`/customer-tags/${tagId}`}>
      <CustomerTagDetail tagId={tagId} />
    </DashboardChrome>
  );
}

export default function CustomerTagDetailPageApp({ tagId }: { tagId: string }) {
  return (
    <RequireAuth>
      <Gated tagId={tagId} />
    </RequireAuth>
  );
}

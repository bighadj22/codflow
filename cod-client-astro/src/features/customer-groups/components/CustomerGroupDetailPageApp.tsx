import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { CustomerGroupDetail } from "@/features/customer-groups/components/CustomerGroupDetail";

function Gated({ groupId }: { groupId: string }) {
  return (
    <DashboardChrome currentPath={`/customer-groups/${groupId}`}>
      <CustomerGroupDetail groupId={groupId} />
    </DashboardChrome>
  );
}

export default function CustomerGroupDetailPageApp({
  groupId,
}: {
  groupId: string;
}) {
  return (
    <RequireAuth>
      <Gated groupId={groupId} />
    </RequireAuth>
  );
}

import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { CustomerDetail } from "@/features/customers/components/CustomerDetail";

function Gated({ customerId }: { customerId: string }) {
  return (
    <DashboardChrome currentPath={`/customers/${customerId}`}>
      <CustomerDetail customerId={customerId} />
    </DashboardChrome>
  );
}

export default function CustomerDetailPageApp({
  customerId,
}: {
  customerId: string;
}) {
  return (
    <RequireAuth>
      <Gated customerId={customerId} />
    </RequireAuth>
  );
}

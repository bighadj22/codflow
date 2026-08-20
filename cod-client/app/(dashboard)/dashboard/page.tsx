import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getDashboardStats } from "@/actions/analytics";
import type { OrderStatusStat } from "@/../cod-shared/queries/analytics";

export default async function DashboardPage() {
  const statusStats = await getDashboardStats().catch(
    (): OrderStatusStat[] => [],
  );

  return (
    <ProtectedRoute requiredScope={SCOPES.DASHBOARD_VIEW}>
      <DashboardClient statusStats={statusStats} />
    </ProtectedRoute>
  );
}

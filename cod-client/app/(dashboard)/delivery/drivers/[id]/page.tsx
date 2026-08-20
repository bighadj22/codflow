
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../../../../../cod-shared/rbac/scopes";
import { DriverProfileView } from "@/components/delivery/driver-profile-view";
import { getDriver } from "@/actions/drivers";
import { getPendingSettlementOrders } from "@/actions/driver-payments";

export default async function DriverProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userScopes = await getUserScopes();

  const driver = await getDriver(id).catch(() => null);
  if (!driver) notFound();

  // recentOrders (last 10, all statuses) comes embedded in the driver detail response.
  // For the settlement section we need ALL unsettled delivered orders, so we fetch those separately.
  const recentOrders = driver.recentOrders ?? [];
  const pendingSettlementOrders = await getPendingSettlementOrders(id).catch(() => []);

  const activeOrders = recentOrders.filter(
    (o) => !["delivered", "returned", "cancelled"].includes(o.status)
  );

  // For settlement: use the dedicated pending endpoint (all unsettled delivered orders).
  // Merge any delivered orders already in recentOrders that are NOT in pendingSettlement
  // (i.e. already settled) so the table can show settled rows too.
  const pendingIds = new Set(pendingSettlementOrders.map((o) => o.id));
  const settledDelivered = recentOrders.filter(
    (o) => o.status === "delivered" && !pendingIds.has(o.id)
  );
  const deliveredOrders = [...pendingSettlementOrders, ...settledDelivered];

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <DriverProfileView
        driver={driver}
        activeOrders={activeOrders}
        deliveredOrders={deliveredOrders}
        userScopes={userScopes}
      />
    </ProtectedRoute>
  );
}

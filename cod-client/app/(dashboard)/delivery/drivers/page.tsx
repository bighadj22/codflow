import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { DriversView } from "@/components/delivery/drivers-view";
import { getDrivers } from "@/actions/drivers";
import { getOrders } from "@/actions/orders";
import type { Order } from "@/types";

export default async function DriversPage() {
  const userScopes = await getUserScopes();

  const [driversResult, ordersResult] = await Promise.allSettled([
    getDrivers(),
    // We fetch a larger batch of orders to ensure we can accurately calculate 
    // driver assignment counts for non-terminal orders.
    getOrders({ limit: 1000 }),
  ]);

  const allDrivers = driversResult.status === "fulfilled" ? driversResult.value : [];
  const allOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];

  const readyOrders = allOrders.filter((o) => o.status === "ready");

  const driverOrdersMap: Record<string, Order[]> = {};
  allDrivers.forEach((driver) => {
    driverOrdersMap[driver.id] = allOrders.filter(
      (o) =>
        o.driverId === driver.id &&
        o.status !== "delivered" &&
        o.status !== "returned" &&
        o.status !== "cancelled"
    );
  });

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <DriversView
        drivers={allDrivers}
        driverOrdersMap={driverOrdersMap}
        readyOrders={readyOrders}
        userScopes={userScopes}
      />
    </ProtectedRoute>
  );
}

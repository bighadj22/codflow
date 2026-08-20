
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { OrdersView } from "@/components/orders/orders-view";
import { getOrders } from "@/actions/orders";
import { getDrivers } from "@/actions/drivers";
import { getDeliveryCompanies } from "@/actions/delivery-companies";

export default async function OrdersPage() {
  const [userScopes, ordersResult, driversResult, companiesResult] = await Promise.allSettled([
    getUserScopes(),
    getOrders(),
    getDrivers(),
    getDeliveryCompanies(true),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.ORDERS_READ}>
      <OrdersView
        orders={ordersResult.status === "fulfilled" ? ordersResult.value : []}
        drivers={driversResult.status === "fulfilled" ? driversResult.value : []}
        companies={companiesResult.status === "fulfilled" ? companiesResult.value : []}
        userScopes={userScopes.status === "fulfilled" ? userScopes.value : []}
      />
    </ProtectedRoute>
  );
}

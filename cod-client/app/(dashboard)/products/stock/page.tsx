
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { StockOverviewView } from "@/components/products/stock-overview-view";
import { getStockOverview } from "@/actions/stock";

export default async function StockOverviewPage() {
  const [overview, userScopes] = await Promise.all([
    getStockOverview(),
    getUserScopes(),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCTS_READ}>
      <div className="p-4 sm:p-6 space-y-6">
        <StockOverviewView overview={overview} userScopes={userScopes} />
      </div>
    </ProtectedRoute>
  );
}

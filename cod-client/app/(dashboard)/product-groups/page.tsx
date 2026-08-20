
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { ProductGroupsView } from "@/components/product-groups/product-groups-view";
import { getProductGroups } from "@/actions/product-groups";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

export default async function ProductGroupsPage() {
  const groups = await getProductGroups().catch(() => []);
  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCT_GROUPS_READ}>
      <ProductGroupsView groups={groups} />
    </ProtectedRoute>
  );
}

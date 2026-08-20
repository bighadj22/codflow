
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { ProductGroupForm } from "@/components/product-groups/product-group-form";
import { getProductGroups } from "@/actions/product-groups";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";

export default async function NewProductGroupPage() {
  const groups = await getProductGroups().catch(() => []);
  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCT_GROUPS_MANAGE}>
      <ProductGroupForm allGroups={groups} />
    </ProtectedRoute>
  );
}

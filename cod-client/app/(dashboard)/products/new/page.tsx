
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { ProductFormPage } from "@/components/products/product-form-page";
import { getProductGroups } from "@/actions/product-groups";
import { getShippingProfiles } from "@/actions/shipping-profiles";

export default async function NewProductPage() {
  const [groups, shippingProfiles] = await Promise.all([
    getProductGroups().catch(() => []),
    getShippingProfiles().catch(() => []),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCTS_MANAGE}>
      <ProductFormPage groups={groups} shippingProfiles={shippingProfiles} />
    </ProtectedRoute>
  );
}

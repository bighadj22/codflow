
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { ProductFormPage } from "@/components/products/product-form-page";
import { getProductGroups } from "@/actions/product-groups";
import { getShippingProfiles } from "@/actions/shipping-profiles";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [groups, shippingProfiles] = await Promise.all([
    getProductGroups().catch(() => []),
    getShippingProfiles().catch(() => []),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCTS_MANAGE}>
      <ProductFormPage productId={id} groups={groups} shippingProfiles={shippingProfiles} />
    </ProtectedRoute>
  );
}

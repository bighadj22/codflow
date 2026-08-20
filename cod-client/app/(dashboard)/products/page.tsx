
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { ProductsView } from "@/components/products/products-view";
import { getProducts } from "@/actions/products";
import { getProductGroups } from "@/actions/product-groups";

export default async function ProductsPage() {
  const userScopes = await getUserScopes();

  const [products, groups] = await Promise.allSettled([
    getProducts(),
    getProductGroups(),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCTS_READ}>
      <ProductsView
        products={products.status === "fulfilled" ? products.value : []}
        groups={groups.status === "fulfilled" ? groups.value : []}
        userScopes={userScopes}
      />
    </ProtectedRoute>
  );
}

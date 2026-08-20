
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { ProductDetailView } from "@/components/products/product-detail-view";
import { getProduct } from "@/actions/products";
import { getProductGroups } from "@/actions/product-groups";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProduct(id).catch(() => null);
  if (!product) notFound();

  const groups = await getProductGroups().catch(() => []);

  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCTS_READ}>
      <ProductDetailView product={product} groups={groups} />
    </ProtectedRoute>
  );
}

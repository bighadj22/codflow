import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { ProductDetail } from "@/features/products/components/ProductDetail";

function Gated({ productId }: { productId: string }) {
  return (
    <DashboardChrome currentPath={`/products/${productId}`}>
      <ProductDetail productId={productId} />
    </DashboardChrome>
  );
}

export default function ProductDetailPageApp({
  productId,
}: {
  productId: string;
}) {
  return (
    <RequireAuth>
      <Gated productId={productId} />
    </RequireAuth>
  );
}

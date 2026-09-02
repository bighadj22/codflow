import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { ProductForm } from "@/features/products/components/ProductForm";

function Gated({ productId }: { productId?: string }) {
  return (
    <DashboardChrome
      currentPath={productId ? `/products/${productId}/edit` : "/products/new"}
    >
      <ProductForm productId={productId} />
    </DashboardChrome>
  );
}

export default function ProductFormPageApp({
  productId,
}: {
  productId?: string;
}) {
  return (
    <RequireAuth>
      <Gated productId={productId} />
    </RequireAuth>
  );
}

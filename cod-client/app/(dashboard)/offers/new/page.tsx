
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { OfferForm } from "@/components/offers/offer-form";
import { getProducts } from "@/actions/products";

export default async function NewOfferPage() {
  const products = await getProducts({ status: "ACTIVE" }).catch(() => []);

  return (
    <ProtectedRoute requiredScope={SCOPES.OFFERS_MANAGE}>
      <OfferForm products={products} />
    </ProtectedRoute>
  );
}

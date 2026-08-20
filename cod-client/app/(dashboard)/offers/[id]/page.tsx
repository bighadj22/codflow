
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { OfferForm } from "@/components/offers/offer-form";
import { getOffer } from "@/actions/offers";
import { getProducts } from "@/actions/products";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditOfferPage({ params }: Props) {
  const { id } = await params;

  const [offer, products] = await Promise.all([
    getOffer(id),
    getProducts({ status: "ACTIVE" }).catch(() => []),
  ]);

  if (!offer) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.OFFERS_MANAGE}>
      <OfferForm products={products} offer={offer} />
    </ProtectedRoute>
  );
}

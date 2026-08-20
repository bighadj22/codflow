import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { ShippingProfileDetailPage } from "@/components/delivery/shipping-profile-detail-page";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getShippingProfile } from "@/actions/shipping-profiles";

export default async function ShippingProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getShippingProfile(id).catch(() => null);
  if (!profile) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <ShippingProfileDetailPage profile={profile} productCount={profile.productCount ?? 0} />
    </ProtectedRoute>
  );
}

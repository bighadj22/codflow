import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { ShippingProfileFormPage } from "@/components/delivery/shipping-profile-form-page";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getShippingProfile } from "@/actions/shipping-profiles";
import { getWilayas } from "@/actions/wilayas";

export default async function EditShippingProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [profileResult, wilayasResult] = await Promise.allSettled([
    getShippingProfile(id),
    getWilayas(),
  ]);

  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  const wilayas = wilayasResult.status === "fulfilled" ? wilayasResult.value : [];

  if (!profile) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_MANAGE}>
      <ShippingProfileFormPage profile={profile} wilayas={wilayas} />
    </ProtectedRoute>
  );
}

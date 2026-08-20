import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { ShippingProfileFormPage } from "@/components/delivery/shipping-profile-form-page";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getWilayas } from "@/actions/wilayas";

export default async function NewShippingProfilePage() {
  const wilayas = await getWilayas().catch(() => []);

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_MANAGE}>
      <ShippingProfileFormPage wilayas={wilayas} />
    </ProtectedRoute>
  );
}

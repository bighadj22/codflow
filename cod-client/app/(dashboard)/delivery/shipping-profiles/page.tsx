import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { ShippingProfileListView } from "@/components/delivery/shipping-profile-list-view";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getShippingProfiles } from "@/actions/shipping-profiles";

export default async function ShippingProfilesPage() {
  const profiles = await getShippingProfiles().catch(() => []);

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <ShippingProfileListView profiles={profiles} />
    </ProtectedRoute>
  );
}

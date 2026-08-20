
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { OffersView } from "@/components/offers/offers-view";
import { getOffers } from "@/actions/offers";

export default async function OffersPage() {
  const [userScopes, offers] = await Promise.allSettled([
    getUserScopes(),
    getOffers(),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.OFFERS_READ}>
      <OffersView
        offers={offers.status === "fulfilled" ? offers.value : []}
        userScopes={userScopes.status === "fulfilled" ? userScopes.value : []}
      />
    </ProtectedRoute>
  );
}

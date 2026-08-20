import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { CompaniesView } from "@/components/delivery/companies-view";
import { getDeliveryCompanies } from "@/actions/delivery-companies";

export default async function CompaniesPage() {
  const userScopes = await getUserScopes();
  const companies = await getDeliveryCompanies().catch(() => []);

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <CompaniesView companies={companies} userScopes={userScopes} />
    </ProtectedRoute>
  );
}

import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { CompanyProfilePage } from "@/components/delivery/company-profile-page";
import { getDeliveryCompanies } from "@/actions/delivery-companies";
import { getProviderConfig } from "@/lib/delivery/providers";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!getProviderConfig(code)) notFound();

  const userScopes = await getUserScopes();
  const companies = await getDeliveryCompanies().catch(() => []);
  const company = companies.find((c) => c.code === code) ?? null;

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <CompanyProfilePage
        providerCode={code}
        company={company}
        userScopes={userScopes}
      />
    </ProtectedRoute>
  );
}

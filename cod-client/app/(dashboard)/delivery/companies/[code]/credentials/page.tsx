import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { CompanyCredentialsPage } from "@/components/delivery/company-credentials-page";
import { getDeliveryCompanies } from "@/actions/delivery-companies";
import { getProviderConfig } from "@/lib/delivery/providers";

export default async function CredentialsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!getProviderConfig(code)) notFound();

  const companies = await getDeliveryCompanies().catch(() => []);
  const company = companies.find((c) => c.code === code) ?? null;

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_MANAGE}>
      <CompanyCredentialsPage providerCode={code} existingCompany={company} />
    </ProtectedRoute>
  );
}

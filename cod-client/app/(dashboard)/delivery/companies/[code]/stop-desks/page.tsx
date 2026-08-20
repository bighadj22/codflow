import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { CompanyStopDesksPage } from "@/components/delivery/company-stop-desks-page";
import { getDeliveryCompanies } from "@/actions/delivery-companies";
import { getWilayas } from "@/actions/wilayas";
import { getProviderConfig } from "@/lib/delivery/providers";

export default async function StopDesksPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const config = getProviderConfig(code);
  if (!config || !config.supportsStopDesk) notFound();

  const [companies, wilayas] = await Promise.all([
    getDeliveryCompanies().catch(() => []),
    getWilayas().catch(() => []),
  ]);
  const company = companies.find((c) => c.code === code);

  if (!company?.isConnected) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <CompanyStopDesksPage company={company} wilayas={wilayas} />
    </ProtectedRoute>
  );
}

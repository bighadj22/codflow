
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../../cod-shared/rbac/scopes";
import { CustomerFormPage } from "@/components/customers/customer-form-page";
import { getCustomer } from "@/actions/customers";
import { getWilayas } from "@/actions/wilayas";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, wilayas] = await Promise.all([
    getCustomer(id).catch(() => null),
    getWilayas().catch(() => []),
  ]);
  if (!customer) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMERS_UPDATE}>
      <CustomerFormPage customer={customer} wilayas={wilayas} />
    </ProtectedRoute>
  );
}

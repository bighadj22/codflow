
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { CustomerFormPage } from "@/components/customers/customer-form-page";
import { getWilayas } from "@/actions/wilayas";

export default async function NewCustomerPage() {
  const wilayas = await getWilayas().catch(() => []);

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMERS_CREATE}>
      <CustomerFormPage wilayas={wilayas} />
    </ProtectedRoute>
  );
}

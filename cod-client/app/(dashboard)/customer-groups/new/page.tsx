
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { CustomerGroupForm } from "@/components/customer-groups/customer-group-form";

export default async function NewCustomerGroupPage() {
  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
      <CustomerGroupForm mode="create" />
    </ProtectedRoute>
  );
}

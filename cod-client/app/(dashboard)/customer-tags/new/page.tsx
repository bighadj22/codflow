
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { CustomerTagForm } from "@/components/customer-tags/customer-tag-form";

export default async function NewCustomerTagPage() {
  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_TAGS_MANAGE}>
      <CustomerTagForm mode="create" />
    </ProtectedRoute>
  );
}

import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../../cod-shared/rbac/scopes";
import { DriverFormPage } from "@/components/delivery/driver-form-page";

export default function NewDriverPage() {
  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_MANAGE}>
      <DriverFormPage />
    </ProtectedRoute>
  );
}

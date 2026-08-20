
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { getCustomerGroups } from "@/actions/customer-groups";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { CustomerGroupsView } from "@/components/customer-groups/customer-groups-view";

export default async function CustomerGroupsPage() {
  const userScopes = await getUserScopes();

  let groups: any[] = [];
  try {
    groups = await getCustomerGroups();
  } catch (error) {
    console.error("Failed to fetch customer groups:", error);
  }

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_GROUPS_READ}>
      <CustomerGroupsView groups={groups} userScopes={userScopes} />
    </ProtectedRoute>
  );
}

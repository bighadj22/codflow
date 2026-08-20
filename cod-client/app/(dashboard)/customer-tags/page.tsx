
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { getCustomerTags } from "@/actions/customer-tags";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import { CustomerTagsView } from "@/components/customer-tags/customer-tags-view";

export default async function CustomerTagsPage() {
  const userScopes = await getUserScopes();

  let tags: any[] = [];
  try {
    tags = await getCustomerTags();
  } catch (error) {
    console.error("Failed to fetch customer tags:", error);
  }

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_TAGS_READ}>
      <CustomerTagsView tags={tags} userScopes={userScopes} />
    </ProtectedRoute>
  );
}

import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { CustomerProfileView } from "@/components/customers/customer-profile-view";
import { getCustomer, getCustomerOrders, getCustomerGroupMemberships, getCustomerTagMemberships } from "@/actions/customers";
import { getCustomerGroups } from "@/actions/customer-groups";
import { getCustomerTags } from "@/actions/customer-tags";
import { getUserScopes } from "@/lib/auth";

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await getCustomer(id).catch(() => null);
  if (!customer) notFound();

  const [ordersResult, groupsResult, tagsResult, allGroupsResult, allTagsResult, userScopesResult] =
    await Promise.allSettled([
      getCustomerOrders(id),
      getCustomerGroupMemberships(id),
      getCustomerTagMemberships(id),
      getCustomerGroups(),
      getCustomerTags(),
      getUserScopes(),
    ]);

  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const assignedGroups = groupsResult.status === "fulfilled" ? groupsResult.value : [];
  const assignedTags = tagsResult.status === "fulfilled" ? tagsResult.value : [];
  const allGroups = allGroupsResult.status === "fulfilled" ? allGroupsResult.value : [];
  const allTags = allTagsResult.status === "fulfilled" ? allTagsResult.value : [];
  const userScopes = userScopesResult.status === "fulfilled" ? userScopesResult.value : [];

  const returnRate =
    orders.length > 0
      ? Math.round(
          (orders.filter((o) => o.status === "returned").length / orders.length) * 100
        )
      : 0;

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMERS_READ}>
      <CustomerProfileView
        customer={customer}
        orders={orders}
        returnRate={returnRate}
        assignedGroups={assignedGroups}
        assignedTags={assignedTags}
        allGroups={allGroups}
        allTags={allTags}
        userScopes={userScopes}
      />
    </ProtectedRoute>
  );
}

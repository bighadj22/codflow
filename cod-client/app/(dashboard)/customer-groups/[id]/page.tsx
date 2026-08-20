import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { getCustomerGroups, getCustomerGroup } from "@/actions/customer-groups";
import { getCustomers } from "@/actions/customers";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { CustomerGroupDetailView } from "@/components/customer-groups/customer-group-detail-view";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  try {
    const groups = await getCustomerGroups();
    return groups.map((g) => ({ id: g.id }));
  } catch {
    return [];
  }
}

export default async function CustomerGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userScopes = await getUserScopes();

  let group: any = null;
  let allCustomers: any[] = [];
  try {
    [group, allCustomers] = await Promise.all([
      getCustomerGroup(id),
      getCustomers(),
    ]);
  } catch (error) {
    console.error("Failed to fetch group:", error);
  }

  if (!group) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_GROUPS_READ}>
      <CustomerGroupDetailView group={group} allCustomers={allCustomers} userScopes={userScopes} />
    </ProtectedRoute>
  );
}

import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getCustomerGroups, getCustomerGroup } from "@/actions/customer-groups";
import { SCOPES } from "../../../../../../cod-shared/rbac/scopes";
import { CustomerGroupForm } from "@/components/customer-groups/customer-group-form";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  try {
    const groups = await getCustomerGroups();
    return groups.map((g) => ({ id: g.id }));
  } catch {
    return [];
  }
}

export default async function EditCustomerGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let group: any = null;
  try {
    group = await getCustomerGroup(id);
  } catch (error) {
    console.error("Failed to fetch group:", error);
  }

  if (!group) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_GROUPS_MANAGE}>
      <CustomerGroupForm mode="edit" group={group} />
    </ProtectedRoute>
  );
}

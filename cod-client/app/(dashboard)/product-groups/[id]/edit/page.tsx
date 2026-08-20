
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { ProductGroupForm } from "@/components/product-groups/product-group-form";
import { getProductGroup, getProductGroups } from "@/actions/product-groups";
import { SCOPES } from "../../../../../../cod-shared/rbac/scopes";

export default async function EditProductGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getProductGroup(id).catch(() => null);
  if (!group) notFound();
  const allGroups = await getProductGroups().catch(() => []);
  return (
    <ProtectedRoute requiredScope={SCOPES.PRODUCT_GROUPS_MANAGE}>
      <ProductGroupForm group={group} allGroups={allGroups} />
    </ProtectedRoute>
  );
}

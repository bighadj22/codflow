import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getCustomerTags, getCustomerTag } from "@/actions/customer-tags";
import { SCOPES } from "../../../../../../cod-shared/rbac/scopes";
import { CustomerTagForm } from "@/components/customer-tags/customer-tag-form";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  try {
    const tags = await getCustomerTags();
    return tags.map((t) => ({ id: t.id }));
  } catch {
    return [];
  }
}

export default async function EditCustomerTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let tag: any = null;
  try {
    tag = await getCustomerTag(id);
  } catch (error) {
    console.error("Failed to fetch tag:", error);
  }

  if (!tag) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_TAGS_MANAGE}>
      <CustomerTagForm mode="edit" tag={tag} />
    </ProtectedRoute>
  );
}

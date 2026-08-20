import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { getCustomerTags, getCustomerTag } from "@/actions/customer-tags";
import { getCustomers } from "@/actions/customers";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { CustomerTagDetailView } from "@/components/customer-tags/customer-tag-detail-view";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  try {
    const tags = await getCustomerTags();
    return tags.map((t) => ({ id: t.id }));
  } catch {
    return [];
  }
}

export default async function CustomerTagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userScopes = await getUserScopes();

  let tag: any = null;
  let allCustomers: any[] = [];
  try {
    [tag, allCustomers] = await Promise.all([
      getCustomerTag(id),
      getCustomers(),
    ]);
  } catch (error) {
    console.error("Failed to fetch tag:", error);
  }

  if (!tag) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.CUSTOMER_TAGS_READ}>
      <CustomerTagDetailView tag={tag} allCustomers={allCustomers} userScopes={userScopes} />
    </ProtectedRoute>
  );
}

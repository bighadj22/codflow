import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { SCOPES } from "../../../../../../../cod-shared/rbac/scopes";
import { DriverFormPage } from "@/components/delivery/driver-form-page";
import { getDriver } from "@/actions/drivers";

export default async function EditDriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const driver = await getDriver(id).catch(() => null);
  if (!driver) notFound();

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_MANAGE}>
      <DriverFormPage driver={driver} />
    </ProtectedRoute>
  );
}

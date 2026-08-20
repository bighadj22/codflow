import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { getUserScopes } from "@/lib/auth";
import { SCOPES } from "../../../../../../../cod-shared/rbac/scopes";
import { DriverCompensationsView } from "@/components/delivery/driver-compensations-view";
import { getDriver, getDriverCompensations } from "@/actions/drivers";
import { getWilayas } from "@/actions/wilayas";

export default async function DriverCompensationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userScopes = await getUserScopes();

  const driver = await getDriver(id).catch(() => null);
  if (!driver) notFound();

  const [compensations, wilayas] = await Promise.all([
    getDriverCompensations(id).catch(() => []),
    getWilayas().catch(() => []),
  ]);

  return (
    <ProtectedRoute requiredScope={SCOPES.DELIVERY_READ}>
      <DriverCompensationsView
        driver={driver}
        compensations={compensations}
        wilayas={wilayas}
        userScopes={userScopes}
      />
    </ProtectedRoute>
  );
}

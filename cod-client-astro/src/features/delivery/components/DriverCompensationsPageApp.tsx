import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { DriverCompensationsDetail } from "@/features/delivery/components/DriverCompensationsDetail";

function Gated({ driverId }: { driverId: string }) {
  return (
    <DashboardChrome
      currentPath={`/delivery/drivers/${driverId}/compensations`}
    >
      <DriverCompensationsDetail driverId={driverId} />
    </DashboardChrome>
  );
}

export default function DriverCompensationsPageApp({
  driverId,
}: {
  driverId: string;
}) {
  return (
    <RequireAuth>
      <Gated driverId={driverId} />
    </RequireAuth>
  );
}

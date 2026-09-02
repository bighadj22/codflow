import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { DriverDetail } from "@/features/delivery/components/DriverDetail";

function Gated({ driverId }: { driverId: string }) {
  return (
    <DashboardChrome currentPath={`/delivery/drivers/${driverId}`}>
      <DriverDetail driverId={driverId} />
    </DashboardChrome>
  );
}

export default function DriverProfilePageApp({
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

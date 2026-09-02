import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { CompanyStopDesksDetail } from "@/features/delivery/components/CompanyStopDesksDetail";

function Gated({ providerCode }: { providerCode: string }) {
  return (
    <DashboardChrome currentPath={`/delivery/companies/${providerCode}/stop-desks`}>
      <CompanyStopDesksDetail providerCode={providerCode} />
    </DashboardChrome>
  );
}

export default function CompanyStopDesksPageApp({ providerCode }: { providerCode: string }) {
  return (
    <RequireAuth>
      <Gated providerCode={providerCode} />
    </RequireAuth>
  );
}

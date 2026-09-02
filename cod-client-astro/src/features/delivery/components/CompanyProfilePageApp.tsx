import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { CompanyProfileDetail } from "@/features/delivery/components/CompanyProfileDetail";

function Gated({ providerCode }: { providerCode: string }) {
  return (
    <DashboardChrome currentPath={`/delivery/companies/${providerCode}`}>
      <CompanyProfileDetail providerCode={providerCode} />
    </DashboardChrome>
  );
}

export default function CompanyProfilePageApp({ providerCode }: { providerCode: string }) {
  return (
    <RequireAuth>
      <Gated providerCode={providerCode} />
    </RequireAuth>
  );
}

import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { CompanyCredentialsDetail } from "@/features/delivery/components/CompanyCredentialsDetail";

function Gated({ providerCode }: { providerCode: string }) {
  return (
    <DashboardChrome currentPath={`/delivery/companies/${providerCode}/credentials`}>
      <CompanyCredentialsDetail providerCode={providerCode} />
    </DashboardChrome>
  );
}

export default function CompanyCredentialsPageApp({ providerCode }: { providerCode: string }) {
  return (
    <RequireAuth>
      <Gated providerCode={providerCode} />
    </RequireAuth>
  );
}

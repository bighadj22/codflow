import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { TeamMemberDetail } from "@/features/team/components/TeamMemberDetail";

function Gated({ memberId }: { memberId: string }) {
  const t = useT("team");
  const common = useT("common");
  return (
    <DashboardChrome currentPath={`/team/${memberId}`}>
      <PageHeader
        title={t("header.title")}
        backHref="/team"
        backLabel={common("cancel")}
      />
      <TeamMemberDetail memberId={memberId} />
    </DashboardChrome>
  );
}

export default function TeamMemberPageApp({ memberId }: { memberId: string }) {
  return (
    <RequireAuth>
      <Gated memberId={memberId} />
    </RequireAuth>
  );
}

import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { DashboardChrome } from "@/components/layout/chrome";
import { PageHeader } from "@/components/ui";
import { useT } from "@/i18n/react";
import { TeamList } from "@/features/team/components/TeamList";

function Gated() {
  const t = useT("team");
  return (
    <DashboardChrome currentPath="/team">
      <PageHeader title={t("header.title")} subtitle={t("header.subtitle")} />
      <TeamList />
    </DashboardChrome>
  );
}

export default function TeamPageApp() {
  return (
    <RequireAuth>
      <Gated />
    </RequireAuth>
  );
}

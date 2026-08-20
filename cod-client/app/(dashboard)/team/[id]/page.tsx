
import { notFound, redirect } from "next/navigation";
import { TeamMemberPage } from "@/components/team/team-member-page";
import { getUser } from "@/actions/users";
import { getUserActivityLogs } from "@/actions/activity-logs";
import { getUserRole } from "@/lib/auth";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TeamMemberActivityPage({ params }: Props) {
  const { id } = await params;

  // Admin-only page - check role first
  const role = await getUserRole();
  if (role !== "admin") {
    redirect("/");
  }

  const user = await getUser(id).catch(() => null);
  if (!user) notFound();

  // Fetch activity logs for admin
  const logs = await getUserActivityLogs(id, { limit: 30 }).catch(() => []);

  return <TeamMemberPage user={user} initialLogs={logs} isAdmin={true} />;
}

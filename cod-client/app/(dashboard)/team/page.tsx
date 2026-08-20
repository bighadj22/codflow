
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import { TeamView } from "@/components/team/team-view";
import { getUsers } from "@/actions/users";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TeamPage() {
  // Admin-only page - check role first
  const role = await getUserRole();
  if (role !== "admin") {
    redirect("/");
  }

  let users: any[] = [];

  try {
    users = await getUsers();
  } catch (error) {
    console.error("Failed to fetch users:", error);
    // Continue with empty array - component will handle the error state
  }

  return <TeamView users={users} />;
}
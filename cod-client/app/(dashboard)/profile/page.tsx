import { requireUser } from "@/lib/auth";
import { ProfileView } from "@/components/profile/profile-view";

// Every authenticated user can access their own profile — no scope guard needed.
export default async function ProfilePage() {
  const user = await requireUser();
  return <ProfileView user={user} />;
}

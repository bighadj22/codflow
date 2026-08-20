
import { SettingsLayout } from "@/components/settings/settings-layout";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  // Admin-only page - check role first
  const role = await getUserRole();
  if (role !== "admin") {
    redirect("/");
  }

  return <SettingsLayout />;
}


export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Navbar } from "@/components/layout/navbar";
import { requireUser, getUserRole, getUserScopes } from "@/lib/auth";
import { getStockAlerts } from "@/actions/stock";
import { getDashboardBrand, getStoreDomain } from "@/lib/brand";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [userRole, userScopes, stockAlerts, brand, storeDomain] = await Promise.all([
    getUserRole().catch(() => "staff" as const),
    getUserScopes().catch(() => [] as string[]),
    getStockAlerts({ limit: 1 }).catch(() => ({ items: [], total: 0 })),
    getDashboardBrand(),
    getStoreDomain(),
  ]);

  const role = userRole ?? "staff";
  const stockAlertCount = stockAlerts.total;

  const name = user.name ?? user.email ?? "";
  const initials = name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          :root {
            --primary: ${brand.primaryColor};
            --primary-foreground: #ffffff;
            --sidebar-primary: ${brand.primaryColor};
            --sidebar-primary-foreground: #ffffff;
          }
        `
      }} />
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
      <Sidebar
        user={{ name, initials, role }}
        brand={brand}
        storeDomain={storeDomain}
        stockAlertCount={stockAlertCount}
        userScopes={userScopes}
        role={role}
        onSignOut={async () => {
          "use server";
          redirect("/sign-out");
        }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <MobileNav userScopes={userScopes} role={role} brand={brand} storeDomain={storeDomain} />
        <main className="flex-1 overflow-y-auto pb-[76px] md:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
    </>
  );
}

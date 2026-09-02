import type { ReactNode } from "react";
import { useT } from "@/i18n/react";
import { ConfirmDialogProvider } from "@/components/ui";
import { DashboardSidebar } from "@/components/layout/Sidebar";
import { DashboardTopbar } from "@/components/layout/Topbar";
import { MobileChrome } from "@/components/layout/MobileChrome";

export function DashboardChrome({
  currentPath,
  children,
}: {
  currentPath: string;
  children: ReactNode;
}) {
  const tN = useT("navigation");
  return (
    <ConfirmDialogProvider>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
        <a
          href="#dashboard-main"
          className="fixed start-3 top-3 z-[80] -translate-y-20 rounded-lg bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-lg transition-transform focus:translate-y-0"
        >
          {tN("skip_to_content")}
        </a>
        <div className="hidden md:block">
          <DashboardTopbar />
        </div>
        <div className="md:hidden">
          <MobileChrome currentPath={currentPath} />
        </div>
        <div className="flex min-h-0 flex-1">
          <DashboardSidebar currentPath={currentPath} />
          <div
            id="dashboard-main"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-6 outline-none sm:px-6 md:px-8 md:pt-8"
          >
            <div className="mx-auto max-w-[1120px]">{children}</div>
          </div>
        </div>
      </div>
    </ConfirmDialogProvider>
  );
}


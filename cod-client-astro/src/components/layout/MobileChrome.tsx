import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLocale, useT } from "@/i18n/react";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { AccountControl, DashboardTopbar } from "@/components/layout/Topbar";
import { SidebarNav, SidebarWorkspaceCard } from "@/components/layout/Sidebar";

export function MobileChrome({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);
  const tN = useT("navigation");
  const locale = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      menuRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <div
        ref={(node) => {
          menuRef.current = node?.querySelector("button") ?? null;
        }}
      >
        <DashboardTopbar onMenu={() => setOpen(true)} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-foreground/25 backdrop-blur-xs"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={tN("sidebar.general")}
            className="absolute inset-y-0 start-0 flex w-[min(300px,86vw)] flex-col border-e border-sidebar-border bg-sidebar shadow-2xl"
          >
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <span className="text-sm font-semibold text-foreground">
                {tN("sidebar.general")}
              </span>
              <button
                ref={closeRef}
                type="button"
                aria-label={tN("menu.close")}
                onClick={() => setOpen(false)}
                className="grid size-10 place-items-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarWorkspaceCard />
            <SidebarNav
              currentPath={currentPath}
              onNavigate={() => setOpen(false)}
            />
            <div className="space-y-3 border-t border-sidebar-border p-3">
              <LanguageSwitcher locale={locale} />
              <AccountControl />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}


import { useEffect, useState } from "react";
import {
  ChevronDown,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  Sun,
} from "lucide-react";
import { useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { toggleTheme, useTheme } from "@/theme/react";
import { isCurrentPath, useNavSections } from "@/components/layout/nav";

function ActiveAccent({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-brand shadow-[0_0_8px_rgba(109,40,217,0.4)]"
    />
  );
}


export function SidebarWorkspaceCard({
  isCollapsed,
  onToggleCollapse,
}: {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const identity = useIdentity();
  const tN = useT("navigation");

  if (isCollapsed) {
    return (
      <div className="flex shrink-0 items-center justify-center border-b border-sidebar-border/60 p-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={tN("menu.expand")}
          title={tN("menu.expand")}
          className="grid size-9 place-items-center rounded-lg border border-brand/20 bg-brand/10 text-brand transition-colors hover:bg-brand/20"
        >
          <Store size={18} strokeWidth={2.2} />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-sidebar-border/60 p-2.5">
      <div className="flex items-center justify-between gap-2.5 rounded-xl border border-sidebar-border/70 bg-card/60 p-2 shadow-xs transition-colors hover:bg-card/90">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand/10 text-brand shadow-xs">
            <Store size={16} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="truncate text-[11px] font-medium leading-tight text-muted-foreground">
              {identity?.user.email || "store@codflow.com"}
            </div>
            <div className="truncate text-[13px] font-semibold leading-snug text-foreground">
              {identity?.user.name || tN("sidebar.store")}
            </div>
          </div>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={tN("menu.collapse")}
            title={tN("menu.collapse")}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelLeftClose size={15} className="rtl:rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
}


export function SidebarNav({
  currentPath,
  isCollapsed = false,
  onNavigate,
}: {
  currentPath: string;
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const sections = useNavSections();
  const tN = useT("navigation");

  const initialOpen = new Set<string>();
  for (const section of sections) {
    for (const item of section.items) {
      if (
        item.kind === "group" &&
        item.children.some(
          (child) => !!child.href && isCurrentPath(currentPath, child.href),
        )
      ) {
        initialOpen.add(item.id);
      }
    }
  }
  const [openGroups, setOpenGroups] = useState<Set<string>>(initialOpen);

  function toggleGroup(id: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isCollapsed) {
    return (
      <nav
        aria-label={tN("sidebar.general")}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
      >
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <div key={section.label} className="space-y-1">
              {idx > 0 && (
                <div className="mx-auto my-2 w-6 border-t border-sidebar-border/60" />
              )}
              {section.items.map((item) => {
                if (item.kind === "leaf") {
                  const Icon = item.icon;
                  const active = isCurrentPath(currentPath, item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "group relative mx-auto grid size-10 place-items-center rounded-lg transition-colors",
                        active
                          ? "bg-brand/[0.08] text-brand dark:bg-brand/15 dark:text-brand"
                          : "text-sidebar-foreground/80 hover:bg-card/70 hover:text-foreground",
                      ].join(" ")}
                    >
                      <ActiveAccent show={active} />
                      <Icon
                        size={19}
                        strokeWidth={active ? 2.1 : 1.8}
                        className={`transition-colors ${
                          active
                            ? "text-brand dark:text-brand"
                            : "text-muted-foreground/80 group-hover:text-foreground"
                        }`}
                      />
                    </a>
                  );
                }

                const groupActive =
                  item.children.some(
                    (child) =>
                      !!child.href && isCurrentPath(currentPath, child.href),
                  ) ||
                  (!!item.href && isCurrentPath(currentPath, item.href));
                const GroupIcon = item.icon;
                const targetHref = item.href ?? item.children[0]?.href ?? "/";

                return (
                  <a
                    key={item.id}
                    href={targetHref}
                    onClick={onNavigate}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={groupActive ? "page" : undefined}
                    className={[
                      "group relative mx-auto grid size-10 place-items-center rounded-lg transition-colors",
                      groupActive
                        ? "bg-brand/[0.08] text-brand dark:bg-brand/15 dark:text-brand"
                        : "text-sidebar-foreground/80 hover:bg-card/70 hover:text-foreground",
                    ].join(" ")}
                  >
                    <ActiveAccent show={groupActive} />
                    <GroupIcon
                      size={19}
                      strokeWidth={groupActive ? 2.1 : 1.8}
                      className={`transition-colors ${
                        groupActive
                          ? "text-brand dark:text-brand"
                          : "text-muted-foreground/80 group-hover:text-foreground"
                      }`}
                    />
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label={tN("sidebar.general")}
      className="flex-1 overflow-y-auto px-3 py-3"
    >
      <div className="space-y-4">
        {sections.map((section, idx) => (
          <section key={section.label} className="space-y-1">
            {idx > 0 && (
              <div className="my-2 border-t border-sidebar-border/60" />
            )}
            <h2 className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground/75 select-none">
              {section.label}
            </h2>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                if (item.kind === "leaf") {
                  const Icon = item.icon;
                  const active = isCurrentPath(currentPath, item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "group relative flex min-h-[36px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-all duration-150 active:scale-[0.99]",
                        active
                          ? "bg-brand/[0.08] font-semibold text-foreground dark:bg-brand/15"
                          : "text-sidebar-foreground/85 hover:bg-card/70 hover:text-foreground",
                      ].join(" ")}
                    >
                      <ActiveAccent show={active} />
                      <Icon
                        size={18}
                        strokeWidth={active ? 2.1 : 1.8}
                        className={`shrink-0 transition-colors ${
                          active
                            ? "text-brand dark:text-brand"
                            : "text-muted-foreground/80 group-hover:text-foreground"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-start">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="ms-auto shrink-0 rounded border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                          {item.badge}
                        </span>
                      )}
                    </a>
                  );
                }

                const groupActive =
                  item.children.some(
                    (child) =>
                      !!child.href && isCurrentPath(currentPath, child.href),
                  ) ||
                  (!!item.href && isCurrentPath(currentPath, item.href));
                const expanded = openGroups.has(item.id);
                const GroupIcon = item.icon;
                const groupButtonClass = [
                  "group relative flex min-h-[36px] w-full items-center justify-between rounded-lg px-2.5 text-[13.5px] font-medium transition-all duration-150 active:scale-[0.99]",
                  groupActive
                    ? "bg-brand/[0.08] font-semibold text-foreground dark:bg-brand/15"
                    : "text-sidebar-foreground/85 hover:bg-card/70 hover:text-foreground",
                ].join(" ");

                return (
                  <div key={item.id} className="space-y-0.5">
                    {item.href ? (
                      <div className={groupButtonClass}>
                        <ActiveAccent show={groupActive && !expanded} />
                        <a
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={groupActive ? "page" : undefined}
                          className="flex min-w-0 flex-1 items-center gap-2.5"
                        >
                          <GroupIcon
                            size={18}
                            strokeWidth={groupActive ? 2.1 : 1.8}
                            className={`shrink-0 transition-colors ${
                              groupActive
                                ? "text-brand dark:text-brand"
                                : "text-muted-foreground/80 group-hover:text-foreground"
                            }`}
                          />
                          <span className="min-w-0 flex-1 truncate text-start">
                            {item.label}
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleGroup(item.id);
                          }}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? tN("menu.collapse") : tN("menu.expand")}: ${item.label}`}
                          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ChevronDown
                            size={14}
                            strokeWidth={2}
                            className={`transition-transform duration-200 ${
                              expanded ? "rotate-0" : "-rotate-90 rtl:rotate-90"
                            }`}
                          />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        aria-expanded={expanded}
                        className={groupButtonClass}
                      >
                        <ActiveAccent show={groupActive && !expanded} />
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <GroupIcon
                            size={18}
                            strokeWidth={groupActive ? 2.1 : 1.8}
                            className={`shrink-0 transition-colors ${
                              groupActive
                                ? "text-brand dark:text-brand"
                                : "text-muted-foreground/80 group-hover:text-foreground"
                            }`}
                          />
                          <span className="min-w-0 flex-1 truncate text-start">
                            {item.label}
                          </span>
                        </div>
                        {item.badge && (
                          <span className="me-2 shrink-0 rounded border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                            {item.badge}
                          </span>
                        )}
                        <ChevronDown
                          size={14}
                          strokeWidth={2}
                          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                            expanded ? "rotate-0" : "-rotate-90 rtl:rotate-90"
                          }`}
                        />
                      </button>
                    )}
                    {expanded && (
                      <div className="my-1 ms-4 space-y-0.5 border-s border-sidebar-border/80 ps-2.5">
                        {item.children.map((child) => {
                          const childActive = isCurrentPath(
                            currentPath,
                            child.href,
                          );
                          return (
                            <a
                              key={child.href}
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={childActive ? "page" : undefined}
                              className={[
                                "group relative flex min-h-[32px] items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors duration-150",
                                childActive
                                  ? "bg-brand/[0.08] font-semibold text-brand dark:bg-brand/15 dark:text-brand"
                                  : "font-medium text-muted-foreground hover:bg-card/70 hover:text-foreground",
                              ].join(" ")}
                            >
                              {childActive ? (
                                <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                              ) : (
                                <span className="size-1 shrink-0 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-muted-foreground/70" />
                              )}
                              <span className="min-w-0 flex-1 truncate text-start">
                                {child.label}
                              </span>
                              {child.badge && (
                                <span className="ms-auto shrink-0 rounded border border-brand/20 bg-brand/10 px-1.5 py-0.2 text-[9.5px] font-bold uppercase text-brand">
                                  {child.badge}
                                </span>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}


function SidebarFooter({
  isCollapsed = false,
  onToggleCollapse,
}: {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const theme = useTheme();
  const isDark = theme === "dark";
  const tN = useT("navigation");

  if (isCollapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center space-y-1.5 border-t border-sidebar-border/60 p-2">
        <button
          type="button"
          onClick={() => toggleTheme(theme)}
          title={isDark ? tN("theme.light") : tN("theme.dark")}
          aria-label={tN("theme.toggle")}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={tN("menu.expand")}
            aria-label={tN("menu.expand")}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
          >
            <PanelLeftOpen size={17} className="rtl:rotate-180" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-1 border-t border-sidebar-border/60 bg-sidebar/80 p-2.5">
      <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] text-sidebar-foreground transition-colors hover:bg-card/70">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          {isDark ? (
            <Sun size={16} strokeWidth={1.8} />
          ) : (
            <Moon size={16} strokeWidth={1.8} />
          )}
          <span className="text-[13px] font-medium text-foreground">
            {isDark ? tN("theme.dark") : tN("theme.light")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => toggleTheme(theme)}
          aria-label={tN("theme.toggle")}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDark ? "bg-brand" : "bg-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
              isDark ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
        >
          <PanelLeftClose size={16} strokeWidth={1.8} className="rtl:rotate-180" />
          <span>{tN("menu.collapse")}</span>
        </button>
      )}
    </div>
  );
}


export function DashboardSidebar({ currentPath }: { currentPath: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("codflow_sidebar_collapsed");
      if (saved === "true") setIsCollapsed(true);
    } catch {}
  }, []);

  function handleToggle() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("codflow_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out md:flex ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <SidebarWorkspaceCard
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggle}
      />
      <SidebarNav
        currentPath={currentPath}
        isCollapsed={isCollapsed}
      />
      <SidebarFooter
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggle}
      />
    </aside>
  );
}


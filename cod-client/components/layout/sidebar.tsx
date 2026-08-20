"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Package,
  PackageX,
  Users,
  Layers,
  Tag,
  FolderOpen,
  Truck,
  Building2,
  Settings,
  Sun,
  Moon,
  Shield,
  ChevronDown,
  CircleDot,
  Command,
  BookOpen,
  Star,
  Gift,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useNavigation, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import type { DashboardBrand } from "@/lib/brand";

interface SidebarUser {
  name: string;
  initials: string;
  role: string;
}

interface SidebarProps {
  user?: SidebarUser;
  brand?: DashboardBrand;
  storeDomain?: string | null;
  onSignOut?: () => Promise<void>;
  stockAlertCount?: number;
  userScopes?: string[];
  role?: string;
}

interface NavItem {
  href?: string;
  label: string;
  icon: any;
  badge?: string | number | null;
  items?: { href: string; label: string; icon: any }[];
  external?: boolean; // Opens in new tab
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({ user, brand, storeDomain, onSignOut, stockAlertCount, userScopes = [], role = "staff" }: SidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const { theme, setTheme } = useTheme();
  const { dir } = useLanguage();
  const nav = useNavigation();
  const common = useCommon();

  useEffect(() => {
    setMounted(true);
  }, []);

  const canSee = useCallback((scope: string): boolean => {
    if (role === "admin") return true;
    return userScopes.includes("*") || userScopes.includes(scope);
  }, [role, userScopes]);

  const navGroups: NavGroup[] = useMemo(() => {
    const groups: NavGroup[] = [
      {
        title: nav.sidebar.general || "General",
        items: [
          canSee("dashboard:view") && { href: "/dashboard", label: nav.sidebar.dashboard, icon: LayoutDashboard },
          storeDomain && { href: `https://${storeDomain}`, label: nav.sidebar.store, icon: ExternalLink, external: true },
          canSee("orders:read") && {
            href: "/orders",
            label: nav.sidebar.orders,
            icon: Package,
            items: [
              { href: "/orders/abandoned", label: nav.sidebar.orders_abandoned ?? "Abandoned Orders", icon: PackageX },
            ],
          },
          canSee("customers:read") && {
            href: "/customers",
            label: nav.sidebar.customers,
            icon: Users,
            items: [
              canSee("customer_groups:read") && { href: "/customer-groups", label: nav.sidebar.customer_groups || "Groups", icon: Layers },
              canSee("customer_tags:read")   && { href: "/customer-tags",   label: nav.sidebar.customer_tags   || "Tags",   icon: Tag },
            ].filter(Boolean) as { href: string; label: string; icon: any }[],
          },
          canSee("reviews:read") && { href: "/reviews", label: nav.sidebar.reviews || "Reviews", icon: Star },
        ].filter(Boolean) as NavItem[],
      },
      {
        title: nav.sidebar.inventory || "Catalog",
        items: [
          canSee("products:read") && {
            href: "/products",
            label: nav.sidebar.products,
            icon: Layers,
            badge: stockAlertCount && stockAlertCount > 0 ? stockAlertCount : null,
            items: [
              canSee("product_groups:read") && { href: "/product-groups", label: nav.sidebar.categories || "Categories", icon: FolderOpen },
              { href: "/products/stock", label: nav.sidebar.stock_management || "Stock", icon: Package },
              canSee("offers:read") && { href: "/offers", label: nav.sidebar.offers || "العروض", icon: Gift },
            ].filter(Boolean) as { href: string; label: string; icon: any }[],
          },
          canSee("delivery:read") && {
            href: "/delivery/drivers",
            label: nav.sidebar.delivery,
            icon: Truck,
            items: [
              { href: "/delivery/drivers",           label: nav.sidebar.delivery_drivers   ?? "Drivers",   icon: Truck     },
              { href: "/delivery/companies",          label: nav.sidebar.delivery_companies ?? "Companies", icon: Building2 },
              { href: "/delivery/shipping-profiles",  label: nav.sidebar.delivery_shipping  ?? "Shipping",  icon: Package   },
            ],
          },
        ].filter(Boolean) as NavItem[],
      },
      {
        title: nav.sidebar.system || "Management",
        items: [
          // Order matters: Team (admins only) → AI Agents → API Reference.
          // AI Agents sits between Team and API Reference so it reads as
          // "people who can use the workspace, then everything below is
          // developer-facing."
          role === "admin" && { href: "/team", label: nav.sidebar.team, icon: Shield },
          // AI Agents (MCP) — visible to anyone with mcp:view or admin.
          // Separate group item (not under /settings) so shop owners can find
          // it fast; label intentionally user-friendly ("AI Agents") instead
          // of the protocol name.
          canSee("mcp:view") && { href: "/mcp", label: nav.sidebar.mcp ?? "AI Agents", icon: Sparkles },
          { href: "/api", label: nav.sidebar.api_reference || "API Reference", icon: BookOpen, external: true },
        ].filter(Boolean) as NavItem[],
      },
    ].filter(group => group.items.length > 0);
    return groups;
  }, [nav, stockAlertCount, canSee, storeDomain]);

  useEffect(() => {
    navGroups.forEach(group => {
      group.items.forEach(item => {
        if (item.items?.some(sub => pathname === sub.href || pathname.startsWith(sub.href + "/"))) {
          setOpenMenus(prev => ({ ...prev, [item.label]: true }));
        }
      });
    });
  }, [pathname, navGroups]);

  const toggleMenu = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className="hidden md:flex flex-col w-[280px] transition-all duration-500 shrink-0 border-e relative overflow-hidden bg-sidebar/80 backdrop-blur-xl border-sidebar-border/40 shadow-[1px_0_0_0_rgba(0,0,0,0.02)]"
    >
        {/* Premium Background Mesh Glows */}
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-primary/10 blur-[120px] pointer-events-none animate-pulse duration-[10000ms]" />
        <div className="absolute bottom-[-5%] right-[-10%] w-[50%] h-[40%] bg-primary/5 blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
        <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />
        
        {/* Logo Section - Brand Identity */}
        <div className="flex items-center gap-3 h-[80px] relative z-20 transition-all duration-500 px-6">
          <div className="flex items-center gap-3 w-full p-2.5 rounded-[1.25rem] transition-all duration-500 group/logo bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-premium backdrop-blur-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-lg opacity-20 group-hover/logo:opacity-40 transition-opacity duration-500" />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 transition-all duration-500 group-hover/logo:scale-110 group-hover/logo:rotate-3 relative z-10 overflow-hidden">
                {brand?.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.brandName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Command className="text-primary-foreground size-5" />
                )}
              </div>
            </div>
            <div className="overflow-hidden text-start animate-fade-in space-y-0.5">
              <p className="font-black text-[15px] leading-none text-foreground tracking-tight truncate bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                {brand?.brandName ?? nav.company.name}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em]">Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav Items Section */}
        <nav className="flex-1 py-4 px-4 space-y-8 overflow-y-auto scrollbar-none relative z-10 no-scrollbar">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title} className="space-y-2">
              <div className="flex items-center gap-3 px-3 mb-4 animate-fade-in">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 whitespace-nowrap">
                  {group.title}
                </span>
                <div className="h-[1px] w-full bg-gradient-to-r from-muted-foreground/10 to-transparent" />
              </div>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const hasSubmenu = !!item.items?.length;
                  const isSubmenuOpen = openMenus[item.label];
                  const isActive = item.href ? (pathname === item.href || (pathname.startsWith(item.href + "/") && !item.items?.some(sub => pathname.startsWith(sub.href)))) : false;
                  const isAnySubActive = item.items?.some(sub => pathname === sub.href || pathname.startsWith(sub.href + "/"));

                  const itemClass = cn(
                    "w-full group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] transition-all duration-300 relative cursor-pointer",
                    (isActive || (isAnySubActive && !isSubmenuOpen))
                      ? "bg-white dark:bg-white/5 text-primary font-bold shadow-premium border border-primary/10"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5"
                  );

                  const itemContent = (
                    <>
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500",
                        (isActive || isAnySubActive) 
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                          : "bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary group-hover:scale-110"
                      )}>
                        <item.icon size={19} className="transition-transform duration-500 group-hover:rotate-6" />
                      </div>
                      
                      <span className="flex-1 truncate text-start font-bold tracking-tight transition-colors duration-300">{item.label}</span>

                      {item.badge && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-lg bg-destructive text-destructive-foreground text-[10px] font-black px-1 shadow-sm shadow-destructive/20 animate-pulse">
                          {item.badge}
                        </span>
                      )}

                      {hasSubmenu && (
                        <div
                          onClick={(e) => toggleMenu(e, item.label)}
                          className="p-1.5 -me-1 rounded-lg hover:bg-primary/10 transition-colors group/chevron"
                        >
                          <ChevronDown
                            size={14}
                            className={cn(
                              "transition-all duration-300 opacity-40 group-hover:opacity-100 group-hover/chevron:scale-110",
                              isSubmenuOpen && "rotate-180 text-primary opacity-100"
                            )}
                          />
                        </div>
                      )}
                      
                      {/* Active Indicator Line */}
                      {(isActive || (isAnySubActive && !isSubmenuOpen)) && (
                        <div className="absolute left-[-16px] w-1.5 h-6 bg-primary rounded-r-full shadow-glow" />
                      )}
                    </>
                  );

                  return (
                    <div key={item.label} className="space-y-1.5">
                      {item.href ? (
                        item.external ? (
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className={itemClass}>
                            {itemContent}
                          </a>
                        ) : (
                          <Link href={item.href} className={itemClass}>
                            {itemContent}
                          </Link>
                        )
                      ) : (
                        <div className={itemClass} onClick={(e) => hasSubmenu && toggleMenu(e, item.label)}>
                          {itemContent}
                        </div>
                      )}

                      {/* Submenu Items */}
                      {hasSubmenu && isSubmenuOpen && (
                        <div className="space-y-1 mt-1 animate-fade-in-up px-3">
                          <div className={cn(
                            "relative space-y-1 border-s border-muted-foreground/10",
                            dir === "rtl" ? "mr-4" : "ml-4"
                          )}>
                            {item.items?.map((sub) => {
                              const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  className={cn(
                                    "flex items-center gap-3 py-2.5 rounded-xl text-[13px] transition-all duration-300 group/sub",
                                    dir === "rtl" ? "pr-6" : "pl-6",
                                    isSubActive
                                      ? "text-primary font-black bg-primary/5"
                                      : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/20"
                                  )}
                                >
                                  <div className={cn(
                                    "absolute w-1.5 h-1.5 rounded-full transition-all duration-300",
                                    dir === "rtl" ? "right-[-3.5px]" : "left-[-3.5px]",
                                    isSubActive ? "bg-primary scale-125 shadow-glow" : "bg-muted-foreground/20 group-hover/sub:bg-muted-foreground/40"
                                  )} />
                                  <span className="flex-1 truncate text-start tracking-tight">{sub.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section - Premium Profile Card */}
        <div className="px-4 py-6 space-y-4 relative z-20">
          <div className="group/profile relative transition-all duration-500 bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-3xl p-3 shadow-premium backdrop-blur-md overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover/profile:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10 space-y-3">
              {/* Settings Action */}
              {role === "admin" && (
                <Link
                  href="/settings"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all duration-300 group/settings",
                    pathname === "/settings"
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover/settings:rotate-90 duration-500",
                    pathname === "/settings" ? "bg-white/20" : "bg-muted/20"
                  )}>
                    <Settings size={16} />
                  </div>
                  <span className="flex-1 truncate font-bold tracking-tight">{nav.sidebar.settings}</span>
                </Link>
              )}

              {/* User Identity — clicking avatar/name navigates to /profile */}
              <div className="flex items-center gap-3 transition-all duration-500 px-1 pt-1">
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-3 flex-1 min-w-0 rounded-xl transition-all duration-300 group/user hover:bg-white/30 dark:hover:bg-white/5 px-2 py-1.5 -mx-2 -my-1.5",
                    pathname === "/profile" && "bg-white/40 dark:bg-white/10"
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-primary blur-md opacity-20 group-hover/user:opacity-40 transition-opacity" />
                    <div className="relative z-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-[12px] font-black text-primary-foreground shadow-md transition-all duration-500 group-hover/user:scale-105 w-10 h-10">
                      {user?.initials ?? "؟"}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-sidebar rounded-full z-20 shadow-sm" />
                  </div>

                  <div className="flex-1 min-w-0 animate-fade-in">
                    <p className="text-[13.5px] font-black text-foreground truncate leading-none tracking-tight">
                      {user?.name ?? ""}
                    </p>
                    <p className="text-muted-foreground/60 text-[10px] font-bold truncate uppercase tracking-widest mt-1">
                      {user?.role ? (common.roles as any)[user.role] || user.role : ""}
                    </p>
                  </div>
                </Link>

                {onSignOut && (
                  <div className="opacity-40 hover:opacity-100 hover:scale-110 transition-all active:scale-95 shrink-0">
                    <SignOutButton onSignOut={onSignOut} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  PackageX,
  Truck,
  MoreHorizontal,
  X,
  Sun,
  Moon,
  Users,
  Layers,
  Settings,
  Shield,
  FolderOpen,
  ChevronDown,
  Command,
  Globe,
  BookOpen,
  Star,
  UserCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/lib/translations";
import { useLanguage, Locale } from "@/lib/i18n-context";
import type { DashboardBrand } from "@/lib/brand";

interface MobileNavProps {
  userScopes?: string[];
  role?: string;
  brand?: DashboardBrand;
  storeDomain?: string | null;
}

export function MobileNav({ userScopes = [], role = "staff", brand, storeDomain }: MobileNavProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const nav = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const canSee = (scope: string): boolean => {
    if (role === "admin") return true;
    return userScopes.includes("*") || userScopes.includes(scope);
  };

  const primaryNav = [
    canSee("dashboard:view") && { href: "/dashboard", label: nav.mobile.home,      icon: LayoutDashboard },
    canSee("orders:read")    && { href: "/orders",     label: nav.mobile.orders,    icon: Package },
    canSee("customers:read") && { href: "/customers",  label: nav.mobile.customers, icon: Users },
  ].filter(Boolean) as { href: string; label: string; icon: any }[];

  const secondaryNav = [
    storeDomain && { href: `https://${storeDomain}`, label: nav.sidebar.store || "Store", icon: ExternalLink, external: true },
    canSee("orders:read") && { href: "/orders/abandoned", label: nav.sidebar.orders_abandoned ?? "Abandoned Orders", icon: PackageX },
    canSee("products:read") && {
      href: "/products",
      label: nav.mobile.products,
      icon: Layers,
      items: [
        canSee("product_groups:read") && { href: "/product-groups", label: nav.mobile.categories,                              icon: FolderOpen },
        { href: "/products/stock",  label: nav.sidebar.stock_management || "Stock Management", icon: Package },
      ].filter(Boolean) as { href: string; label: string; icon: any }[],
    },
    canSee("reviews:read")   && { href: "/reviews",  label: nav.mobile.reviews || "Reviews",              icon: Star },
    role === "admin"         && { href: "/team",     label: nav.mobile.team,                              icon: Shield },
    role === "admin"         && { href: "/settings", label: nav.mobile.settings,                          icon: Settings },
    { href: "/profile", label: nav.mobile.profile || "Profile", icon: UserCircle },
    // AI Agents sits just above API Reference on mobile, mirroring the sidebar
    // grouping where it's the last "user-facing" item before developer-facing
    // links.
    canSee("mcp:view")       && { href: "/mcp",      label: nav.sidebar.mcp ?? "AI Agents",              icon: Sparkles },
    { href: "/api", label: nav.sidebar.api_reference || "API Reference", icon: BookOpen, external: true },
  ].filter(Boolean) as any[];

  useEffect(() => {
    if (!menuOpen) {
      setOpenSubmenu(null);
    } else {
      secondaryNav.forEach((item: any) => {
        if (item.items) {
          const isAnySubActive = item.items.some(
            (subItem: any) => pathname === subItem.href || pathname.startsWith(subItem.href + "/")
          );
          if (isAnySubActive) {
            setOpenSubmenu(item.label);
          }
        }
      });
    }
  }, [menuOpen, pathname]);

  return (
    <>
      {/* Top Bar - Glass Style */}
      <div className="md:hidden flex items-center justify-between h-[64px] px-5 border-b bg-background/60 backdrop-blur-xl border-border/30 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary shadow-lg shadow-primary/20 overflow-hidden">
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
          <div>
            <p className="font-bold text-[14px] leading-tight text-foreground tracking-tight">
              {brand?.brandName ?? nav.company.name}
            </p>
          </div>
        </div>
        
        {/* Theme & Language Toggles */}
        {mounted && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted/50 hover:bg-muted transition-all active:scale-95"
            >
              <Globe size={18} className="text-foreground" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted/50 hover:bg-muted transition-all active:scale-95"
            >
              {theme === "dark" ? (
                <Sun size={18} className="text-foreground" strokeWidth={2.5} />
              ) : (
                <Moon size={18} className="text-foreground" strokeWidth={2.5} />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation - Floating Glass Bar */}
      <nav className="md:hidden fixed bottom-4 inset-x-4 z-50 bg-background/70 backdrop-blur-2xl border border-white/20 dark:border-white/5 rounded-3xl safe-area-inset-bottom shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] overflow-hidden">
        <div className={`grid h-[64px]`} style={{ gridTemplateColumns: `repeat(${primaryNav.length + 1}, minmax(0, 1fr))` }}>
            {primaryNav.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 transition-all duration-300 relative",
                    isActive ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-primary/5 animate-fade-in" />
                  )}
                  <div className={cn(
                    "transition-transform duration-300",
                    isActive && "scale-110 -translate-y-0.5"
                  )}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold tracking-tight transition-all",
                    isActive ? "opacity-100" : "opacity-60"
                  )}>{label}</span>
                </Link>
              );
            })}

            {/* More Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-300 relative",
                menuOpen ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              {menuOpen && (
                <div className="absolute inset-0 bg-primary/5 animate-fade-in" />
              )}
              <div className={cn(
                "transition-transform duration-300",
                menuOpen && "scale-110 -translate-y-0.5"
              )}>
                {menuOpen ? (
                  <X size={20} strokeWidth={2.5} />
                ) : (
                  <MoreHorizontal size={20} strokeWidth={2} />
                )}
              </div>
              <span className={cn(
                "text-[9px] font-bold tracking-tight transition-all",
                menuOpen ? "opacity-100" : "opacity-60"
              )}>{nav.mobile.more}</span>
            </button>
          </div>
        </nav>

      {/* Secondary Menu Overlay - Full Screen Glass Blur */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-background/20 backdrop-blur-md z-40 animate-in fade-in duration-300"
            onClick={() => setMenuOpen(false)}
          />
          <div className="md:hidden fixed bottom-[92px] inset-x-4 z-50 animate-in slide-in-from-bottom-6 duration-400 ease-out">
            <div className="bg-card/90 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden p-2">
              <div className="space-y-1">
                {secondaryNav.map((item: any) => {
                  const hasSubmenu = "items" in item;
                  const isAnySubItemActive = hasSubmenu && item.items.some(
                    (subItem: any) => pathname === subItem.href || pathname.startsWith(subItem.href + "/")
                  );

                  let isActive = false;
                  if (hasSubmenu && item.href) {
                    const isParentActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    isActive = isParentActive && !isAnySubItemActive;
                  } else {
                    isActive = hasSubmenu 
                      ? isAnySubItemActive 
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                  }

                  const isExpanded = openSubmenu === item.label;
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="relative flex items-center">
                        {item.external ? (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => !hasSubmenu && setMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all w-full active:scale-[0.98]",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "text-foreground hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                              isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                            )}>
                              <Icon size={18} strokeWidth={2.5} />
                            </div>
                            <span className="text-[14px] font-bold flex-1 text-start tracking-tight">{item.label}</span>
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={() => !hasSubmenu && setMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all w-full active:scale-[0.98]",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "text-foreground hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                              isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                            )}>
                              <Icon size={18} strokeWidth={2.5} />
                            </div>
                            <span className="text-[14px] font-bold flex-1 text-start tracking-tight">{item.label}</span>
                          </Link>
                        )}
                        {hasSubmenu && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenSubmenu(isExpanded ? null : item.label);
                            }}
                            className={cn(
                              "absolute end-3 w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                              isExpanded 
                                ? "bg-white/20 text-white" 
                                : isActive 
                                  ? "text-white/60 hover:bg-white/10" 
                                  : "text-muted-foreground hover:bg-muted/80",
                              !isActive && isExpanded && "bg-primary/10 text-primary"
                            )}
                          >
                            <ChevronDown 
                              size={18} 
                              className={cn(
                                "transition-transform duration-300",
                                isExpanded ? "rotate-180" : ""
                              )} 
                            />
                          </button>
                        )}
                      </div>
                      {hasSubmenu && isExpanded && (
                        <div className="px-2 pb-2 pt-1 space-y-1 animate-fade-in-up">
                          {item.items.map((subItem: any) => {
                            const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                            const SubIcon = subItem.icon;
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={() => setMenuOpen(false)}
                                className={cn(
                                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all active:scale-[0.97]",
                                  isSubActive
                                    ? "bg-primary/10 text-primary font-bold shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/30"
                                )}
                              >
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                  isSubActive ? "bg-primary/20 text-primary" : "bg-transparent text-muted-foreground/40"
                                )}>
                                  <SubIcon size={16} strokeWidth={2.5} />
                                </div>
                                <span className="text-[13px] font-medium">{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

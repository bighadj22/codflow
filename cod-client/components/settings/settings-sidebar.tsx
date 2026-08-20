"use client";

import { Store, Palette, Search, Star, BarChart2, Key, type LucideIcon } from "lucide-react";
import { useSettings } from "@/lib/translations";

export type CategoryId = "general" | "branding" | "seo" | "reviews" | "analytics" | "api";

interface CategoryItem {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
}

export interface SettingsSidebarProps {
  activeCategory: CategoryId;
  onCategoryChange: (category: CategoryId) => void;
  variant: "mobile" | "desktop";
}

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
  variant,
}: SettingsSidebarProps) {
  const t = useSettings();
  const s = t.store;

  const categories: CategoryItem[] = [
    { id: "general", label: s.general_title, icon: Store },
    { id: "branding", label: s.branding_title, icon: Palette },
    { id: "seo", label: s.seo_title, icon: Search },
    { id: "reviews", label: s.reviews_title, icon: Star },
    { id: "analytics", label: s.tracking_title, icon: BarChart2 },
    { id: "api", label: s.api_key_title, icon: Key },
  ];

  const handleCategoryClick = (categoryId: CategoryId) => {
    onCategoryChange(categoryId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, categoryId: CategoryId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCategoryClick(categoryId);
    }
  };

  // Mobile variant: Horizontal scrollable tabs
  if (variant === "mobile") {
    return (
      <div className="w-full">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                onKeyDown={(e) => handleKeyDown(e, category.id)}
                aria-current={isActive ? "page" : undefined}
                data-category={category.id}
                className={[
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground active:scale-95",
                ].join(" ")}
              >
                <Icon size={16} className="shrink-0" />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop variant: Vertical sidebar with glass-card effect
  return (
    <aside className="w-[220px] shrink-0">
      <nav
        className="glass-card rounded-2xl p-3 space-y-1 sticky top-6 border border-white/40 dark:border-white/5 shadow-premium overflow-hidden relative group"
        aria-label="Settings navigation"
      >
        {/* Subtle texture layer */}
        <div className="absolute inset-0 bg-noise opacity-[0.01] pointer-events-none" />
        
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;

          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              onKeyDown={(e) => handleKeyDown(e, category.id)}
              aria-current={isActive ? "page" : undefined}
              data-category={category.id}
              className={[
                "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group/item",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-white/40 dark:bg-white/10 text-foreground shadow-premium border-l-2 border-primary pl-[10px]"
                  : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/5 hover:text-foreground active:scale-95",
              ].join(" ")}
            >
              <Icon 
                size={16} 
                className={[
                  "shrink-0 transition-transform",
                  isActive ? "" : "group-hover/item:scale-110 group-hover/item:rotate-3"
                ].join(" ")}
              />
              <span>{category.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

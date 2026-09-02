import { useT } from "@/i18n/react";
import { SETTINGS_CATEGORIES, type CategoryId } from "@/features/settings/model";

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
  variant,
}: {
  activeCategory: CategoryId;
  onCategoryChange: (category: CategoryId) => void;
  variant: "mobile" | "desktop";
}) {
  const t = useT("settings");

  if (variant === "mobile") {
    return (
      <div className="flex gap-2 overflow-x-auto pb-3">
        {SETTINGS_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              aria-current={isActive ? "page" : undefined}
              data-category={category.id}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <Icon size={16} className="shrink-0" aria-hidden="true" />
              <span>{t(`store.${category.labelKey}`)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <aside className="w-[220px] shrink-0">
      <nav
        aria-label="Settings navigation"
        className="sticky top-6 space-y-1 rounded-xl border border-border bg-card p-3"
      >
        {SETTINGS_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              aria-current={isActive ? "page" : undefined}
              data-category={category.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon
                size={16}
                className={`shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
              <span>{t(`store.${category.labelKey}`)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

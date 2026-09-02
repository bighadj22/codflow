import { Moon, Sun } from "lucide-react";
import { useT } from "@/i18n/react";
import { toggleTheme, useTheme } from "@/theme/react";

export default function ThemeSwitcher({ inverted = false }: { inverted?: boolean }) {
  const tN = useT("navigation");
  const theme = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={tN("theme.toggle")}
      title={isDark ? tN("theme.light") : tN("theme.dark")}
      onClick={() => toggleTheme(theme)}
      className={inverted
        ? "grid size-9 place-items-center rounded-lg border border-white/15 bg-white/10 text-white/80 transition-colors hover:bg-white/15 hover:text-white active:scale-95"
        : "grid size-10 place-items-center rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:border-ring hover:text-foreground active:scale-95"}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

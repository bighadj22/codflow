"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage, Locale } from "@/lib/i18n-context";
import { useNavigation } from "@/lib/translations";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const nav = useNavigation();

  const languages: { code: Locale; label: string }[] = [
    { code: "ar", label: nav.language?.arabic || "العربية" },
    { code: "en", label: nav.language?.english || "English" },
    { code: "fr", label: nav.language?.french || "Français" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" />}>
        <Globe className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">{nav.language?.label || "Toggle language"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border min-w-[120px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLocale(lang.code)}
            className={`font-semibold cursor-pointer ${
              locale === lang.code ? "text-primary bg-primary/10" : "text-foreground"
            }`}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useT } from "@/i18n/react";
import { TurnstileSettings } from "@/features/settings/components/TurnstileSettings";

export function BotProtectionSettings() {
  const t = useT("settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">
          {t("store.bot_protection_title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("store.bot_protection_subtitle")}
        </p>
      </div>
      <TurnstileSettings />
    </div>
  );
}
import { LOCALES, type Locale } from "@/i18n/config";
import { switchLocale, useLocale, useT } from "@/i18n/react";
import { Select } from "@/components/ui";

export default function LanguageSwitcher({ locale, inverted = false }: { locale?: Locale; inverted?: boolean }) {
  const t = useT("navigation");
  const detected = useLocale();
  const current = locale ?? detected;
  const labels: Record<Locale, string> = {
    ar: t("language.arabic"),
    en: t("language.english"),
    fr: t("language.french"),
  };

  return (
    <Select
      aria-label={t("language.label")}
      value={current}
      onChange={(event) => {
        switchLocale(event.currentTarget.value as Locale);
      }}
      variant={inverted ? "inverted" : "default"}
      size="sm"
      wrapperClassName="shrink-0"
      triggerClassName="min-w-24"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {labels[l]}
        </option>
      ))}
    </Select>
  );
}

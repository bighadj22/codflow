import { Card, Field, Input, Textarea } from "@/components/ui";
import { useT } from "@/i18n/react";

export function ShippingProfileInfoCard({
  name,
  onNameChange,
  notes,
  onNotesChange,
  isDefault,
  onIsDefaultChange,
  errors,
  busy,
}: {
  name: string;
  onNameChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  isDefault: boolean;
  onIsDefaultChange: (value: boolean) => void;
  errors: Record<string, string>;
  busy: boolean;
}) {
  const t = useT("settings");

  return (
    <Card title={t("shipping.form_info_section")}>
      <div className="grid gap-4">
        <Field label={`${t("shipping.profile_name_label")} *`} error={errors.name}>
          <Input
            value={name}
            onChange={(event) => onNameChange(event.currentTarget.value)}
            placeholder={t("shipping.profile_name_placeholder")}
            disabled={busy}
          />
        </Field>
        <Field label={t("shipping.notes_label")}>
          <Textarea
            value={notes}
            onChange={(event) => onNotesChange(event.currentTarget.value)}
            placeholder={t("shipping.notes_placeholder")}
            rows={3}
            disabled={busy}
          />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("shipping.set_as_default_label")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("shipping.set_as_default_hint")}
            </p>
          </div>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(event) => onIsDefaultChange(event.currentTarget.checked)}
            disabled={busy}
            className="size-5 accent-primary"
          />
        </label>
      </div>
    </Card>
  );
}

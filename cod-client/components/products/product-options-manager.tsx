"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProducts, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { useConfirm } from "@/components/ui/use-confirm";
import type { VariantOptionFormState, VariantOptionValueFormState } from "@/types";

interface Props {
  options: VariantOptionFormState[];
  onChange: (options: VariantOptionFormState[]) => void;
  disabled?: boolean;
}

function makeId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function ProductOptionsManager({ options, onChange, disabled = false }: Props) {
  const t = useProducts();
  const common = useCommon();
  const { dir } = useLanguage();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  function addOption() {
    onChange([...options, { id: makeId(), name: "", values: [] }]);
  }

  async function removeOption(optionId: string) {
    const ok = await confirmDialog({
      title: t.form.delete_option_confirm,
      variant: "destructive",
      confirmLabel: common.delete,
    });
    if (!ok) return;
    onChange(options.filter((o) => o.id !== optionId));
  }

  function updateOptionName(optionId: string, val: string) {
    onChange(options.map((o) => (o.id === optionId ? { ...o, name: val } : o)));
  }

  function addValue(optionId: string) {
    onChange(
      options.map((o) =>
        o.id === optionId
          ? { ...o, values: [...o.values, { id: makeId(), value: "", hexColor: "" }] }
          : o
      )
    );
  }

  function updateValue(optionId: string, valueId: string, field: keyof VariantOptionValueFormState, val: string) {
    onChange(
      options.map((o) =>
        o.id === optionId
          ? { ...o, values: o.values.map((v) => (v.id === valueId ? { ...v, [field]: val } : v)) }
          : o
      )
    );
  }

  function removeValue(optionId: string, valueId: string) {
    onChange(
      options.map((o) =>
        o.id === optionId ? { ...o, values: o.values.filter((v) => v.id !== valueId) } : o
      )
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-bold text-foreground">{t.form.options_label}</Label>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="w-3.5 h-3.5 me-1" />
            {t.form.add_option}
          </Button>
        )}
      </div>

      {options.map((option) => (
        <div key={option.id} className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          {/* Option name row */}
          <div className="flex items-center gap-2">
            <Input
              value={option.name}
              onChange={(e) => updateOptionName(option.id, e.target.value)}
              placeholder={t.form.option_name_placeholder}
              className="flex-1 text-sm"
              disabled={disabled}
              dir={dir}
            />
            {!disabled && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(option.id)} className="shrink-0 text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Values */}
          <div className="flex flex-wrap gap-2">
            {option.values.map((val) => (
              <div key={val.id} className="flex items-center gap-1 bg-background border border-border rounded-md px-2 py-1">
                {val.hexColor ? (
                  <>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: val.hexColor }} />
                    <input
                      type="color"
                      value={val.hexColor}
                      onChange={(e) => updateValue(option.id, val.id, "hexColor", e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                      disabled={disabled}
                      title="Pick color"
                    />
                  </>
                ) : !disabled && (
                  <button
                    type="button"
                    onClick={() => updateValue(option.id, val.id, "hexColor", "#cccccc")}
                    className="w-5 h-5 rounded border border-dashed border-border/60 text-muted-foreground/40 hover:text-muted-foreground flex items-center justify-center text-[10px] leading-none"
                    title="Add color"
                  >+</button>
                )}
                <Input
                  value={val.value}
                  onChange={(e) => updateValue(option.id, val.id, "value", e.target.value)}
                  placeholder={t.form.option_value_placeholder}
                  className="h-6 w-20 border-0 p-0 text-xs bg-transparent focus-visible:ring-0"
                  disabled={disabled}
                  dir={dir}
                />
                {!disabled && (
                  <button type="button" onClick={() => removeValue(option.id, val.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <Button type="button" variant="ghost" size="sm" onClick={() => addValue(option.id)} className="h-8 text-xs">
                <Plus className="w-3 h-3 me-1" />
                {t.form.add_option_value}
              </Button>
            )}
          </div>
        </div>
      ))}
      {ConfirmDialog}
    </div>
  );
}

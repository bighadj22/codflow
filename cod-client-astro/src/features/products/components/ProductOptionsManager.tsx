import { Plus, Trash2, X } from "lucide-react";
import { useT } from "@/i18n/react";
import { Button, useConfirmDialog } from "@/components/ui";
import type {
  VariantOptionFormState,
  VariantOptionValueFormState,
} from "@/features/products/types";

function makeId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function ProductOptionsManager({
  options,
  onChange,
  disabled = false,
}: {
  options: VariantOptionFormState[];
  onChange: (options: VariantOptionFormState[]) => void;
  disabled?: boolean;
}) {
  const t = useT("products");
  const common = useT("common");
  const confirm = useConfirmDialog();

  function addOption() {
    onChange([...options, { id: makeId(), name: "", values: [] }]);
  }
  async function removeOption(optionId: string) {
    if (
      !(await confirm({
        title: t("form.delete_option_confirm"),
        description: t("form.remove_variants_confirm_desc"),
        confirmLabel: common("remove"),
        tone: "danger",
      }))
    )
      return;
    onChange(options.filter((option) => option.id !== optionId));
  }
  function updateOptionName(optionId: string, value: string) {
    onChange(
      options.map((option) =>
        option.id === optionId ? { ...option, name: value } : option,
      ),
    );
  }
  function addValue(optionId: string) {
    onChange(
      options.map((option) =>
        option.id === optionId
          ? {
              ...option,
              values: [
                ...option.values,
                { id: makeId(), value: "", hexColor: "" },
              ],
            }
          : option,
      ),
    );
  }
  function updateValue(
    optionId: string,
    valueId: string,
    field: keyof VariantOptionValueFormState,
    value: string,
  ) {
    onChange(
      options.map((option) =>
        option.id === optionId
          ? {
              ...option,
              values: option.values.map((item) =>
                item.id === valueId ? { ...item, [field]: value } : item,
              ),
            }
          : option,
      ),
    );
  }
  function removeValue(optionId: string, valueId: string) {
    onChange(
      options.map((option) =>
        option.id === optionId
          ? {
              ...option,
              values: option.values.filter((item) => item.id !== valueId),
            }
          : option,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {t("form.options_label")}
        </p>
        {!disabled && (
          <Button
            type="button"
            variant="secondary"
            onClick={addOption}
            className="min-h-8 px-3 text-xs"
          >
            <Plus size={14} />
            {t("form.add_option")}
          </Button>
        )}
      </div>
      {options.map((option) => (
        <div
          key={option.id}
          className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
        >
          <div className="flex items-center gap-2">
            <input
              value={option.name}
              onChange={(event) =>
                updateOptionName(option.id, event.currentTarget.value)
              }
              placeholder={t("form.option_name_placeholder")}
              className="h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              disabled={disabled}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => void removeOption(option.id)}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={common("delete")}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => (
              <div
                key={value.id}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1"
              >
                {value.hexColor ? (
                  <>
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: value.hexColor }}
                    />
                    <input
                      type="color"
                      value={value.hexColor}
                      onChange={(event) =>
                        updateValue(
                          option.id,
                          value.id,
                          "hexColor",
                          event.currentTarget.value,
                        )
                      }
                      className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
                      disabled={disabled}
                      title="Pick color"
                    />
                  </>
                ) : (
                  !disabled && (
                    <button
                      type="button"
                      onClick={() =>
                        updateValue(option.id, value.id, "hexColor", "#cccccc")
                      }
                      className="grid size-5 place-items-center rounded border border-dashed border-border text-muted-foreground/40 hover:text-muted-foreground"
                      title="Add color"
                    >
                      +
                    </button>
                  )
                )}
                <input
                  value={value.value}
                  onChange={(event) =>
                    updateValue(
                      option.id,
                      value.id,
                      "value",
                      event.currentTarget.value,
                    )
                  }
                  placeholder={t("form.option_value_placeholder")}
                  className="h-6 w-20 bg-transparent p-0 text-xs outline-none disabled:opacity-50"
                  disabled={disabled}
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeValue(option.id, value.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={common("cancel")}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button
                type="button"
                onClick={() => addValue(option.id)}
                className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus size={13} />
                {t("form.add_option_value")}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import { useCallback } from "react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { useLocale, useT } from "@/i18n/react";
import { RICH_TEXT_MAX_CHARS } from "../../../../../cod-shared/lib/rich-text";

export interface RichTextDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Exact length of the value this field will save.
 *
 * Deliberately not TipTap's `CharacterCount`: the API caps the *stored string*,
 * and for an `html` description that string is the serialized HTML — tags
 * included, which a text-content count cannot see. Measuring the value that
 * will be sent keeps this number and the server's limit about the same thing.
 */
function DescriptionLength({ value }: { value: string }) {
  const t = useT("products");
  const locale = useLocale();
  const over = value.length > RICH_TEXT_MAX_CHARS;

  return (
    <p className="flex items-center justify-end gap-1 text-[12px] text-muted-foreground">
      <span className="sr-only">{t("toolbar.characters")}: </span>
      <span className={over ? "font-medium text-destructive" : undefined}>
        {value.length.toLocaleString(locale)}
      </span>
      <span aria-hidden="true">/</span>
      <span>{RICH_TEXT_MAX_CHARS.toLocaleString(locale)}</span>
      {over && <span className="ms-1 font-medium text-destructive">{t("toolbar.over_limit")}</span>}
    </p>
  );
}

/**
 * Description field — Tiptap "Simple editor" template.
 *
 * Storage rules live in the write chokepoint, never here. Loaded by dynamic
 * import from ProductBasicInfoCard, so the editor never joins the root bundle.
 */
export default function RichTextDescriptionEditor({
  value,
  onChange,
  disabled,
  busy,
}: RichTextDescriptionEditorProps) {
  const handleChange = useCallback(
    (html: string) => {
      onChange(html);
    },
    [onChange],
  );

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-card">
      <SimpleEditor
        value={value}
        onChange={handleChange}
        disabled={disabled}
        busy={busy}
      />
      <div className="border-t border-border/60 px-3 py-1">
        <DescriptionLength value={value} />
      </div>
    </div>
  );
}

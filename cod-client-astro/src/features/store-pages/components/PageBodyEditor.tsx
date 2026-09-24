import { useCallback } from "react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { useLocale, useT } from "@/i18n/react";
import { RICH_TEXT_MAX_CHARS } from "../../../../../cod-shared/lib/rich-text";

export interface PageBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Exact length of the value this field will save — see
 * RichTextDescriptionEditor's identical counter for why it measures the
 * serialized HTML rather than TipTap's own CharacterCount.
 */
function BodyLength({ value }: { value: string }) {
  const t = useT("store-pages");
  const locale = useLocale();
  const over = value.length > RICH_TEXT_MAX_CHARS;

  return (
    <p className="flex items-center justify-end gap-1 text-[12px] text-muted-foreground">
      <span className={over ? "font-medium text-destructive" : undefined}>
        {value.length.toLocaleString(locale)}
      </span>
      <span aria-hidden="true">/</span>
      <span>{RICH_TEXT_MAX_CHARS.toLocaleString(locale)}</span>
      {over && (
        <span className="ms-1 font-medium text-destructive">
          {t("errors.validation")}
        </span>
      )}
    </p>
  );
}

/**
 * A store page's body — the same Tiptap "Simple editor" template
 * RichTextDescriptionEditor uses for product descriptions, so a merchant
 * edits every rich-text field in this dashboard with one muscle-memory.
 *
 * Not imported from features/products: that component is bound to
 * useT("products") for its own strings. Loaded by dynamic import from
 * PageEditor, same as the product one, so TipTap never joins the root bundle.
 */
export default function PageBodyEditor({
  value,
  onChange,
  disabled,
  busy,
}: PageBodyEditorProps) {
  const handleChange = useCallback(
    (html: string) => {
      onChange(html);
    },
    [onChange],
  );

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-card">
      <SimpleEditor value={value} onChange={handleChange} disabled={disabled} busy={busy} />
      <div className="border-t border-border/60 px-3 py-1">
        <BodyLength value={value} />
      </div>
    </div>
  );
}

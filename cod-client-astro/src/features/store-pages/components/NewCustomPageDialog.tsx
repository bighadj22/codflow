import { useState } from "react";
import { FilePlus, Globe } from "lucide-react";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { isValidPageSlug, storePagesErrorMessage } from "@/features/store-pages/model";
import { createCustomPage } from "@/features/store-pages/api";
import type { PageLocale, StorePageDetail } from "@/features/store-pages/types";
import { Button, Dialog, Field, Input } from "@/components/ui";

interface NewCustomPageDialogProps {
  storeLang: PageLocale;
  onClose: () => void;
  onCreated: (page: StorePageDetail) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NewCustomPageDialog({ storeLang, onClose, onCreated }: NewCustomPageDialogProps) {
  const t = useT("store-pages");
  const common = useT("common");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleCreate() {
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = t("errors.validation");
    if (!isValidPageSlug(slug)) nextErrors.slug = t("errors.validation");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    try {
      const page = await createCustomPage({
        slug,
        locale: storeLang,
        title: title.trim(),
        bodyHtml: "<p></p>",
      });
      notify.success(t("editor.saved_toast"));
      onCreated(page);
    } catch (cause) {
      const message = storePagesErrorMessage(cause, t);
      setErrors({ slug: message });
      notify.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <FilePlus size={18} className="text-primary" />
          <span>{t("editor.new_page_title")}</span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {common("cancel")}
          </Button>
          <Button variant="primary" onClick={() => void handleCreate()} disabled={busy} className="font-semibold shadow-xs">
            {t("editor.create_button")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <Field label={t("editor.title_label")} error={errors.title}>
          <Input
            value={title}
            onChange={(event) => handleTitleChange(event.currentTarget.value)}
            disabled={busy}
            autoFocus
            placeholder="e.g. About Our Store, FAQ, Contact Us"
          />
        </Field>

        <Field label={t("editor.slug_label")} error={errors.slug} hint={t("editor.slug_hint")}>
          <div className="flex rounded-lg border border-border/80 bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
            <span className="inline-flex items-center px-3 bg-muted/40 text-muted-foreground text-xs font-mono border-e border-border/70 select-none">
              /pages/
            </span>
            <input
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.currentTarget.value);
              }}
              dir="ltr"
              className="flex-1 px-3 py-2 text-xs font-mono bg-transparent outline-none text-foreground"
              disabled={busy}
              placeholder="about-us"
            />
          </div>
        </Field>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2 font-mono">
          <Globe size={13} className="shrink-0 text-primary" />
          <span className="truncate">URL preview: /pages/{slug || "new-page"}</span>
        </div>
      </div>
    </Dialog>
  );
}

import { useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";

/** Shows the freshly rotated API key once, with copy + warning. */
export function RotateKeyDialog({
  open,
  apiKey,
  userName,
  onClose,
}: {
  open: boolean;
  apiKey: string | null;
  userName: string | null;
  onClose: () => void;
}) {
  const t = useT("team");
  const common = useT("common");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      notify.success(t("api_key_copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      notify.error(common("feedback.copy_failed"));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <KeyRound size={16} />
          </span>
          <span>
            {t("rotate_key_dialog.result_title")}
            {userName && (
              <span className="ms-2 text-xs font-medium text-muted-foreground">
                {t("rotate_key_dialog.result_subtitle").replace("{name}", userName)}
              </span>
            )}
          </span>
        </span>
      }
      className="max-w-sm"
      showClose={false}
    >
      {apiKey && (
        <>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-xs text-foreground">
              {apiKey}
            </code>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCopy()}
              aria-label={t("api_key_copied")}
            >
              {copied ? (
                <Check size={15} className="text-violet-500" />
              ) : (
                <Copy size={15} />
              )}
            </Button>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <Trash2 size={14} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-xs font-semibold leading-relaxed text-destructive">
              {t("rotate_key_dialog.warning")}
            </p>
          </div>
          <div className="mt-6">
            <Button type="button" className="w-full" onClick={onClose}>
              {t("rotate_key_dialog.done")}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

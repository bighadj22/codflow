import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Key } from "lucide-react";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import type { StoreConfig } from "@/features/settings/types";

export function ApiSettings({ storeConfig }: { storeConfig: StoreConfig }) {
  const t = useT("settings");
  const common = useT("common");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const apiKey = storeConfig.storeApiKey;

  async function handleCopy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      notify.success(t("store.api_key_copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      notify.error(common("feedback.copy_failed"));
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Key size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-foreground">{t("store.api_key_title")}</h2>
          <p className="text-xs text-muted-foreground">{t("store.api_key_subtitle")}</p>
        </div>
      </div>
      <div className="px-5 py-5">
        {apiKey ? (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              {t("store.api_key_label")}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  readOnly
                  dir="ltr"
                  type={revealed ? "text" : "password"}
                  value={apiKey}
                  className="h-10 w-full cursor-default select-all rounded-lg border border-border bg-background pe-10 ps-3 pr-10 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
                <button
                  type="button"
                  onClick={() => setRevealed((current) => !current)}
                  title={revealed ? t("store.api_key_hide") : t("store.api_key_reveal")}
                  aria-label={revealed ? t("store.api_key_hide") : t("store.api_key_reveal")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy()}
                title={t("store.api_key_copy")}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-violet-500" aria-hidden="true" />
                    {t("store.api_key_copied")}
                  </>
                ) : (
                  <>
                    <Copy size={14} aria-hidden="true" />
                    {t("store.api_key_copy")}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("store.api_key_missing")}</p>
        )}
      </div>
    </section>
  );
}

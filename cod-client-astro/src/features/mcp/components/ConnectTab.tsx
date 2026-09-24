import { useState } from "react";
import {
  Check,
  Copy,
  Globe,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";

/**
 * The "Connect" onboarding tab: an explanation of MCP and the copyable
 * MCP URL.
 */
export function ConnectTab({ mcpUrl }: { mcpUrl: string }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <WhatIsThis />
      <UrlHeroCard mcpUrl={mcpUrl} />
    </div>
  );
}

// ─── WhatIsThis ──────────────────────────────────────────────────────────────

function WhatIsThis() {
  const t = useT("mcp");
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card p-5 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <HelpCircle size={16} aria-hidden="true" />
          </span>
          <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-foreground/80">
            {t("help.title")}
          </p>
        </div>
        <div className="space-y-3">
          {[t("help.paragraph_1"), t("help.paragraph_2"), t("help.paragraph_3")].map(
            (paragraph, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-lg bg-primary/10 text-[9px] font-bold tabular-nums text-primary">
                  {index + 1}
                </span>
                <p className="flex-1 text-[13px] font-medium leading-relaxed text-foreground/70">
                  {paragraph}
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UrlHeroCard ─────────────────────────────────────────────────────────────

function UrlHeroCard({ mcpUrl }: { mcpUrl: string }) {
  const t = useT("mcp");
  const common = useT("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      notify.success(t("url_card.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      notify.error(common("feedback.copy_failed"));
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Globe size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
              {t("url_card.label")}
            </p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground/60">
              {t("url_card.hint")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row">
          <div
            dir="ltr"
            title={mcpUrl}
            className="flex h-11 min-w-0 flex-1 select-all items-center truncate rounded-xl border border-border/40 bg-background px-3.5 font-mono text-[13px] text-foreground/90"
          >
            {mcpUrl}
          </div>
          <Button
            type="button"
            onClick={() => void copy()}
            className={`h-11 px-4 text-[11px] font-bold uppercase tracking-widest ${copied ? "bg-violet-600 hover:bg-violet-600" : ""}`}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? t("url_card.copied") : t("url_card.copy")}
          </Button>
        </div>
      </div>
    </div>
  );
}


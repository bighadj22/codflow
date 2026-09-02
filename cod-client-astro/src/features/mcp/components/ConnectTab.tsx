import { useState } from "react";
import {
  Check,
  Copy,
  Globe,
  HelpCircle,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";

type SetupApp = "claude_desktop" | "claude_web" | "chatgpt" | "other";

/**
 * The "Connect" onboarding tab: an explanation of MCP, the copyable
 * MCP URL, and per-app setup snippets.
 */
export function ConnectTab({ mcpUrl }: { mcpUrl: string }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <WhatIsThis />
      <UrlHeroCard mcpUrl={mcpUrl} />
      <QuickSetup mcpUrl={mcpUrl} />
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

// ─── QuickSetup ──────────────────────────────────────────────────────────────

function QuickSetup({ mcpUrl }: { mcpUrl: string }) {
  const t = useT("mcp");
  const [tab, setTab] = useState<SetupApp>("claude_desktop");

  const claudeDesktopJson = `{
  "mcpServers": {
    "codflow": {
      "command": "npx",
      "args": ["mcp-remote", "${mcpUrl}"]
    }
  }
}`;

  const tabs: { id: SetupApp; label: string }[] = [
    { id: "claude_desktop", label: t("snippet.tab_claude_desktop") },
    { id: "claude_web", label: t("snippet.tab_claude_web") },
    { id: "chatgpt", label: t("snippet.tab_chatgpt") },
    { id: "other", label: t("snippet.tab_other") },
  ];

  return (
    <section className="space-y-4 overflow-hidden rounded-2xl border border-border/40 bg-card p-4 sm:p-5">
      <div>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-muted-foreground/70" aria-hidden="true" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
            {t("snippet.heading")}
          </h2>
        </div>
        <p className="mt-2 text-[12px] font-semibold text-muted-foreground/60">
          {t("snippet.description")}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => {
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "claude_desktop" && (
        <>
          <Instructions text={t("snippet.claude_desktop_instructions")} />
          <Snippet value={mcpUrl} />
          <Instructions text={t("snippet.claude_desktop_alt")} />
          <Snippet value={claudeDesktopJson} multiline />
        </>
      )}
      {tab === "claude_web" && (
        <>
          <Instructions text={t("snippet.claude_web_instructions")} />
          <Snippet value={mcpUrl} />
        </>
      )}
      {tab === "chatgpt" && (
        <>
          <Instructions text={t("snippet.chatgpt_instructions")} />
          <Snippet value={mcpUrl} />
        </>
      )}
      {tab === "other" && (
        <>
          <Instructions text={t("snippet.other_instructions")} />
          <Snippet value={`npx mcp-remote ${mcpUrl}`} />
        </>
      )}
    </section>
  );
}

// ─── Snippet helpers ─────────────────────────────────────────────────────────

function Instructions({ text }: { text: string }) {
  return (
    <p className="my-3 text-[12px] font-semibold leading-relaxed text-muted-foreground/70">
      {text}
    </p>
  );
}

function Snippet({ value, multiline = false }: { value: string; multiline?: boolean }) {
  const t = useT("mcp");
  const common = useT("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify.success(t("url_card.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      notify.error(common("feedback.copy_failed"));
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40 bg-background/60 shadow-sm">
      <pre
        dir="ltr"
        className={`overflow-x-auto whitespace-pre-wrap break-all p-3.5 pe-12 font-mono text-[12px] text-foreground/90 ${multiline ? "min-h-20" : "flex min-h-11 items-center"}`}
      >
        {value}
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t("snippet.copy_snippet")}
        className={`absolute end-2 top-2 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
          copied
            ? "border-violet-500/30 bg-violet-500/10 text-violet-600"
            : "border-border/40 bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
        }`}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? t("url_card.copied") : t("url_card.copy")}
      </button>
    </div>
  );
}

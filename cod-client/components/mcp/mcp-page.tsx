"use client";

/**
 * McpPage — the only view for the `/mcp` route.
 *
 * Three top-level tabs:
 *
 *   1. Connect       — URL hero + per-app setup snippets + "what is this"
 *                       help disclosure. The first thing a shop owner sees.
 *   2. Your          — this user's own connected AI agents, paginated.
 *      connections      Shop owners and staff land here after they're set up.
 *   3. Team          — admin-only audit of every teammate's connections,
 *                       paginated, with one-click revoke per row.
 *
 * Each tab is its own panel so we don't render the heavy revoke handlers
 * or pagination state for tabs the user isn't looking at. Mobile-first:
 * the tab strip uses icons + short labels and folds gracefully under
 * 360px. RTL-correct via logical Tailwind properties (ps/pe/ms/me,
 * start-*, end-*, border-s/border-e). Every visible string flows from
 * `useMcp()` / `useCommon()` — no hardcoded copy.
 */

import { useMemo, useState, useTransition } from "react";
import {
  Bot, Copy, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, HelpCircle,
  Loader2, CircleCheck, CircleAlert, Trash2, Users,
  Terminal, Globe, Sparkles, Lock, Plug,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/use-confirm";
import { showErrorToast, showSuccessToast } from "@/lib/errors/toast";
import { useErrorLocale } from "@/lib/errors/use-locale";
import { useMcp, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";
import type { McpConfig, McpConnection } from "@/actions/mcp";
import { revokeMyMcpConnection, revokeUserMcpConnection } from "@/actions/mcp";

const PAGE_SIZE = 6;

interface Props {
  config:           McpConfig;
  myConnections:    McpConnection[];
  teamConnections:  McpConnection[];
}

export function McpPage({ config, myConnections, teamConnections }: Props) {
  const t = useMcp();
  const common = useCommon();
  const { dir, locale } = useLanguage();
  const errorLocale = useErrorLocale();
  const { confirm, ConfirmDialog } = useConfirm();

  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isAdmin = config.currentUserRole === "admin";

  // Filter the user's own connections out of the team list so the admin
  // sees a single source of truth per tab (no duplicates between Mine + Team).
  const otherUsersConnections = useMemo(
    () => teamConnections.filter((c) => c.user && c.user.id !== config.currentUserId),
    [teamConnections, config.currentUserId],
  );

  async function handleRevokeMine(conn: McpConnection) {
    const ok = await confirm({
      title:        t.my_connections.revoke_confirm_title,
      description:  interp(t.my_connections.revoke_confirm_description, {
        app: conn.clientName ?? conn.clientId,
      }),
      confirmLabel: t.my_connections.revoke_confirm,
      cancelLabel:  t.my_connections.revoke_cancel,
      variant:      "destructive",
    });
    if (!ok) return;

    setPendingRevoke(conn.clientId);
    startTransition(async () => {
      try {
        await revokeMyMcpConnection(conn.clientId);
        showSuccessToast(t.my_connections.revoke_success, errorLocale);
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : t.my_connections.revoke_error, errorLocale);
      } finally {
        setPendingRevoke(null);
      }
    });
  }

  async function handleRevokeTeam(conn: McpConnection) {
    if (!conn.user) return;
    const ok = await confirm({
      title:        t.my_connections.revoke_confirm_title,
      description:  interp(t.my_connections.revoke_confirm_description, {
        app: `${conn.clientName ?? conn.clientId} (${conn.user.email})`,
      }),
      confirmLabel: t.my_connections.revoke_confirm,
      cancelLabel:  t.my_connections.revoke_cancel,
      variant:      "destructive",
    });
    if (!ok) return;

    const revokeKey = `${conn.user.id}:${conn.clientId}`;
    setPendingRevoke(revokeKey);
    startTransition(async () => {
      try {
        await revokeUserMcpConnection(conn.clientId, conn.user!.id);
        showSuccessToast(t.my_connections.revoke_success, errorLocale);
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : t.my_connections.revoke_error, errorLocale);
      } finally {
        setPendingRevoke(null);
      }
    });
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-12" dir={dir}>
      {/* ── Page header ────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group">
            <div className="absolute inset-0 bg-primary/5 rounded-xl blur-xl group-hover:bg-primary/10 transition-all" />
            <Sparkles size={18} className="text-primary relative z-10 group-hover:scale-110 group-hover:rotate-3 transition-transform" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">
              {t.page_title}
            </h1>
            <p className="text-[12px] sm:text-sm text-muted-foreground/70 font-semibold truncate">
              {t.page_subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* ── Top-level tabs ──────────────────────────────────────── */}
      <Tabs defaultValue="connect" className="w-full">
        <TabsList className="bg-muted/30 border border-border/20 p-1 rounded-xl h-11 w-full sm:w-auto inline-flex">
          <TabsTrigger
            value="connect"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 rounded-lg flex-1 sm:flex-initial data-[state=active]:bg-white dark:data-[state=active]:bg-primary data-[state=active]:text-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-black text-[10px] uppercase tracking-widest transition-all"
          >
            <Plug size={14} />
            <span className="truncate">{t.tabs.connect}</span>
          </TabsTrigger>
          <TabsTrigger
            value="mine"
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 rounded-lg flex-1 sm:flex-initial data-[state=active]:bg-white dark:data-[state=active]:bg-primary data-[state=active]:text-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-black text-[10px] uppercase tracking-widest transition-all"
          >
            <Bot size={14} />
            <span className="truncate">{t.tabs.mine}</span>
            {myConnections.length > 0 && (
              <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full tabular-nums">
                {myConnections.length}
              </span>
            )}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="team"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 rounded-lg flex-1 sm:flex-initial data-[state=active]:bg-white dark:data-[state=active]:bg-primary data-[state=active]:text-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm font-black text-[10px] uppercase tracking-widest transition-all"
            >
              <Users size={14} />
              <span className="truncate">{t.tabs.team}</span>
              {otherUsersConnections.length > 0 && (
                <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full tabular-nums">
                  {otherUsersConnections.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Connect tab — explanation first, then URL, then setup ── */}
        <TabsContent value="connect" className="mt-4 sm:mt-5 space-y-4 sm:space-y-5 animate-fade-in-up">
          <WhatIsThis t={t} />
          <UrlHeroCard mcpUrl={config.mcpUrl} t={t} />
          <QuickSetup mcpUrl={config.mcpUrl} t={t} dir={dir} />
        </TabsContent>

        {/* ── Your connections tab ─────────────────────────────── */}
        <TabsContent value="mine" className="mt-4 sm:mt-5 animate-fade-in-up">
          <PaginatedConnections
            connections={myConnections}
            renderCard={(conn) => (
              <ConnectionCard
                key={conn.clientId}
                conn={conn}
                pending={pendingRevoke === conn.clientId}
                onRevoke={() => handleRevokeMine(conn)}
                t={t}
                locale={locale}
              />
            )}
            emptyTitle={t.my_connections.empty_title}
            emptyDescription={t.my_connections.empty_description}
            emptyIcon={Bot}
            common={common}
            dir={dir}
          />
        </TabsContent>

        {/* ── Team connections tab (admin-only) ────────────────── */}
        {isAdmin && (
          <TabsContent value="team" className="mt-4 sm:mt-5 space-y-3 animate-fade-in-up">
            <p className="text-[12px] text-muted-foreground/60 font-semibold leading-relaxed px-1">
              {t.team_connections.description}
            </p>
            <PaginatedConnections
              connections={otherUsersConnections}
              renderCard={(conn) => {
                const key = conn.user ? `${conn.user.id}:${conn.clientId}` : conn.clientId;
                return (
                  <ConnectionCard
                    key={key}
                    conn={conn}
                    pending={pendingRevoke === key}
                    onRevoke={() => handleRevokeTeam(conn)}
                    t={t}
                    locale={locale}
                    showOwner
                  />
                );
              }}
              emptyTitle={t.team_connections.empty_title}
              emptyDescription={t.team_connections.empty_description}
              emptyIcon={Users}
              common={common}
              dir={dir}
            />
          </TabsContent>
        )}
      </Tabs>

      {ConfirmDialog}
    </div>
  );
}

// ─── PaginatedConnections ────────────────────────────────────────────────────

function PaginatedConnections({
  connections, renderCard, emptyTitle, emptyDescription, emptyIcon, common, dir,
}: {
  connections: McpConnection[];
  renderCard: (conn: McpConnection) => React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: LucideIcon;
  common: ReturnType<typeof useCommon>;
  dir: "rtl" | "ltr";
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(connections.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const visible = connections.slice(startIdx, startIdx + PAGE_SIZE);

  if (connections.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {visible.map(renderCard)}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <div className="text-[11px] font-medium text-muted-foreground/60">
            {common.table.showing
              .replace("{from}", String(startIdx + 1))
              .replace("{to}",   String(Math.min(startIdx + PAGE_SIZE, connections.length)))
              .replace("{total}", String(connections.length))}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              aria-label={common.table.page}
            >
              {dir === "rtl" ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label={common.table.page}
            >
              {dir === "rtl" ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </Button>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border border-border/60 shadow-xs">
              <span className="text-[11px] font-medium text-muted-foreground/60">{common.table.page}</span>
              <span className="text-[13px] font-bold text-primary tabular-nums">{safePage}</span>
              <span className="text-[11px] font-medium text-muted-foreground/60">{common.table.of} {totalPages}</span>
            </div>

            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label={common.table.page}
            >
              {dir === "rtl" ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-lg h-8 w-8 border-border/60"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label={common.table.page}
            >
              {dir === "rtl" ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UrlHeroCard ─────────────────────────────────────────────────────────────

function UrlHeroCard({ mcpUrl, t }: { mcpUrl: string; t: ReturnType<typeof useMcp> }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 glass-card group">
      <div className="absolute -top-12 -end-12 w-40 h-40 bg-primary/10 blur-[120px] rounded-full pointer-events-none group-hover:bg-primary/15 transition-all duration-700" />
      <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />

      <div className="relative p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group/icon">
            <div className="absolute inset-0 bg-primary/10 rounded-xl blur-md group-hover/icon:bg-primary/20 transition-all" />
            <Globe size={16} className="text-primary relative z-10 group-hover/icon:scale-110 transition-transform" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 leading-none">
              {t.url_card.label}
            </p>
            <p className="text-[11px] sm:text-[12px] text-muted-foreground/60 font-semibold mt-1 leading-relaxed">
              {t.url_card.hint}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div
            className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-border/40 bg-background/60 backdrop-blur flex items-center font-mono text-[13px] text-foreground/90 truncate select-all shadow-sm hover:border-border/60 transition-colors"
            dir="ltr"
            title={mcpUrl}
          >
            {mcpUrl}
          </div>
          <Button
            onClick={copy}
            className={cn(
              "h-11 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md transition-all",
              copied && "bg-emerald-500 hover:bg-emerald-500/90 shadow-emerald-500/20",
            )}
          >
            {copied ? <Check size={14} className="me-1.5" /> : <Copy size={14} className="me-1.5" />}
            {copied ? t.url_card.copied : t.url_card.copy}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── QuickSetup (per-app snippets) ───────────────────────────────────────────

function QuickSetup({
  mcpUrl, t, dir,
}: {
  mcpUrl: string;
  t: ReturnType<typeof useMcp>;
  dir: "rtl" | "ltr";
}) {
  const claudeDesktopJson = `{
  "mcpServers": {
    "codflow": {
      "command": "npx",
      "args": ["mcp-remote", "${mcpUrl}"]
    }
  }
}`;

  const claudeWebUrl = mcpUrl;
  const chatgptUrl   = mcpUrl;
  const otherCmd     = `npx mcp-remote ${mcpUrl}`;

  return (
    <section className="relative glass-card rounded-2xl border-border/40 p-4 sm:p-5 space-y-4 overflow-hidden group">
      <div className="absolute inset-0 bg-noise opacity-[0.01] pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-muted-foreground/70 group-hover:text-muted-foreground transition-colors" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            {t.snippet.heading}
          </h2>
        </div>
        <p className="text-[12px] text-muted-foreground/60 font-semibold mt-2">
          {t.snippet.description}
        </p>

        <Tabs defaultValue="claude_desktop" className="mt-4">
          {/* Scrollable on mobile so 4 tabs never overflow or wrap */}
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1 scrollbar-none">
            <TabsList className="w-max min-w-full">
              <TabsTrigger value="claude_desktop">{t.snippet.tab_claude_desktop}</TabsTrigger>
              <TabsTrigger value="claude_web">{t.snippet.tab_claude_web}</TabsTrigger>
              <TabsTrigger value="chatgpt">{t.snippet.tab_chatgpt}</TabsTrigger>
              <TabsTrigger value="other">{t.snippet.tab_other}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="claude_desktop">
            <Instructions text={t.snippet.claude_desktop_instructions} />
            <Snippet multiline value={claudeDesktopJson} t={t} dir={dir} />
          </TabsContent>

          <TabsContent value="claude_web">
            <Instructions text={t.snippet.claude_web_instructions} />
            <Snippet value={claudeWebUrl} t={t} dir={dir} />
          </TabsContent>

          <TabsContent value="chatgpt">
            <Instructions text={t.snippet.chatgpt_instructions} />
            <Snippet value={chatgptUrl} t={t} dir={dir} />
          </TabsContent>

          <TabsContent value="other">
            <Instructions text={t.snippet.other_instructions} />
            <Snippet value={otherCmd} t={t} dir={dir} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function Instructions({ text }: { text: string }) {
  return (
    <p className="text-[12px] text-muted-foreground/70 font-semibold my-3 leading-relaxed">
      {text}
    </p>
  );
}

function Snippet({
  value, multiline = false, t, dir,
}: {
  value: string;
  multiline?: boolean;
  t: ReturnType<typeof useMcp>;
  dir: "rtl" | "ltr";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative rounded-xl bg-background/60 border border-border/40 overflow-hidden group shadow-sm hover:shadow-md hover:border-border/60 transition-all">
      <pre
        dir="ltr"
        className={cn(
          "font-mono text-[12px] text-foreground/90 overflow-x-auto p-3.5 pe-12 whitespace-pre-wrap break-all",
          multiline ? "min-h-[80px]" : "min-h-[44px] flex items-center",
        )}
      >{value}</pre>
      <button
        onClick={copy}
        className={cn(
          "absolute top-2 end-2 h-8 px-2.5 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95",
          copied
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shadow-sm"
            : "bg-background/70 text-muted-foreground hover:text-foreground border-border/40 hover:bg-background/90",
        )}
        aria-label={t.snippet.copy_snippet}
        // eslint-disable-next-line react/no-unknown-property
        dir={dir}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? t.url_card.copied : t.url_card.copy}
      </button>
    </div>
  );
}

// ─── WhatIsThis — always-visible explanation card shown first ────────────────

function WhatIsThis({ t }: { t: ReturnType<typeof useMcp> }) {
  return (
    <div className="relative glass-card rounded-2xl border-primary/10 p-5 sm:p-6 overflow-hidden group">
      <div className="absolute -top-8 -end-8 w-36 h-36 bg-primary/6 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-noise opacity-[0.01] pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 bg-primary/5 rounded-xl blur-md" />
            <HelpCircle size={16} className="text-primary relative z-10 group-hover:scale-110 transition-transform duration-300" />
          </div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-foreground/80">
            {t.help.title}
          </p>
        </div>

        {/* Three paragraphs */}
        <div className="space-y-3 ps-0.5">
          {[t.help.paragraph_1, t.help.paragraph_2, t.help.paragraph_3].map((para, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[9px] font-black text-primary tabular-nums">{i + 1}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground/70 font-medium flex-1">
                {para}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ConnectionCard ──────────────────────────────────────────────────────────

function ConnectionCard({
  conn, pending, onRevoke, t, locale, showOwner = false,
}: {
  conn: McpConnection;
  pending: boolean;
  onRevoke: () => void;
  t: ReturnType<typeof useMcp>;
  locale: string;
  showOwner?: boolean;
}) {
  const [scopesOpen, setScopesOpen] = useState(false);
  const appLabel = conn.clientName?.trim() || conn.clientId;

  return (
    <div className="relative glass-card rounded-2xl border-border/40 p-4 sm:p-5 space-y-3 overflow-hidden group hover:border-border/60 transition-all">
      <div className="absolute inset-0 bg-noise opacity-[0.01] pointer-events-none" />

      {/* Row 1: icon + app + status + revoke button */}
      <div className="flex items-start gap-3 relative z-10">
        <div className="relative w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center shrink-0 overflow-hidden group/icon">
          <div className="absolute inset-0 bg-muted/20 rounded-xl blur-md group-hover/icon:bg-muted/30 transition-all" />
          {conn.clientIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conn.clientIconUrl} alt={appLabel} className="w-full h-full object-cover relative z-10" />
          ) : (
            <Bot size={18} className="text-muted-foreground/70 relative z-10 group-hover/icon:scale-110 transition-transform" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-black text-foreground truncate">{appLabel}</p>
            <StatusBadge active={conn.active} t={t} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {showOwner && conn.user && (
              <span className="text-[11px] text-primary/80 font-semibold truncate inline-flex items-center gap-1">
                <Users size={10} />
                {conn.user.name || conn.user.email}
              </span>
            )}
            {/*
              "Last used" intentionally not shown. Better Auth issues JWT
              access tokens — verified offline against the JWKS — and never
              writes them to oauthAccessTokens, so we have no truthful signal
              for last activity. Showing a misleading "Never used" was worse
              than showing nothing. If we ever add per-call usage tracking
              (KV write in cod-server's bearerToProps) we can bring it back.
            */}
            <span className="text-[11px] text-muted-foreground/40 font-semibold">
              {interp(t.my_connections.connected_at, { date: relativeTime(conn.connectedAt, t, locale) })}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={onRevoke}
          disabled={pending}
          className="h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-rose-600 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/50 shrink-0 active:scale-95"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} className="me-1.5" />}
          <span className="hidden sm:inline">{t.my_connections.revoke}</span>
        </Button>
      </div>

      {/* Row 2: scopes summary + expand */}
      <button
        onClick={() => setScopesOpen((v) => !v)}
        className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/70 hover:text-foreground transition-colors relative z-10 active:scale-[0.98]"
      >
        <Lock size={11} />
        <span>
          {pluralize(
            t.my_connections.scope_count_one,
            t.my_connections.scope_count_other,
            conn.scopes.length,
          )}
        </span>
        {scopesOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {scopesOpen && (
        <ul className="flex flex-wrap gap-1.5 pt-1 relative z-10 animate-fade-in">
          {conn.scopes.map((scope) => (
            <li
              key={scope}
              className="font-mono text-[10px] font-bold px-2 py-1 rounded-md bg-primary/5 text-primary/80 border border-primary/10 hover:bg-primary/10 transition-colors"
            >
              {scope}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ active, t }: { active: boolean; t: ReturnType<typeof useMcp> }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
        active
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          : "bg-muted/40 text-muted-foreground/60 border-border/30",
      )}
    >
      {active ? <CircleCheck size={8} /> : <CircleAlert size={8} />}
      {active ? t.my_connections.active : t.my_connections.inactive}
    </span>
  );
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function interp(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`);
}

function pluralize(one: string, other: string, count: number): string {
  const template = count === 1 ? one : other;
  return interp(template, { count: String(count) });
}

function relativeTime(iso: string, t: ReturnType<typeof useMcp>, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return t.time.just_now;
  if (diffMin < 60) return pluralize(t.time.minutes_ago_one, t.time.minutes_ago_other, diffMin);
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return pluralize(t.time.hours_ago_one, t.time.hours_ago_other, diffHr);
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return pluralize(t.time.days_ago_one, t.time.days_ago_other, diffDay);
  return new Date(iso).toLocaleDateString(
    locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  );
}

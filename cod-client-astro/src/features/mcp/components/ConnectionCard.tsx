import { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Loader2,
  Lock,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { interp, pluralize, relativeTime } from "@/features/mcp/model";
import type { McpConnection } from "@/features/mcp/types";

function StatusBadge({ active }: { active: boolean }) {
  const t = useT("mcp");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
        active
          ? "border-violet-500/20 bg-violet-500/10 text-violet-600"
          : "border-border/30 bg-muted/40 text-muted-foreground/60"
      }`}
    >
      {active ? <CircleCheck size={8} aria-hidden="true" /> : <CircleAlert size={8} aria-hidden="true" />}
      {active ? t("my_connections.active") : t("my_connections.inactive")}
    </span>
  );
}

/**
 * One connected AI agent. Shows the app identity, owner (team view only),
 * connection time, the granted scopes (expandable), and a revoke action.
 */
export function ConnectionCard({
  conn,
  pending,
  showOwner = false,
  onRevoke,
}: {
  conn: McpConnection;
  pending: boolean;
  onRevoke: () => void;
  showOwner?: boolean;
}) {
  const t = useT("mcp");
  const locale = useLocale();
  const [scopesOpen, setScopesOpen] = useState(false);
  const appLabel = conn.clientName?.trim() || conn.clientId;

  return (
    <div className="space-y-3 rounded-2xl border border-border/40 bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted/40 text-muted-foreground/70">
          {conn.clientIconUrl ? (
            <img src={conn.clientIconUrl} alt={appLabel} className="h-full w-full object-cover" />
          ) : (
            <Bot size={18} aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-bold text-foreground">{appLabel}</p>
            <StatusBadge active={conn.active} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {showOwner && conn.user && (
              <span className="inline-flex items-center gap-1 truncate text-[11px] font-semibold text-primary/80">
                <Users size={10} aria-hidden="true" />
                {conn.user.name || conn.user.email}
              </span>
            )}
            <span className="text-[11px] font-semibold text-muted-foreground/40">
              {interp(t("my_connections.connected_at"), {
                date: relativeTime(conn.connectedAt, t, locale),
              })}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground/40">
              {conn.lastUsedAt
                ? interp(t("my_connections.last_used"), {
                    when: relativeTime(conn.lastUsedAt, t, locale),
                  })
                : t("my_connections.never_used")}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="dangerOutline"
          onClick={onRevoke}
          disabled={pending}
          className="h-9 shrink-0 px-3 text-[10px] font-bold uppercase tracking-widest"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          <span className="hidden sm:inline">{t("my_connections.revoke")}</span>
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setScopesOpen((current) => !current)}
        aria-expanded={scopesOpen}
        className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <Lock size={11} aria-hidden="true" />
        <span>
          {pluralize("my_connections.scope_count_one", "my_connections.scope_count_other", conn.scopes.length, t)}
        </span>
        {scopesOpen ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
      </button>

      {scopesOpen && (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {conn.scopes.map((scope) => (
            <li
              key={scope}
              className="rounded-md border border-primary/10 bg-primary/5 px-2 py-1 font-mono text-[10px] font-bold text-primary/80"
            >
              {scope}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, Plug, Users, X, type LucideIcon } from "lucide-react";
import { PUBLIC_API_URL } from "astro:env/client";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import { Alert, useConfirmDialog } from "@/components/ui";
import {
  listMyMcpConnections,
  listTeamMcpConnections,
  revokeMyMcpConnection,
  revokeUserMcpConnection,
} from "@/features/mcp/api";
import {
  connectionKey,
  interp,
  mcpApiUrl,
  mcpErrorMessage,
  otherUsersConnections,
} from "@/features/mcp/model";
import type { McpConnection } from "@/features/mcp/types";
import { ConnectTab } from "@/features/mcp/components/ConnectTab";
import { ConnectionsList } from "@/features/mcp/components/ConnectionsList";

type TabId = "connect" | "mine" | "team";

interface TabItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  count: number;
}

function McpSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="h-36 animate-pulse rounded-xl bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-xl border border-border/20 bg-muted/30 p-1">
      {tabs.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors sm:flex-initial sm:px-4 ${
              isActive
                ? "bg-card text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
            {item.count > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-primary">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Orchestrates the /mcp page: loads the caller's + team's connections,
 * owns the tab state, and drives revoke flows for both self and team rows.
 */
export function McpPageContent() {
  const t = useT("mcp");
  const auth = useT("auth");
  const common = useT("common");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [tab, setTab] = useState<TabId>("connect");
  const [myConnections, setMyConnections] = useState<McpConnection[] | null>(null);
  const [teamConnections, setTeamConnections] = useState<McpConnection[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const isAdmin = identity?.role === "admin";
  const mcpUrl = mcpApiUrl(PUBLIC_API_URL);

  async function load() {
    setLoadError(null);
    try {
      const [mine, team] = await Promise.all([
        listMyMcpConnections(),
        isAdmin ? listTeamMcpConnections().catch(() => []) : Promise.resolve([]),
      ]);
      setMyConnections(mine);
      setTeamConnections(team);
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.MCP_VIEW)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  const others = useMemo(
    () => otherUsersConnections(teamConnections, identity?.user.id ?? ""),
    [teamConnections, identity?.user.id],
  );

  async function handleRevoke(conn: McpConnection, forUser: boolean) {
    const ok = await confirm({
      title: t("my_connections.revoke_confirm_title"),
      description: interp(t("my_connections.revoke_confirm_description"), {
        app: forUser && conn.user
          ? `${conn.clientName ?? conn.clientId} (${conn.user.email})`
          : (conn.clientName ?? conn.clientId),
      }),
      confirmLabel: t("my_connections.revoke_confirm"),
      cancelLabel: t("my_connections.revoke_cancel"),
      tone: "danger",
    });
    if (!ok) return;

    const revokeKey = connectionKey(conn);
    setPendingRevoke(revokeKey);
    try {
      if (forUser && conn.user) {
        await revokeUserMcpConnection(conn.clientId, conn.user.id);
        setTeamConnections((current) =>
          current.filter((item) => connectionKey(item) !== revokeKey),
        );
      } else {
        await revokeMyMcpConnection(conn.clientId);
        setMyConnections((current) =>
          current?.filter((item) => item.clientId !== conn.clientId) ?? current,
        );
      }
      notify.success(t("my_connections.revoke_success"));
    } catch (cause) {
      setActionError(mcpErrorMessage(cause, t));
      notify.error(t("my_connections.revoke_error"));
    } finally {
      setPendingRevoke(null);
    }
  }

  if (!canScope(identity, SCOPES.MCP_VIEW))
    return (
      <Alert role="alert" tone="critical">
        {auth("no_access")}
      </Alert>
    );
  if (loadError)
    return (
      <Alert role="alert" tone="critical">
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">{t("my_connections.revoke_error")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  if (myConnections === null) return <McpSkeleton />;

  const tabs: TabItem[] = [
    { id: "connect", label: t("tabs.connect"), icon: Plug, count: 0 },
    { id: "mine", label: t("tabs.mine"), icon: Bot, count: myConnections.length },
  ];
  if (isAdmin) tabs.push({ id: "team", label: t("tabs.team"), icon: Users, count: others.length });

  return (
    <div className="space-y-5 pb-12">
      {actionError && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label={common("cancel")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </Alert>
      )}

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "connect" && <ConnectTab mcpUrl={mcpUrl} />}

      {tab === "mine" && (
        <ConnectionsList
          connections={myConnections}
          pendingKey={pendingRevoke}
          onRevoke={(conn) => void handleRevoke(conn, false)}
          emptyTitle={t("my_connections.empty_title")}
          emptyDescription={t("my_connections.empty_description")}
          emptyIcon={Bot}
        />
      )}

      {isAdmin && tab === "team" && (
        <div className="space-y-3">
          <p className="px-1 text-[12px] font-semibold leading-relaxed text-muted-foreground/60">
            {t("team_connections.description")}
          </p>
          <ConnectionsList
            connections={others}
            showOwner
            pendingKey={pendingRevoke}
            onRevoke={(conn) => void handleRevoke(conn, true)}
            emptyTitle={t("team_connections.empty_title")}
            emptyDescription={t("team_connections.empty_description")}
            emptyIcon={Users}
          />
        </div>
      )}
    </div>
  );
}

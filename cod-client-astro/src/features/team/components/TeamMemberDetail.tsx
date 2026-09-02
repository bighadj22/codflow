import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Crown,
  Mail,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { useIdentity } from "@/features/auth/components/RequireAuth";
import { useLocale, useT } from "@/i18n/react";
import { Alert } from "@/components/ui";
import { getTeamMember } from "@/features/team/api";
import { formatTeamDate, teamScopeCount } from "@/features/team/model";
import type { TeamMember } from "@/features/team/types";
import {
  RoleBadge,
  StatusBadge,
} from "@/features/team/components/TeamMemberBadges";
import { TeamActivitySection } from "@/features/team/components/TeamActivitySection";

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function TeamMemberDetail({ memberId }: { memberId: string }) {
  const t = useT("team");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  async function load() {
    setLoadError(null);
    try {
      setMember(await getTeamMember(memberId));
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (identity?.role === "admin") void load();
  }, [identity?.role, memberId]);

  if (identity?.role !== "admin")
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
          <p className="font-semibold">{t("error_load")}</p>
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
  if (member === null) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            className={`grid size-16 shrink-0 place-items-center rounded-2xl text-white ${member.role === "admin" ? "bg-primary" : "bg-muted text-muted-foreground/40"}`}
          >
            {member.role === "admin" ? (
              <Crown size={30} aria-hidden="true" />
            ) : (
              <UserIcon size={30} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-foreground">
              {member.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
              <Mail size={12} className="me-1 inline text-primary/40" />
              {member.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleBadge role={member.role} />
              <StatusBadge status={member.status} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              <CalendarDays size={11} className="text-primary/50" />
              {t("joined")}
            </p>
            <p className="mt-1 text-base font-bold text-foreground">
              {formatTeamDate(member.createdAt, locale)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              <Shield size={11} className="text-primary/50" />
              {t("table.permissions")}
            </p>
            <p className="mt-1 text-base font-bold tabular-nums text-foreground">
              {teamScopeCount(member)}
            </p>
          </div>
          <div className="hidden rounded-xl border border-border bg-muted/30 p-3 sm:block">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              <Clock size={11} className="text-rose-500/50" />
              {t("activity_log.stats.last_active")}
            </p>
            <p className="mt-1 truncate text-base font-bold text-foreground">
              —
            </p>
          </div>
        </div>
      </div>

      <TeamActivitySection memberId={memberId} />
    </div>
  );
}

import { Activity, Crown, KeyRound, MoreHorizontal, Shield, Users } from "lucide-react";
import {
  Badge,
  DropdownItem,
  DropdownMenu,
  TableCell,
  TableRow,
} from "@/components/ui";
import { useT } from "@/i18n/react";
import { teamScopeCount } from "@/features/team/model";
import type { TeamMember } from "@/features/team/types";

function RoleBadge({ role }: { role: TeamMember["role"] }) {
  const common = useT("common");
  return role === "admin" ? (
    <Badge tone="warning">
      <Crown size={11} fill="currentColor" aria-hidden="true" />
      <span className="ms-1">{common("roles.admin")}</span>
    </Badge>
  ) : (
    <Badge tone="neutral">{common("roles.staff")}</Badge>
  );
}

function StatusBadge({ status }: { status: TeamMember["status"] }) {
  const t = useT("team");
  return status === "active" ? (
    <Badge tone="success">{t("status.active")}</Badge>
  ) : (
    <Badge tone="neutral">{t("status.inactive")}</Badge>
  );
}

function MemberActionsMenu({
  member,
  onView,
  onManageScopes,
  onRotateApiKey,
}: {
  member: TeamMember;
  onView: (member: TeamMember) => void;
  onManageScopes: (member: TeamMember) => void;
  onRotateApiKey: (member: TeamMember) => void;
}) {
  const t = useT("team");
  const common = useT("common");
  return (
    <DropdownMenu
      trigger={<MoreHorizontal size={16} />}
      triggerLabel={common("table.actions")}
    >
      <DropdownItem onClick={() => onView(member)}>
        <Activity size={15} />
        {t("view_activity")}
      </DropdownItem>
      <DropdownItem onClick={() => onManageScopes(member)}>
        <Shield size={15} />
        {t("manage_permissions")}
      </DropdownItem>
      <DropdownItem onClick={() => onRotateApiKey(member)}>
        <KeyRound size={15} />
        {t("rotate_api_key")}
      </DropdownItem>
    </DropdownMenu>
  );
}

export function TeamDesktopRow({
  member,
  onView,
  onManageScopes,
  onRotateApiKey,
}: {
  member: TeamMember;
  onView: (member: TeamMember) => void;
  onManageScopes: (member: TeamMember) => void;
  onRotateApiKey: (member: TeamMember) => void;
}) {
  const t = useT("team");
  const common = useT("common");
  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold text-foreground">
          {member.name}
          {member.role === "admin" && (
            <Crown
              size={13}
              className="ms-1.5 inline text-yellow-600"
              aria-label={common("roles.admin")}
            />
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm" dir="ltr">
        {member.email}
      </TableCell>
      <TableCell>
        <RoleBadge role={member.role} />
      </TableCell>
      <TableCell>
        <StatusBadge status={member.status} />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Shield size={13} className="text-muted-foreground" aria-hidden="true" />
          {teamScopeCount(member)} {t("table.scopes")}
        </span>
      </TableCell>
      <TableCell className="text-end">
        <MemberActionsMenu
          member={member}
          onView={onView}
          onManageScopes={onManageScopes}
          onRotateApiKey={onRotateApiKey}
        />
      </TableCell>
    </TableRow>
  );
}

export function TeamMobileCard({
  member,
  onView,
  onManageScopes,
  onRotateApiKey,
}: {
  member: TeamMember;
  onView: (member: TeamMember) => void;
  onManageScopes: (member: TeamMember) => void;
  onRotateApiKey: (member: TeamMember) => void;
}) {
  const t = useT("team");
  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${member.role === "admin" ? "bg-yellow-500/15 text-yellow-600" : "bg-muted text-muted-foreground"}`}
        >
          {member.role === "admin" ? <Crown size={18} /> : <Users size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-foreground">{member.name}</p>
            <MemberActionsMenu
              member={member}
              onView={onView}
              onManageScopes={onManageScopes}
              onRotateApiKey={onRotateApiKey}
            />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground" dir="ltr">
            {member.email}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RoleBadge role={member.role} />
            <StatusBadge status={member.status} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
        <Shield size={14} className="shrink-0 text-primary/60" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {t("table.permissions")}
          </span>
          <span className="block text-sm font-bold tabular-nums text-foreground">
            {teamScopeCount(member)} {t("table.scopes")}
          </span>
        </span>
      </div>
      <div className="pt-3">
        <a
          href={`/team/${encodeURIComponent(member.id)}`}
          className="block w-full rounded-xl border border-border bg-card py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-muted/50"
        >
          {t("view_activity")}
        </a>
      </div>
    </article>
  );
}

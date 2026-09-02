import { useDeferredValue, useEffect, useState } from "react";
import { AlertCircle, Users, UserPlus, X } from "lucide-react";
import { useIdentity } from "@/features/auth/components/RequireAuth";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Pagination,
  SearchInput,
  Select,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  SortHeader,
  useConfirmDialog,
} from "@/components/ui";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import {
  filterTeamMembers,
  paginateTeamMembers,
  sortTeamMembers,
  teamErrorMessage,
  type TeamFilters,
  type TeamSortKey,
} from "@/features/team/model";
import { listAllTeamMembers, rotateTeamMemberApiKey } from "@/features/team/api";
import type { TeamMember } from "@/features/team/types";
import { InviteDialog } from "@/features/team/components/InviteDialog";
import { ScopeAssignmentDialog } from "@/features/team/components/ScopeAssignmentDialog";
import { RotateKeyDialog } from "@/features/team/components/RotateKeyDialog";
import { TeamDesktopRow, TeamMobileCard } from "@/features/team/components/TeamRow";

const EMPTY_FILTERS: TeamFilters = { query: "", role: "all", status: "all" };
const ROLE_OPTIONS = ["admin", "staff"] as const;
const STATUS_OPTIONS = ["active", "inactive"] as const;
const PAGE_SIZE = 10;

function TeamSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="h-14 border-b border-border bg-muted/35" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid h-16 grid-cols-[1.2fr_1.4fr_0.7fr_0.7fr_0.7fr] items-center gap-4 border-b border-border px-4 last:border-0"
        >
          <div className="space-y-1.5">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          <span className="h-6 w-16 animate-pulse rounded-lg bg-muted" />
          <span className="h-6 w-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-3 w-14 justify-self-end animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function TeamList() {
  const t = useT("team");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TeamFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<TeamSortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scopeUser, setScopeUser] = useState<TeamMember | null>(null);
  const [rotatedKey, setRotatedKey] = useState<{ apiKey: string; name: string } | null>(null);
  const deferredFilters = useDeferredValue(filters);

  const isAdmin = identity?.role === "admin";

  async function load() {
    setLoadError(null);
    try {
      setMembers(await listAllTeamMembers());
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (isAdmin) void load();
  }, [identity?.role, identity?.scopes.join(",")]);
  useEffect(() => {
    setPage(1);
  }, [deferredFilters, sortKey, sortDirection]);

  if (!isAdmin)
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
  if (members === null) return <TeamSkeleton />;

  const filtered = filterTeamMembers(members, deferredFilters);
  const sorted = sortTeamMembers(filtered, sortKey, sortDirection);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = paginateTeamMembers(sorted, safePage, PAGE_SIZE);
  const hasFilters =
    filters.query.trim() !== "" ||
    filters.role !== "all" ||
    filters.status !== "all";

  function onSort(key: string) {
    const cast = key as TeamSortKey;
    if (sortKey === cast)
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(cast);
      setSortDirection("asc");
    }
  }

  async function onRotateApiKey(member: TeamMember) {
    if (
      !(await confirm({
        title: t("rotate_key_dialog.confirm_title").replace("{name}", member.name),
        description: t("rotate_key_dialog.confirm_description"),
        confirmLabel: t("rotate_key_dialog.confirm_button"),
        tone: "danger",
      }))
    )
      return;
    try {
      const result = await rotateTeamMemberApiKey(member.id);
      setRotatedKey({ apiKey: result.apiKey, name: member.name });
      notify.success(t("api_key_generated"));
    } catch (cause) {
      setActionError(teamErrorMessage(cause, t));
      notify.error(t("api_key_generation_failed"));
    }
  }

  const rowActions = {
    onView: (item: TeamMember) =>
      window.location.assign(`/team/${encodeURIComponent(item.id)}`),
    onManageScopes: setScopeUser,
    onRotateApiKey: (item: TeamMember) => void onRotateApiKey(item),
  };

  return (
    <div className="space-y-3">
      {actionError && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label={common("cancel")}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-primary/10 bg-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/80">
          <Users size={13} aria-hidden="true" />
          {members.length} {t("team_members")}
        </span>
        <Button type="button" onClick={() => setInviteOpen(true)}>
          <UserPlus size={16} />
          {t("invite_user")}
        </Button>
      </div>
      <Card flush>
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={filters.query}
              onChange={(query) =>
                setFilters((current) => ({ ...current, query }))
              }
              placeholder={t("search_placeholder")}
            />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {filtered.length} {t("team_members")}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              aria-label={t("filters.role")}
              value={filters.role}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  role: event.currentTarget.value as TeamFilters["role"],
                }))
              }
              wrapperClassName="sm:w-44"
            >
              <option value="all">{common("table.all")}</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {common(`roles.${role}`)}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t("filters.status")}
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.currentTarget.value as TeamFilters["status"],
                }))
              }
              wrapperClassName="sm:w-44"
            >
              <option value="all">{common("table.all")}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </Select>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                {common("cancel")}
              </Button>
            )}
          </div>
        </div>
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title={
              hasFilters ? common("no_results_found") : t("empty_state.title")
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {visible.map((member) => (
                <TeamMobileCard key={member.id} member={member} {...rowActions} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      label={t("table.name")}
                      sortKey="name"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortHeader
                      label={t("table.email")}
                      sortKey="email"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortHeader
                      label={t("table.role")}
                      sortKey="role"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <SortHeader
                      label={t("table.status")}
                      sortKey="status"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                    <TableHead>{t("table.permissions")}</TableHead>
                    <TableHead className="text-end">
                      {common("table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((member) => (
                    <TeamDesktopRow key={member.id} member={member} {...rowActions} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={sorted.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => void load()}
      />
      {scopeUser && (
        <ScopeAssignmentDialog
          open={scopeUser !== null}
          user={scopeUser}
          onClose={() => setScopeUser(null)}
          onSuccess={() => void load()}
        />
      )}
      <RotateKeyDialog
        open={rotatedKey !== null}
        apiKey={rotatedKey?.apiKey ?? null}
        userName={rotatedKey?.name ?? null}
        onClose={() => setRotatedKey(null)}
      />
    </div>
  );
}

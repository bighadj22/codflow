import { useDeferredValue, useEffect, useState } from "react";
import { AlertCircle, Layers, Plus, X } from "lucide-react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  deleteCustomerGroup,
  listAllCustomerGroups,
} from "@/features/customer-groups/api";
import {
  customerGroupErrorMessage,
  filterGroups,
  groupCanDelete,
  paginateGroups,
  sortGroups,
  type CustomerGroupSortKey,
} from "@/features/customer-groups/model";
import type { CustomerGroup } from "@/features/customer-groups/types";
import {
  Button,
  EmptyState,
  LinkButton,
  Alert,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  Skeleton,
  useConfirmDialog,
  SortHeader,
  Pagination,
  SearchInput,
} from "@/components/ui";
import {
  GroupDesktopRow,
  GroupMobileCard,
} from "@/features/customer-groups/components/CustomerGroupRow";

const PAGE_SIZE = 10;

function GroupSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="h-14 border-b border-border bg-muted/35" />
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="grid h-16 grid-cols-[1fr_0.6fr_0.8fr] items-center gap-4 border-b border-border px-4 last:border-0"
        >
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
          <span className="h-6 w-20 justify-self-end animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function CustomerGroupsList() {
  const t = useT("customer-groups");
  const common = useT("common");
  const auth = useT("auth");
  const identity = useIdentity();
  const confirm = useConfirmDialog();
  const [groups, setGroups] = useState<CustomerGroup[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<CustomerGroupSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  async function load() {
    setLoadError(null);
    try {
      setGroups(await listAllCustomerGroups());
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    if (canScope(identity, SCOPES.CUSTOMER_GROUPS_READ)) void load();
  }, [identity?.role, identity?.scopes.join(",")]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, sortKey, sortDirection]);

  if (!canScope(identity, SCOPES.CUSTOMER_GROUPS_READ))
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
  if (groups === null) return <GroupSkeleton />;

  const filtered = filterGroups(groups, deferredQuery);
  const sorted = sortGroups(filtered, sortKey, sortDirection);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = paginateGroups(sorted, safePage, PAGE_SIZE);
  const hasQuery = query.trim() !== "";
  const canManage = canScope(identity, SCOPES.CUSTOMER_GROUPS_MANAGE);

  function onSort(key: CustomerGroupSortKey) {
    if (sortKey === key)
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }
  async function onDelete(group: CustomerGroup) {
    if (!groupCanDelete(group)) {
      const message = t("error_group_has_members");
      setActionError(message);
      notify.error(message);
      return;
    }
    if (
      !(await confirm({
        title: common("confirm_delete_title").replace("{name}", group.name),
        description: common("delete_description"),
        confirmLabel: common("delete"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteCustomerGroup(group.id);
      setGroups(
        (current) => current?.filter((item) => item.id !== group.id) ?? current,
      );
      notify.success(t("success_deleted"));
    } catch (cause) {
      const message = customerGroupErrorMessage(cause, t);
      setActionError(message);
      notify.error(message);
    }
  }

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
      <Card flush>
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("search_placeholder")}
            />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {filtered.length} {t("groups_count")}
            </span>
          </div>
          {hasQuery && (
            <Button type="button" variant="ghost" onClick={() => setQuery("")}>
              {common("cancel")}
            </Button>
          )}
        </div>
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Layers size={22} />}
            title={
              hasQuery ? common("no_results_found") : t("empty_state.title")
            }
            description={hasQuery ? undefined : t("empty_state.description")}
            action={
              !hasQuery && canManage ? (
                <LinkButton href="/customer-groups/new">
                  <Plus size={16} />
                  {t("empty_state.action")}
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {visible.map((group) => (
                <GroupMobileCard
                  key={group.id}
                  group={group}
                  canManage={canManage}
                  onDelete={onDelete}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      label={t("table.name")}
                      sortKey="name"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={(key) => onSort(key as CustomerGroupSortKey)}
                    />
                    <TableHead>{t("table.description")}</TableHead>
                    <SortHeader
                      label={t("table.members")}
                      sortKey="memberCount"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={(key) => onSort(key as CustomerGroupSortKey)}
                    />
                    <SortHeader
                      label={t("table.created")}
                      sortKey="createdAt"
                      activeKey={sortKey}
                      direction={sortDirection}
                      onSort={(key) => onSort(key as CustomerGroupSortKey)}
                    />
                    <TableHead className="text-end">
                      {common("table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((group) => (
                    <GroupDesktopRow
                      key={group.id}
                      group={group}
                      canManage={canManage}
                      onDelete={onDelete}
                    />
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
    </div>
  );
}
